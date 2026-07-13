"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/auth/getCurrentUser";
import { sendEmail } from "@/lib/email/resend";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";
import { buildContractLinkEmail } from "@/lib/email/templates/contract-link";
import { buildBrandCampaignEmail } from "@/lib/email/templates/brand-campaign";
import { signToken } from "@/lib/tokens";
import { createInfluencerPayout } from "@/lib/razorpay/payouts";
import { formatPaiseAsINR } from "@/lib/money";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const agencyName = String(formData.get("agency_name") ?? "").trim();

  if (!email || !fullName || !agencyName) {
    redirect("/signup?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: appUrl("/auth/callback"),
      data: {
        full_name: fullName,
        role: "agency_member" satisfies UserRole,
        agency_name: agencyName,
      },
    },
  });

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function logInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: appUrl("/auth/callback"),
    },
  });

  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect(`/check-email?email=${encodeURIComponent(email)}`);
}

export async function logOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function createBrandAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const contactEmail = String(formData.get("contact_email") ?? "").trim().toLowerCase();
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const gstin = String(formData.get("gstin") ?? "").trim().toUpperCase() || null;
  const pan = String(formData.get("pan") ?? "").trim().toUpperCase() || null;
  const billingAddress = String(formData.get("billing_address") ?? "").trim() || null;

  if (!name || !contactEmail) {
    redirect("/agency/brands?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("brands").insert({
    agency_id: user.agencyId,
    name,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    gstin,
    pan,
    billing_address: billingAddress,
  });

  if (error) {
    redirect(`/agency/brands?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/agency/brands?created=${encodeURIComponent(name)}`);
}

export async function createCampaignAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const brandId = String(formData.get("brand_id") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim() || null;
  const budgetRupees = Number(formData.get("budget_rupees") ?? 0);
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const endDate = String(formData.get("end_date") ?? "").trim() || null;

  if (!name || !brandId || budgetRupees <= 0) {
    redirect("/agency/campaigns?error=invalid_input");
  }

  const supabase = await createSupabaseServerClient();

  // Verify the brand belongs to this agency
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!brand) {
    redirect("/agency/campaigns?error=brand_not_found");
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert({
      agency_id: user.agencyId,
      brand_id: brandId,
      name,
      brief,
      total_budget_inr_paise: Math.round(budgetRupees * 100),
      start_date: startDate,
      end_date: endDate,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/agency/campaigns?error=${encodeURIComponent(error.message)}`);
  }

  await sendBrandCampaignEmail({
    campaignId: campaign.id,
    actorProfileId: user.id,
    agencyId: user.agencyId,
    budgetPaise: Math.round(budgetRupees * 100),
  });

  redirect(`/agency/campaigns/${campaign.id}`);
}

const CAMPAIGN_STATUSES = ["draft", "active", "completed", "cancelled"] as const;

export async function updateCampaignAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const brief = String(formData.get("brief") ?? "").trim() || null;
  const budgetRupees = Number(formData.get("budget_rupees") ?? 0);
  const startDate = String(formData.get("start_date") ?? "").trim() || null;
  const endDate = String(formData.get("end_date") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "").trim();

  if (!campaignId) redirect("/agency/campaigns?error=invalid_input");
  if (!name || budgetRupees <= 0) {
    redirect(`/agency/campaigns/${campaignId}/edit?error=invalid_input`);
  }
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(status)) {
    redirect(`/agency/campaigns/${campaignId}/edit?error=invalid_status`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!existing) redirect("/agency/campaigns?error=campaign_not_found");

  const { error } = await supabase
    .from("campaigns")
    .update({
      name,
      brief,
      total_budget_inr_paise: Math.round(budgetRupees * 100),
      start_date: startDate,
      end_date: endDate,
      status,
    })
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId);

  if (error) {
    redirect(
      `/agency/campaigns/${campaignId}/edit?error=${encodeURIComponent(error.message)}`,
    );
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "campaign",
    entity_id: campaignId,
    action: "campaign_updated",
    metadata: { fields: ["name", "brief", "total_budget_inr_paise", "start_date", "end_date", "status"] },
  });

  redirect(`/agency/campaigns/${campaignId}?updated=1`);
}

async function sendBrandCampaignEmail(params: {
  campaignId: string;
  actorProfileId: string;
  agencyId: string;
  budgetPaise: number;
}) {
  const admin = createSupabaseAdminClient();

  const { data: ctx } = await admin
    .from("campaigns")
    .select(
      `id, name,
       brands!inner ( name, contact_email )`,
    )
    .eq("id", params.campaignId)
    .single();

  const { data: agency } = await admin
    .from("agencies")
    .select("name")
    .eq("id", params.agencyId)
    .single();

  if (!ctx || !agency) return;

  const row = ctx as unknown as {
    id: string;
    name: string;
    brands: { name: string; contact_email: string } | { name: string; contact_email: string }[];
  };
  const brand = Array.isArray(row.brands) ? row.brands[0] : row.brands;
  if (!brand?.contact_email) return;

  const campaignToken = signToken({ kind: "campaign", campaignId: params.campaignId });
  const { subject, html, text } = buildBrandCampaignEmail({
    brandName: brand.name,
    agencyName: (agency as { name: string }).name,
    campaignName: row.name,
    campaignUrl: appUrl(`/p/campaign/${campaignToken}`),
    budgetInr: formatPaiseAsINR(params.budgetPaise),
  });

  const result = await sendEmail({
    to: brand.contact_email,
    subject,
    html,
    text,
  });

  await admin.from("audit_log").insert({
    actor_profile_id: params.actorProfileId,
    entity_type: "campaign",
    entity_id: params.campaignId,
    action: result.ok ? "brand_campaign_email_sent" : "brand_campaign_email_failed",
    metadata: result.ok
      ? { provider: "resend", email_id: result.id, to: brand.contact_email }
      : { provider: "resend", reason: result.reason, error: result.message },
  });
}

export async function inviteInfluencerAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const offerAmount = Number(formData.get("offer_amount_rupees") ?? 0);
  const offerMessage = String(formData.get("offer_message") ?? "").trim() || null;

  if (!campaignId || !influencerId || offerAmount <= 0) {
    redirect(`/agency/campaigns/${campaignId}?error=invalid_input`);
  }

  const supabase = await createSupabaseServerClient();

  // Verify campaign belongs to this agency
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!campaign) {
    redirect(`/agency/campaigns?error=campaign_not_found`);
  }

  // Verify influencer is on the agency's roster. The table has a composite
  // PK (agency_id, influencer_id) — there is no id column.
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("agency_id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .single();

  if (!roster) {
    redirect(
      `/agency/campaigns/${campaignId}?error=influencer_not_on_roster`,
    );
  }

  const offerAmountPaise = Math.round(offerAmount * 100);

  const { data: invitation, error } = await supabase
    .from("campaign_invitations")
    .insert({
      campaign_id: campaignId,
      influencer_id: influencerId,
      offer_amount_inr_paise: offerAmountPaise,
      offer_message: offerMessage,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    redirect(
      `/agency/campaigns/${campaignId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await sendInvitationEmail({
    actorProfileId: user.id,
    invitationId: invitation.id,
    campaignId,
    influencerId,
    agencyId: user.agencyId,
    offerAmountPaise,
    offerMessage,
  });

  redirect(`/agency/campaigns/${campaignId}?invited=${influencerId}`);
}

async function sendInvitationEmail(params: {
  actorProfileId: string;
  invitationId: string;
  campaignId: string;
  influencerId: string;
  agencyId: string;
  offerAmountPaise: number;
  offerMessage: string | null;
}) {
  const admin = createSupabaseAdminClient();

  const { data: ctx, error: ctxError } = await admin
    .from("campaign_invitations")
    .select(
      `id,
       campaign:campaigns!inner(name, brand:brands!inner(name)),
       influencer:influencers!inner(profile:profiles!inner(email, full_name))`,
    )
    .eq("id", params.invitationId)
    .single<{
      id: string;
      campaign: { name: string; brand: { name: string } };
      influencer: { profile: { email: string; full_name: string | null } };
    }>();

  const { data: agency } = await admin
    .from("agencies")
    .select("name")
    .eq("id", params.agencyId)
    .single<{ name: string }>();

  if (ctxError || !ctx || !agency) {
    await admin.from("audit_log").insert({
      actor_profile_id: params.actorProfileId,
      entity_type: "campaign_invitation",
      entity_id: params.invitationId,
      action: "invitation_email_failed",
      metadata: {
        reason: "enrichment_failed",
        error: ctxError?.message ?? "missing_data",
      },
    });
    return;
  }

  const { subject, html, text } = buildInvitationEmail({
    influencerName: ctx.influencer.profile.full_name ?? "there",
    agencyName: agency.name,
    brandName: ctx.campaign.brand.name,
    campaignName: ctx.campaign.name,
    offerAmountPaise: params.offerAmountPaise,
    offerMessage: params.offerMessage,
    invitationUrl: appUrl(
      `/p/invitation/${signToken({
        kind: "invitation",
        invitationId: params.invitationId,
      })}`,
    ),
  });

  const result = await sendEmail({
    to: ctx.influencer.profile.email,
    subject,
    html,
    text,
  });

  await admin.from("audit_log").insert({
    actor_profile_id: params.actorProfileId,
    entity_type: "campaign_invitation",
    entity_id: params.invitationId,
    action: result.ok ? "invitation_email_sent" : "invitation_email_failed",
    metadata: result.ok
      ? { provider: "resend", email_id: result.id, to: ctx.influencer.profile.email }
      : { provider: "resend", reason: result.reason, error: result.message },
  });
}

export async function addInfluencerToRosterAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/agency/influencers?error=invalid_email");

  const supabase = await createSupabaseServerClient();

  // Look up the influencer with the admin client: profiles RLS is
  // self-select-only, so the agency's session can't see other users' rows.
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .eq("primary_role", "influencer")
    .single();

  if (!profile) {
    redirect("/agency/influencers?error=influencer_not_found");
  }

  // Find the influencer record
  const { data: influencer } = await admin
    .from("influencers")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!influencer) {
    redirect("/agency/influencers?error=influencer_not_found");
  }

  // Check if already on roster (composite PK — no id column)
  const { data: existing } = await supabase
    .from("agency_influencer_roster")
    .select("agency_id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencer.id)
    .maybeSingle();

  if (existing) {
    redirect("/agency/influencers?error=already_on_roster");
  }

  // Add to roster
  const { error } = await supabase.from("agency_influencer_roster").insert({
    agency_id: user.agencyId,
    influencer_id: influencer.id,
    added_by: user.id,
  });

  if (error) {
    redirect(`/agency/influencers?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/agency/influencers?added=success");
}

// -----------------------------------------------------------------
// Deliverable management (agency-side)
// -----------------------------------------------------------------

const DELIVERABLE_TYPES = [
  "instagram_post",
  "instagram_reel",
  "instagram_story",
  "youtube_video",
  "youtube_short",
  "twitter_post",
  "blog_post",
  "other",
] as const;

async function loadContractForAgency(contractId: string, agencyId: string) {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("contracts")
    .select("id, campaign_id, influencer_id, campaigns!inner ( agency_id )")
    .eq("id", contractId)
    .single();
  const camp: any = Array.isArray((data as any)?.campaigns)
    ? (data as any).campaigns[0]
    : (data as any)?.campaigns;
  if (!data || camp?.agency_id !== agencyId) return null;
  return data as { id: string; campaign_id: string; influencer_id: string };
}

export async function addDeliverableAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const contractId = String(formData.get("contract_id") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const dueDate = String(formData.get("due_date") ?? "").trim() || null;
  const amountRupees = Number(formData.get("amount_rupees") ?? 0);

  if (!contractId || !(DELIVERABLE_TYPES as readonly string[]).includes(type)) {
    redirect(`/agency/contracts/${contractId}?error=invalid_input`);
  }

  const contract = await loadContractForAgency(contractId, user.agencyId);
  if (!contract) redirect("/agency/campaigns?error=contract_not_found");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("deliverables").insert({
    contract_id: contractId,
    type,
    description,
    due_date: dueDate,
    amount_inr_paise: Math.round(amountRupees * 100),
    status: "pending",
  });

  if (error) {
    redirect(`/agency/contracts/${contractId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/agency/contracts/${contractId}?added=1`);
}

export async function reviewDeliverableAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  const contractId = String(formData.get("contract_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim() || null;

  if (!["approve", "request_changes"].includes(decision)) {
    redirect(`/agency/contracts/${contractId}?error=invalid_decision`);
  }

  const contract = await loadContractForAgency(contractId, user.agencyId);
  if (!contract) redirect("/agency/campaigns?error=contract_not_found");

  const supabase = await createSupabaseServerClient();
  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, status, contract_id")
    .eq("id", deliverableId)
    .eq("contract_id", contractId)
    .single();

  if (!deliverable) redirect(`/agency/contracts/${contractId}?error=not_found`);
  if ((deliverable as any).status !== "submitted") {
    redirect(`/agency/contracts/${contractId}?error=not_in_review`);
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Stamp latest submission with reviewer details.
  const { data: latestSub } = await admin
    .from("deliverable_submissions")
    .select("id")
    .eq("deliverable_id", deliverableId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (latestSub) {
    await admin
      .from("deliverable_submissions")
      .update({
        reviewer_feedback: feedback,
        reviewed_by: user.id,
        reviewed_at: nowIso,
      })
      .eq("id", (latestSub as any).id);
  }

  const nextStatus = decision === "approve" ? "approved" : "changes_requested";
  await supabase
    .from("deliverables")
    .update({ status: nextStatus, updated_at: nowIso })
    .eq("id", deliverableId);

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "deliverable",
    entity_id: deliverableId,
    action: `review_${decision}`,
    metadata: { feedback },
  });

  if (nextStatus === "changes_requested") {
    await sendChangesRequestedEmail({
      contractId,
      actorProfileId: user.id,
      feedback,
    });
  }

  redirect(`/agency/contracts/${contractId}?reviewed=1`);
}

async function sendChangesRequestedEmail(params: {
  contractId: string;
  actorProfileId: string;
  feedback: string | null;
}) {
  const admin = createSupabaseAdminClient();

  const { data: contract } = await admin
    .from("contracts")
    .select(
      `id,
       campaigns!inner ( name, agencies ( name ), brands ( name ) ),
       influencers!inner ( display_name, profiles ( email, full_name ) )`,
    )
    .eq("id", params.contractId)
    .single();

  if (!contract) return;

  const row = contract as any;
  const campaign = Array.isArray(row.campaigns) ? row.campaigns[0] : row.campaigns;
  const agency = Array.isArray(campaign?.agencies) ? campaign.agencies[0] : campaign?.agencies;
  const brand = Array.isArray(campaign?.brands) ? campaign.brands[0] : campaign?.brands;
  const influencer = Array.isArray(row.influencers) ? row.influencers[0] : row.influencers;
  const profile = Array.isArray(influencer?.profiles)
    ? influencer.profiles[0]
    : influencer?.profiles;

  if (!profile?.email) return;

  const contractToken = signToken({ kind: "contract", contractId: params.contractId });
  const { subject, html, text } = buildContractLinkEmail({
    context: "changes_requested",
    influencerName: influencer?.display_name ?? profile.full_name ?? "there",
    agencyName: agency?.name ?? "the agency",
    brandName: brand?.name ?? "the brand",
    campaignName: campaign?.name ?? "the campaign",
    contractUrl: appUrl(`/p/contract/${contractToken}`),
    feedback: params.feedback,
  });

  const result = await sendEmail({
    to: profile.email,
    subject,
    html,
    text,
  });

  await admin.from("audit_log").insert({
    actor_profile_id: params.actorProfileId,
    entity_type: "contract",
    entity_id: params.contractId,
    action: result.ok ? "contract_link_email_sent" : "contract_link_email_failed",
    metadata: result.ok
      ? { provider: "resend", email_id: result.id, context: "changes_requested" }
      : {
          provider: "resend",
          reason: result.reason,
          error: result.message,
          context: "changes_requested",
        },
  });
}

export async function markDeliverableLiveAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  const contractId = String(formData.get("contract_id") ?? "").trim();

  const contract = await loadContractForAgency(contractId, user.agencyId);
  if (!contract) redirect("/agency/campaigns?error=contract_not_found");

  const supabase = await createSupabaseServerClient();
  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, status")
    .eq("id", deliverableId)
    .eq("contract_id", contractId)
    .single();

  if (!deliverable) redirect(`/agency/contracts/${contractId}?error=not_found`);
  if ((deliverable as any).status !== "approved") {
    redirect(`/agency/contracts/${contractId}?error=not_approved`);
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("deliverables")
    .update({ status: "live", updated_at: nowIso })
    .eq("id", deliverableId);

  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "deliverable",
    entity_id: deliverableId,
    action: "marked_live",
    metadata: {},
  });

  redirect(`/agency/contracts/${contractId}?live=1`);
}

// -----------------------------------------------------------------
// Influencer detail + payouts
// -----------------------------------------------------------------

export async function updateInfluencerBankAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const influencerId = String(formData.get("influencer_id") ?? "").trim();
  const accountNumber = String(formData.get("bank_account_number") ?? "").trim() || null;
  const ifsc = String(formData.get("bank_ifsc") ?? "").trim().toUpperCase() || null;
  const holderName = String(formData.get("bank_account_holder_name") ?? "").trim() || null;
  const pan = String(formData.get("pan") ?? "").trim().toUpperCase() || null;
  const gstin = String(formData.get("gstin") ?? "").trim().toUpperCase() || null;

  if (!influencerId) redirect("/agency/influencers?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("agency_id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .single();
  if (!roster) {
    redirect(`/agency/influencers?error=not_on_roster`);
  }

  // Only the agency's roster gate matters; influencer details are mutated via
  // admin client because RLS scopes influencer writes to the influencer itself.
  const admin = createSupabaseAdminClient();
  const updates: Record<string, string | null> = {};
  if (accountNumber !== null) updates.bank_account_number = accountNumber;
  if (ifsc !== null) updates.bank_ifsc = ifsc;
  if (holderName !== null) updates.bank_account_holder_name = holderName;
  if (pan !== null) updates.pan = pan;
  if (gstin !== null) updates.gstin = gstin;

  // If bank details changed, the cached Razorpay fund account is stale.
  if (
    "bank_account_number" in updates ||
    "bank_ifsc" in updates ||
    "bank_account_holder_name" in updates
  ) {
    updates.razorpay_fund_account_id = null;
  }

  const { error } = await admin
    .from("influencers")
    .update(updates)
    .eq("id", influencerId);

  if (error) {
    redirect(
      `/agency/influencers/${influencerId}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "influencer",
    entity_id: influencerId,
    action: "bank_details_updated",
    metadata: { fields: Object.keys(updates) },
  });

  redirect(`/agency/influencers/${influencerId}?saved=1`);
}

export async function initiatePayoutAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "agency_member" || !user.agencyId) {
    redirect("/login");
  }

  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  if (!deliverableId) redirect("/agency/payouts?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const { data: deliverable } = await supabase
    .from("deliverables")
    .select(
      `id, status, amount_inr_paise, contract_id,
       contracts!inner ( influencer_id, campaigns!inner ( agency_id ) )`,
    )
    .eq("id", deliverableId)
    .single();

  if (!deliverable) redirect(`/agency/payouts?error=not_found`);
  const row = deliverable as any;
  const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
  const campaign = Array.isArray(contract?.campaigns)
    ? contract.campaigns[0]
    : contract?.campaigns;

  if (campaign?.agency_id !== user.agencyId) {
    redirect(`/agency/payouts?error=not_yours`);
  }
  if (!["approved", "live"].includes(row.status)) {
    redirect(`/agency/payouts?error=not_payable_${row.status}`);
  }

  // Already paid out?
  const admin = createSupabaseAdminClient();
  const { data: existing } = await admin
    .from("payouts")
    .select("id, status")
    .eq("deliverable_id", deliverableId)
    .in("status", ["pending", "queued", "processing", "paid"])
    .limit(1)
    .maybeSingle();
  if (existing) {
    redirect(`/agency/payouts?error=already_initiated`);
  }

  const result = await createInfluencerPayout({
    influencerId: contract.influencer_id,
    contractId: row.contract_id,
    deliverableId,
    amountPaise: Number(row.amount_inr_paise),
    purpose: "payout",
    narration: "Influencer deliverable payout",
  });

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "deliverable",
    entity_id: deliverableId,
    action: result.ok ? "payout_initiated" : "payout_failed",
    metadata: result.ok
      ? {
          payout_id: result.payoutId,
          razorpay_payout_id: result.razorpayPayoutId,
          amount_inr_paise: row.amount_inr_paise,
        }
      : { reason: result.reason, error: result.message },
  });

  if (!result.ok) {
    redirect(
      `/agency/payouts?error=${encodeURIComponent(result.reason)}${
        result.message ? `&details=${encodeURIComponent(result.message)}` : ""
      }`,
    );
  }

  redirect(`/agency/payouts?initiated=${result.payoutId}`);
}
