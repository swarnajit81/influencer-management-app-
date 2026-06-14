import { formatPaiseAsINR } from "@/lib/money";

export type InvitationEmailInput = {
  influencerName: string;
  agencyName: string;
  brandName: string;
  campaignName: string;
  offerAmountPaise: number;
  offerMessage: string | null;
  invitationUrl: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildInvitationEmail(input: InvitationEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const offerInr = formatPaiseAsINR(input.offerAmountPaise);
  const subject = `${input.agencyName} invited you to a campaign for ${input.brandName}`;

  const text = [
    `Hi ${input.influencerName},`,
    "",
    `${input.agencyName} has invited you to collaborate on a campaign for ${input.brandName}.`,
    "",
    `Campaign: ${input.campaignName}`,
    `Offer: ${offerInr}`,
    ...(input.offerMessage ? ["", `Message from ${input.agencyName}:`, input.offerMessage] : []),
    "",
    `Review and respond here:`,
    input.invitationUrl,
    "",
    "— Sent via PR Platform",
  ].join("\n");

  const messageBlock = input.offerMessage
    ? `<p style="margin:16px 0 0;color:#374151;white-space:pre-wrap;"><strong>Message from ${escapeHtml(input.agencyName)}:</strong><br>${escapeHtml(input.offerMessage)}</p>`
    : "";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <h1 style="margin:0 0 8px;font-size:20px;">New campaign invitation</h1>
      <p style="margin:0 0 24px;color:#6b7280;">Hi ${escapeHtml(input.influencerName)},</p>
      <p style="margin:0 0 16px;">
        <strong>${escapeHtml(input.agencyName)}</strong> has invited you to collaborate on a campaign for
        <strong>${escapeHtml(input.brandName)}</strong>.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:12px 16px;background:#f3f4f6;border-radius:8px;">
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Campaign</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">${escapeHtml(input.campaignName)}</div>
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-top:16px;">Offer</div>
            <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(offerInr)}</div>
          </td>
        </tr>
      </table>
      ${messageBlock}
      <p style="margin:24px 0 0;">
        <a href="${escapeHtml(input.invitationUrl)}"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          Review invitation
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Sent via PR Platform on behalf of ${escapeHtml(input.agencyName)}.</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
