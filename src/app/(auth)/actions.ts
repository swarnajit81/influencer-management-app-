"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/auth/getCurrentUser";
import { sendEmail } from "@/lib/email/resend";
import { buildInvitationEmail } from "@/lib/email/templates/invitation";

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
    invitationUrl: appUrl(`/p/invitation/${params.invitationId}`),
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
