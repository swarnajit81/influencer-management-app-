import { sendEmail } from "@/lib/email/resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return new URL(path, base).toString();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Send a lightweight inline notification to every agency owner when the brand
// takes an action on a package. Not a batched digest — one email per event.
// Batched digest can come in a later sprint if this gets noisy.
export async function notifyAgencyOfBrandAction(params: {
  agencyId: string;
  campaignId: string;
  campaignName: string;
  brandName: string | null;
  actionLabel: string;
  detail?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: recipients } = await admin
    .from("agency_members")
    .select("profile_id, profiles!inner ( email, full_name )")
    .eq("agency_id", params.agencyId)
    .eq("role", "owner");

  if (!recipients || recipients.length === 0) return;

  const campaignUrl = appUrl(`/agency/campaigns/${params.campaignId}`);
  const subject = `${params.brandName ?? "Brand"} ${params.actionLabel} on ${params.campaignName}`;
  const html = `
    <p>Hi,</p>
    <p><strong>${escapeHtml(params.brandName ?? "Brand")}</strong>
    ${escapeHtml(params.actionLabel)} on
    <strong>${escapeHtml(params.campaignName)}</strong>.</p>
    ${params.detail ? `<blockquote>${escapeHtml(params.detail)}</blockquote>` : ""}
    <p><a href="${campaignUrl}">Open campaign</a></p>
  `;
  const text = [
    `${params.brandName ?? "Brand"} ${params.actionLabel} on ${params.campaignName}.`,
    params.detail ? `\n"${params.detail}"` : "",
    `\nOpen: ${campaignUrl}`,
  ].join("");

  for (const r of recipients) {
    const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    if (!profile?.email) continue;
    const result = await sendEmail({
      to: profile.email,
      subject,
      html,
      text,
    });
    await admin.from("audit_log").insert({
      actor_profile_id: null,
      entity_type: "campaign",
      entity_id: params.campaignId,
      action: result.ok ? "agency_notify_sent" : "agency_notify_failed",
      metadata: result.ok
        ? { provider: "resend", to: profile.email, email_id: result.id }
        : { provider: "resend", to: profile.email, reason: result.reason, error: result.message },
    });
  }
}
