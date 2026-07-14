"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";

function verify(token: string) {
  const v = verifyToken(token);
  if (!v.ok) {
    redirect(`/p/package/${encodeURIComponent(token)}?error=${v.reason}`);
  }
  if (v.payload.kind !== "package") {
    redirect(`/p/package/${encodeURIComponent(token)}?error=wrong_kind`);
  }
  return v.payload;
}

async function assertItemInCampaign(
  itemId: string,
  campaignId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("campaign_shortlist_items")
    .select("id")
    .eq("id", itemId)
    .eq("campaign_id", campaignId)
    .maybeSingle();
  return !!data;
}

export async function brandDecideShortlistItemAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/");
  const payload = verify(token);

  const itemId = String(formData.get("item_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const comment = String(formData.get("brand_comment") ?? "").trim() || null;

  if (!["approved", "rejected"].includes(decision)) {
    redirect(
      `/p/package/${encodeURIComponent(token)}?error=invalid_decision`,
    );
  }
  if (!(await assertItemInCampaign(itemId, payload.campaignId))) {
    redirect(`/p/package/${encodeURIComponent(token)}?error=item_not_found`);
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("campaign_shortlist_items")
    .update({
      brand_decision: decision,
      brand_comment: comment,
      decided_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    redirect(
      `/p/package/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`,
    );
  }

  await admin.from("audit_log").insert({
    actor_profile_id: null,
    entity_type: "campaign_shortlist_item",
    entity_id: itemId,
    action: `brand_${decision}`,
    metadata: { comment, campaign_id: payload.campaignId },
  });

  // If all items are decided and none pending, flip campaign to brand_approved.
  const { data: pending } = await admin
    .from("campaign_shortlist_items")
    .select("id")
    .eq("campaign_id", payload.campaignId)
    .eq("brand_decision", "pending")
    .limit(1);
  if (pending && pending.length === 0) {
    const { data: anyApproved } = await admin
      .from("campaign_shortlist_items")
      .select("id")
      .eq("campaign_id", payload.campaignId)
      .eq("brand_decision", "approved")
      .limit(1);
    if (anyApproved && anyApproved.length > 0) {
      await admin
        .from("campaigns")
        .update({ status: "brand_approved" })
        .eq("id", payload.campaignId);
    }
  }

  revalidatePath(`/p/package/${token}`);
  revalidatePath(`/agency/campaigns/${payload.campaignId}`);
  redirect(`/p/package/${encodeURIComponent(token)}?decided=${itemId}`);
}

export async function brandRequestRevisionAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/");
  const payload = verify(token);

  const note = String(formData.get("note") ?? "").trim() || null;
  const admin = createSupabaseAdminClient();

  await admin
    .from("campaigns")
    .update({ status: "draft" })
    .eq("id", payload.campaignId);

  await admin.from("audit_log").insert({
    actor_profile_id: null,
    entity_type: "campaign",
    entity_id: payload.campaignId,
    action: "brand_requested_revision",
    metadata: { note, package_version_id: payload.versionId },
  });

  revalidatePath(`/p/package/${token}`);
  revalidatePath(`/agency/campaigns/${payload.campaignId}`);
  redirect(`/p/package/${encodeURIComponent(token)}?revision=1`);
}
