/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken, signToken } from "@/lib/tokens";
import { buildContractHtml } from "@/lib/contracts/generate";

type InvitationContext = {
  invitationId: string;
  status: string;
  campaignId: string;
  influencerId: string;
  influencerProfileId: string;
  offerAmountInrPaise: number;
  offerMessage: string | null;
  deliverablesSummary: string | null;
  campaignName: string;
  startDate: string | null;
  endDate: string | null;
  brandName: string;
  agencyName: string;
  influencerName: string;
  influencerEmail: string;
};

async function loadInvitation(
  invitationId: string,
): Promise<InvitationContext | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("campaign_invitations")
    .select(
      `id, status, offer_amount_inr_paise, offer_message, deliverables_summary,
       campaign_id, influencer_id,
       campaigns!inner ( name, start_date, end_date,
                         agencies ( name ), brands ( name ) ),
       influencers!inner ( display_name, profile_id,
                           profiles ( email, full_name ) )`,
    )
    .eq("id", invitationId)
    .single();

  if (!data) return null;

  const campaign: any = Array.isArray((data as any).campaigns)
    ? (data as any).campaigns[0]
    : (data as any).campaigns;
  const influencer: any = Array.isArray((data as any).influencers)
    ? (data as any).influencers[0]
    : (data as any).influencers;
  const agency: any = Array.isArray(campaign?.agencies)
    ? campaign.agencies[0]
    : campaign?.agencies;
  const brand: any = Array.isArray(campaign?.brands)
    ? campaign.brands[0]
    : campaign?.brands;
  const profile: any = Array.isArray(influencer?.profiles)
    ? influencer.profiles[0]
    : influencer?.profiles;

  return {
    invitationId: (data as any).id,
    status: (data as any).status,
    campaignId: (data as any).campaign_id,
    influencerId: (data as any).influencer_id,
    influencerProfileId: influencer?.profile_id,
    offerAmountInrPaise: (data as any).offer_amount_inr_paise,
    offerMessage: (data as any).offer_message,
    deliverablesSummary: (data as any).deliverables_summary,
    campaignName: campaign?.name ?? "Campaign",
    startDate: campaign?.start_date ?? null,
    endDate: campaign?.end_date ?? null,
    brandName: brand?.name ?? "Brand",
    agencyName: agency?.name ?? "Agency",
    influencerName: influencer?.display_name ?? profile?.full_name ?? "Influencer",
    influencerEmail: profile?.email ?? "",
  };
}

export async function acceptInvitationViaTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect(`/p/invitation/missing?error=missing_token`);

  const verified = verifyToken(token);
  if (!verified.ok) {
    redirect(`/p/invitation/${encodeURIComponent(token)}?error=${verified.reason}`);
  }
  if (verified.payload.kind !== "invitation") {
    redirect(`/p/invitation/${encodeURIComponent(token)}?error=wrong_kind`);
  }

  const ctx = await loadInvitation(verified.payload.invitationId);
  if (!ctx) redirect(`/p/invitation/${encodeURIComponent(token)}?error=not_found`);
  if (ctx.status !== "pending") {
    redirect(`/p/invitation/${encodeURIComponent(token)}?error=already_${ctx.status}`);
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const html = buildContractHtml({
    campaignName: ctx.campaignName,
    brandName: ctx.brandName,
    agencyName: ctx.agencyName,
    influencerName: ctx.influencerName,
    influencerEmail: ctx.influencerEmail,
    totalAmountInrPaise: ctx.offerAmountInrPaise,
    paymentTerms: "on_completion",
    deliverablesSummary: ctx.deliverablesSummary,
    offerMessage: ctx.offerMessage,
    startDate: ctx.startDate,
    endDate: ctx.endDate,
    effectiveDate: nowIso.slice(0, 10),
  });

  await admin
    .from("campaign_invitations")
    .update({ status: "accepted", responded_at: nowIso })
    .eq("id", ctx.invitationId);

  const { data: contract, error: contractErr } = await admin
    .from("contracts")
    .insert({
      invitation_id: ctx.invitationId,
      campaign_id: ctx.campaignId,
      influencer_id: ctx.influencerId,
      total_amount_inr_paise: ctx.offerAmountInrPaise,
      payment_terms: "on_completion",
      contract_html: html,
      status: "signed_by_influencer",
      influencer_signed_at: nowIso,
    })
    .select("id")
    .single();

  if (contractErr || !contract) {
    redirect(
      `/p/invitation/${encodeURIComponent(token)}?error=${encodeURIComponent(
        contractErr?.message ?? "contract_create_failed",
      )}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: ctx.influencerProfileId,
    entity_type: "contract",
    entity_id: contract.id,
    action: "invitation_accepted_click_to_sign_via_token",
    metadata: { invitation_id: ctx.invitationId, esign_skipped: true },
  });

  const contractToken = signToken({ kind: "contract", contractId: contract.id });
  redirect(
    `/p/invitation/${encodeURIComponent(token)}?accepted=1&contract=${encodeURIComponent(
      contractToken,
    )}`,
  );
}

export async function declineInvitationViaTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!token) redirect(`/p/invitation/missing?error=missing_token`);

  const verified = verifyToken(token);
  if (!verified.ok) {
    redirect(`/p/invitation/${encodeURIComponent(token)}?error=${verified.reason}`);
  }
  if (verified.payload.kind !== "invitation") {
    redirect(`/p/invitation/${encodeURIComponent(token)}?error=wrong_kind`);
  }

  const ctx = await loadInvitation(verified.payload.invitationId);
  if (!ctx) redirect(`/p/invitation/${encodeURIComponent(token)}?error=not_found`);
  if (ctx.status !== "pending") {
    redirect(`/p/invitation/${encodeURIComponent(token)}?error=already_${ctx.status}`);
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  await admin
    .from("campaign_invitations")
    .update({
      status: "declined",
      responded_at: nowIso,
    })
    .eq("id", ctx.invitationId);

  await admin.from("audit_log").insert({
    actor_profile_id: ctx.influencerProfileId,
    entity_type: "campaign_invitation",
    entity_id: ctx.invitationId,
    action: "invitation_declined_via_token",
    metadata: { reason },
  });

  redirect(`/p/invitation/${encodeURIComponent(token)}?declined=1`);
}
