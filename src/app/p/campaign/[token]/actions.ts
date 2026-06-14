/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";

const REVIEWABLE = new Set(["submitted"]);

async function loadDeliverableForCampaignToken(
  deliverableId: string,
  campaignId: string,
) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("deliverables")
    .select(
      `id, status, contract_id,
       contracts!inner ( campaign_id )`,
    )
    .eq("id", deliverableId)
    .single();
  if (!data) return null;
  const row = data as any;
  const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
  if (contract?.campaign_id !== campaignId) return null;
  return row;
}

export async function brandReviewDeliverableViaTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const feedback = String(formData.get("feedback") ?? "").trim() || null;

  if (!token) redirect(`/p/campaign/missing?error=missing_token`);
  if (!["approve", "request_changes"].includes(decision)) {
    redirect(`/p/campaign/${encodeURIComponent(token)}?error=invalid_decision`);
  }

  const verified = verifyToken(token);
  if (!verified.ok) {
    redirect(`/p/campaign/${encodeURIComponent(token)}?error=${verified.reason}`);
  }
  if (verified.payload.kind !== "campaign") {
    redirect(`/p/campaign/${encodeURIComponent(token)}?error=wrong_kind`);
  }

  const deliverable = await loadDeliverableForCampaignToken(
    deliverableId,
    verified.payload.campaignId,
  );
  if (!deliverable) {
    redirect(`/p/campaign/${encodeURIComponent(token)}?error=not_found`);
  }
  if (!REVIEWABLE.has(deliverable.status)) {
    redirect(`/p/campaign/${encodeURIComponent(token)}?error=not_reviewable_${deliverable.status}`);
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Stamp the latest submission with feedback.
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
        reviewed_at: nowIso,
      })
      .eq("id", (latestSub as any).id);
  }

  const nextStatus = decision === "approve" ? "approved" : "changes_requested";
  await admin
    .from("deliverables")
    .update({ status: nextStatus, updated_at: nowIso })
    .eq("id", deliverableId);

  await admin.from("audit_log").insert({
    actor_profile_id: null,
    entity_type: "deliverable",
    entity_id: deliverableId,
    action: `brand_review_${decision}_via_token`,
    metadata: { feedback, campaign_id: verified.payload.campaignId },
  });

  redirect(
    `/p/campaign/${encodeURIComponent(token)}?reviewed=${encodeURIComponent(deliverableId)}`,
  );
}
