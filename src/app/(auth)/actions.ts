"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/auth/getCurrentUser";
import { buildContractHtml } from "@/lib/contracts/generate";

const ROLES: readonly UserRole[] = ["agency_member", "brand_member", "influencer"];

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "") as UserRole;
  const agencyName = String(formData.get("agency_name") ?? "").trim() || null;

  if (!email || !fullName || !ROLES.includes(role)) {
    redirect("/signup?error=invalid_input");
  }
  if (role === "agency_member" && !agencyName) {
    redirect("/signup?error=agency_name_required");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: appUrl("/auth/callback"),
      data: {
        full_name: fullName,
        role,
        ...(agencyName ? { agency_name: agencyName } : {}),
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

  redirect(`/agency/campaigns/${campaign.id}`);
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

  // Verify influencer is on the agency's roster
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("id")
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .single();

  if (!roster) {
    redirect(
      `/agency/campaigns/${campaignId}?error=influencer_not_on_roster`,
    );
  }

  const { data: invitation, error } = await supabase
    .from("campaign_invitations")
    .insert({
      campaign_id: campaignId,
      influencer_id: influencerId,
      offer_amount_inr_paise: Math.round(offerAmount * 100),
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

  redirect(`/agency/campaigns/${campaignId}?invited=${influencerId}`);
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

  // Find influencer by email
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .eq("primary_role", "influencer")
    .single();

  if (!profile) {
    redirect("/agency/influencers?error=influencer_not_found");
  }

  // Find the influencer record
  const { data: influencer } = await supabase
    .from("influencers")
    .select("id")
    .eq("profile_id", profile.id)
    .single();

  if (!influencer) {
    redirect("/agency/influencers?error=influencer_not_found");
  }

  // Check if already on roster
  const { data: existing } = await supabase
    .from("agency_influencer_roster")
    .select("id")
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
// Influencer flow: accept / decline an invitation, sign a contract
// -----------------------------------------------------------------

export async function acceptInvitationAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "influencer" || !user.influencerId) {
    redirect("/login");
  }

  const invitationId = String(formData.get("invitation_id") ?? "").trim();
  if (!invitationId) redirect("/influencer/invitations?error=invalid_input");

  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // RLS-scoped fetch: influencer can only read own invitations.
  const { data: inv } = await supabase
    .from("campaign_invitations")
    .select(
      `
      id, status, offer_amount_inr_paise, offer_message, deliverables_summary,
      campaign_id, influencer_id,
      campaigns!inner ( id, name, start_date, end_date, agency_id, brand_id,
                        agencies ( name ), brands ( name ) ),
      influencers!inner ( id, display_name, profile_id,
                          profiles ( email, full_name ) )
    `,
    )
    .eq("id", invitationId)
    .eq("influencer_id", user.influencerId)
    .single();

  if (!inv) redirect("/influencer/invitations?error=not_found");
  if (inv.status !== "pending") {
    redirect(`/influencer/invitations?error=already_${inv.status}`);
  }

  const campaign: any = Array.isArray(inv.campaigns) ? inv.campaigns[0] : inv.campaigns;
  const influencer: any = Array.isArray(inv.influencers)
    ? inv.influencers[0]
    : inv.influencers;
  const agency: any = Array.isArray(campaign?.agencies)
    ? campaign.agencies[0]
    : campaign?.agencies;
  const brand: any = Array.isArray(campaign?.brands) ? campaign.brands[0] : campaign?.brands;
  const profile: any = Array.isArray(influencer?.profiles)
    ? influencer.profiles[0]
    : influencer?.profiles;

  const today = new Date().toISOString().slice(0, 10);
  const html = buildContractHtml({
    campaignName: campaign?.name ?? "Campaign",
    brandName: brand?.name ?? "Brand",
    agencyName: agency?.name ?? "Agency",
    influencerName: influencer?.display_name ?? profile?.full_name ?? "Influencer",
    influencerEmail: profile?.email ?? user.email,
    totalAmountInrPaise: inv.offer_amount_inr_paise,
    paymentTerms: "on_completion",
    deliverablesSummary: inv.deliverables_summary,
    offerMessage: inv.offer_message,
    startDate: campaign?.start_date ?? null,
    endDate: campaign?.end_date ?? null,
    effectiveDate: today,
  });

  // Mark invitation accepted (RLS: influencers_influencer_update OK).
  await supabase
    .from("campaign_invitations")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", invitationId);

  // Click-to-accept: e-sign skipped for now. Treat click as influencer signature.
  const nowIso = new Date().toISOString();
  const { data: contract, error: contractErr } = await admin
    .from("contracts")
    .insert({
      invitation_id: invitationId,
      campaign_id: inv.campaign_id,
      influencer_id: inv.influencer_id,
      total_amount_inr_paise: inv.offer_amount_inr_paise,
      payment_terms: "on_completion",
      contract_html: html,
      status: "signed_by_influencer",
      influencer_signed_at: nowIso,
    })
    .select("id")
    .single();

  if (contractErr || !contract) {
    redirect(
      `/influencer/invitations?error=${encodeURIComponent(
        contractErr?.message ?? "contract_create_failed",
      )}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "contract",
    entity_id: contract.id,
    action: "invitation_accepted_click_to_sign",
    metadata: { invitation_id: invitationId, esign_skipped: true },
  });

  redirect(`/influencer/contracts?contract=${contract.id}`);
}

export async function declineInvitationAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "influencer" || !user.influencerId) {
    redirect("/login");
  }

  const invitationId = String(formData.get("invitation_id") ?? "").trim();
  if (!invitationId) redirect("/influencer/invitations?error=invalid_input");

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("campaign_invitations")
    .update({ status: "declined", responded_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("influencer_id", user.influencerId);

  if (error) {
    redirect(`/influencer/invitations?error=${encodeURIComponent(error.message)}`);
  }

  const admin = createSupabaseAdminClient();
  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "campaign_invitation",
    entity_id: invitationId,
    action: "declined",
    metadata: {},
  });

  redirect("/influencer/invitations?declined=1");
}

// -----------------------------------------------------------------
// Deliverables flow
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

export async function submitDeliverableAction(formData: FormData) {
  const { getCurrentUser } = await import("@/lib/auth/getCurrentUser");
  const user = await getCurrentUser();
  if (!user || user.role !== "influencer" || !user.influencerId) {
    redirect("/login");
  }

  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  const contractId = String(formData.get("contract_id") ?? "").trim();
  const contentUrl = String(formData.get("content_url") ?? "").trim() || null;
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!deliverableId || !contentUrl) {
    redirect(`/influencer/contracts/${contractId}?error=invalid_input`);
  }

  const supabase = await createSupabaseServerClient();

  // RLS-scoped: deliverable must belong to influencer's contract
  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("id, contract_id, status, contracts!inner ( influencer_id )")
    .eq("id", deliverableId)
    .single();

  const ct: any = Array.isArray((deliverable as any)?.contracts)
    ? (deliverable as any).contracts[0]
    : (deliverable as any)?.contracts;
  if (!deliverable || ct?.influencer_id !== user.influencerId) {
    redirect(`/influencer/contracts/${contractId}?error=not_found`);
  }
  if (!["pending", "changes_requested"].includes((deliverable as any).status)) {
    redirect(`/influencer/contracts/${contractId}?error=invalid_status`);
  }

  const { error: subErr } = await supabase.from("deliverable_submissions").insert({
    deliverable_id: deliverableId,
    submitted_by: user.id,
    content_url: contentUrl,
    caption,
    notes,
  });
  if (subErr) {
    redirect(
      `/influencer/contracts/${contractId}?error=${encodeURIComponent(subErr.message)}`,
    );
  }

  // Move deliverable to submitted. Agency has FOR ALL policy; influencer needs admin.
  const admin = createSupabaseAdminClient();
  await admin
    .from("deliverables")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", deliverableId);

  await admin.from("audit_log").insert({
    actor_profile_id: user.id,
    entity_type: "deliverable",
    entity_id: deliverableId,
    action: "submitted",
    metadata: { content_url: contentUrl },
  });

  redirect(`/influencer/contracts/${contractId}?submitted=1`);
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

  redirect(`/agency/contracts/${contractId}?reviewed=1`);
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
