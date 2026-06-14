/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";

const SUBMITTABLE = new Set(["pending", "changes_requested"]);

export async function submitDeliverableViaTokenAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  const contentUrl = String(formData.get("content_url") ?? "").trim();
  const caption = String(formData.get("caption") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!token) redirect(`/p/contract/missing?error=missing_token`);
  if (!deliverableId || !contentUrl) {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=invalid_input`);
  }

  const verified = verifyToken(token);
  if (!verified.ok) {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=${verified.reason}`);
  }
  if (verified.payload.kind !== "contract") {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=wrong_kind`);
  }

  const admin = createSupabaseAdminClient();

  const { data: deliverable } = await admin
    .from("deliverables")
    .select(
      `id, status, contract_id,
       contracts!inner (
         id,
         influencers!inner ( profile_id )
       )`,
    )
    .eq("id", deliverableId)
    .single();

  if (!deliverable) {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=not_found`);
  }

  const row = deliverable as any;
  if (row.contract_id !== verified.payload.contractId) {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=wrong_contract`);
  }
  if (!SUBMITTABLE.has(row.status)) {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=not_submittable_${row.status}`);
  }

  const contract = Array.isArray(row.contracts) ? row.contracts[0] : row.contracts;
  const influencer = Array.isArray(contract?.influencers)
    ? contract.influencers[0]
    : contract?.influencers;
  const profileId: string | undefined = influencer?.profile_id;

  if (!profileId) {
    redirect(`/p/contract/${encodeURIComponent(token)}?error=missing_profile`);
  }

  const { error: insertErr } = await admin.from("deliverable_submissions").insert({
    deliverable_id: deliverableId,
    submitted_by: profileId,
    content_url: contentUrl,
    caption,
    notes,
  });
  if (insertErr) {
    redirect(
      `/p/contract/${encodeURIComponent(token)}?error=${encodeURIComponent(insertErr.message)}`,
    );
  }

  const nowIso = new Date().toISOString();
  await admin
    .from("deliverables")
    .update({ status: "submitted", updated_at: nowIso })
    .eq("id", deliverableId);

  await admin.from("audit_log").insert({
    actor_profile_id: profileId,
    entity_type: "deliverable",
    entity_id: deliverableId,
    action: "submitted_via_token",
    metadata: { content_url: contentUrl, contract_id: row.contract_id },
  });

  redirect(
    `/p/contract/${encodeURIComponent(token)}?submitted=${encodeURIComponent(deliverableId)}`,
  );
}
