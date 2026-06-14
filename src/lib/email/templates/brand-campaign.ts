export type BrandCampaignEmailInput = {
  brandName: string;
  agencyName: string;
  campaignName: string;
  campaignUrl: string;
  budgetInr: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBrandCampaignEmail(input: BrandCampaignEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${input.agencyName} started a campaign for ${input.brandName}: ${input.campaignName}`;

  const text = [
    `Hi ${input.brandName} team,`,
    "",
    `${input.agencyName} just started a campaign for ${input.brandName}. You can review the brief, see who's been invited, and approve content as it comes in — all from one link. No signup needed.`,
    "",
    `Campaign: ${input.campaignName}`,
    `Budget: ${input.budgetInr}`,
    "",
    `Open your campaign status page:`,
    input.campaignUrl,
    "",
    "— Sent via PR Platform",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <h1 style="margin:0 0 8px;font-size:20px;">Your campaign is live</h1>
      <p style="margin:0 0 16px;color:#6b7280;">Hi ${escapeHtml(input.brandName)} team,</p>
      <p style="margin:0 0 16px;">
        <strong>${escapeHtml(input.agencyName)}</strong> just started a campaign for
        <strong>${escapeHtml(input.brandName)}</strong>. Review the brief, see who&apos;s
        been invited, and approve content as it comes in — all from one link.
        No signup needed.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:12px 16px;background:#f3f4f6;border-radius:8px;">
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Campaign</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">${escapeHtml(input.campaignName)}</div>
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-top:12px;">Budget</div>
            <div style="font-size:18px;font-weight:700;margin-top:4px;">${escapeHtml(input.budgetInr)}</div>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;">
        <a href="${escapeHtml(input.campaignUrl)}"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          Open campaign page
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Bookmark this link — we&apos;ll keep it live for the duration of the campaign.</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
