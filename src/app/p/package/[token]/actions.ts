"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken } from "@/lib/tokens";
import { ensureBrandProfile } from "@/lib/brand/ensureBrandProfile";
import { notifyAgencyOfBrandAction } from "@/lib/email/agencyNotify";

// Load campaign + brand context needed to auto-provision a brand profile and
// notify the agency. Returns null if the campaign is missing.
async function loadBrandContext(campaignId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("campaigns")
    .select(
      `id, name, agency_id,
       brands!inner ( id, name, contact_email )`,
    )
    .eq("id", campaignId)
    .maybeSingle();
  if (!data) return null;
  const brand = Array.isArray((data as { brands: unknown }).brands)
    ? ((data as { brands: unknown[] }).brands[0] as {
        id: string;
        name: string;
        contact_email: string;
      })
    : ((data as { brands: unknown }).brands as {
        id: string;
        name: string;
        contact_email: string;
      });
  return {
    campaignId: (data as { id: string }).id,
    campaignName: (data as { name: string }).name,
    agencyId: (data as { agency_id: string }).agency_id,
    brand,
  };
}

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
  const ctx = await loadBrandContext(payload.campaignId);
  const brandProfileId = ctx
    ? await ensureBrandProfile({
        brandId: ctx.brand.id,
        contactEmail: ctx.brand.contact_email,
        brandName: ctx.brand.name,
      })
    : null;

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
    actor_profile_id: brandProfileId,
    entity_type: "campaign_shortlist_item",
    entity_id: itemId,
    action: `brand_${decision}`,
    metadata: { comment, campaign_id: payload.campaignId },
  });

  await admin.from("package_events").insert({
    campaign_id: payload.campaignId,
    package_version_id: payload.versionId,
    shortlist_item_id: itemId,
    actor_kind: "brand",
    actor_profile_id: brandProfileId,
    event_type: decision === "approved" ? "item_approved" : "item_rejected",
    metadata: comment ? { comment } : {},
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

  if (ctx) {
    await notifyAgencyOfBrandAction({
      agencyId: ctx.agencyId,
      campaignId: ctx.campaignId,
      campaignName: ctx.campaignName,
      brandName: ctx.brand.name,
      actionLabel: decision === "approved" ? "approved a creator" : "rejected a creator",
      detail: comment,
    });
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
  const ctx = await loadBrandContext(payload.campaignId);
  const brandProfileId = ctx
    ? await ensureBrandProfile({
        brandId: ctx.brand.id,
        contactEmail: ctx.brand.contact_email,
        brandName: ctx.brand.name,
      })
    : null;

  await admin
    .from("campaigns")
    .update({ status: "draft" })
    .eq("id", payload.campaignId);

  await admin.from("audit_log").insert({
    actor_profile_id: brandProfileId,
    entity_type: "campaign",
    entity_id: payload.campaignId,
    action: "brand_requested_revision",
    metadata: { note, package_version_id: payload.versionId },
  });

  await admin.from("package_events").insert({
    campaign_id: payload.campaignId,
    package_version_id: payload.versionId,
    actor_kind: "brand",
    actor_profile_id: brandProfileId,
    event_type: "revision_requested",
    metadata: note ? { note } : {},
  });

  if (ctx) {
    await notifyAgencyOfBrandAction({
      agencyId: ctx.agencyId,
      campaignId: ctx.campaignId,
      campaignName: ctx.campaignName,
      brandName: ctx.brand.name,
      actionLabel: "requested a revision",
      detail: note,
    });
  }

  revalidatePath(`/p/package/${token}`);
  revalidatePath(`/agency/campaigns/${payload.campaignId}`);
  redirect(`/p/package/${encodeURIComponent(token)}?revision=1`);
}

export async function postBrandMessageAction(formData: FormData) {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) redirect("/");
  const payload = verify(token);

  const body = String(formData.get("body") ?? "").trim();
  if (!body) {
    redirect(`/p/package/${encodeURIComponent(token)}?error=empty_message`);
  }
  if (body.length > 4000) {
    redirect(`/p/package/${encodeURIComponent(token)}?error=message_too_long`);
  }

  const admin = createSupabaseAdminClient();
  const ctx = await loadBrandContext(payload.campaignId);
  const brandProfileId = ctx
    ? await ensureBrandProfile({
        brandId: ctx.brand.id,
        contactEmail: ctx.brand.contact_email,
        brandName: ctx.brand.name,
      })
    : null;

  const { error } = await admin.from("campaign_messages").insert({
    campaign_id: payload.campaignId,
    sender_kind: "brand",
    sender_profile_id: brandProfileId,
    body,
  });

  if (error) {
    redirect(
      `/p/package/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (ctx) {
    await notifyAgencyOfBrandAction({
      agencyId: ctx.agencyId,
      campaignId: ctx.campaignId,
      campaignName: ctx.campaignName,
      brandName: ctx.brand.name,
      actionLabel: "sent a message",
      detail: body.length > 200 ? `${body.slice(0, 200)}…` : body,
    });
  }

  revalidatePath(`/p/package/${token}`);
  revalidatePath(`/agency/campaigns/${payload.campaignId}`);
  redirect(`/p/package/${encodeURIComponent(token)}?message_sent=1#thread`);
}
