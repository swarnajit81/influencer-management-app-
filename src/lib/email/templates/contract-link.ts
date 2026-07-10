export type ContractLinkContext = "accepted" | "changes_requested";

export type ContractLinkEmailInput = {
  context: ContractLinkContext;
  influencerName: string;
  agencyName: string;
  brandName: string;
  campaignName: string;
  contractUrl: string;
  feedback?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildContractLinkEmail(input: ContractLinkEmailInput): {
  subject: string;
  html: string;
  text: string;
} {
  const isAccepted = input.context === "accepted";

  const subject = isAccepted
    ? `Your contract with ${input.agencyName} for ${input.brandName}`
    : `${input.agencyName} has requested changes on your submission`;

  const headline = isAccepted
    ? "Your contract is ready"
    : "Changes requested on your submission";

  const intro = isAccepted
    ? `Thanks for accepting. Here's your contract page for the ${input.brandName} campaign with ${input.agencyName}. Bookmark it — you can come back any time to submit deliverables or check status.`
    : `${input.agencyName} reviewed your submission for the ${input.brandName} campaign and would like a revision. Open your contract page to resubmit.`;

  const cta = isAccepted ? "Open contract" : "Open contract & resubmit";

  const feedbackBlock =
    !isAccepted && input.feedback
      ? `<div style="margin-top:16px;padding:12px 16px;background:#fffbeb;border-left:4px solid #f59e0b;border-radius:4px;">
           <div style="font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.04em;font-weight:600;">Feedback</div>
           <p style="margin:8px 0 0;color:#78350f;white-space:pre-wrap;">${escapeHtml(input.feedback)}</p>
         </div>`
      : "";

  const feedbackText =
    !isAccepted && input.feedback
      ? ["", "Feedback:", input.feedback, ""]
      : [];

  const text = [
    `Hi ${input.influencerName},`,
    "",
    intro,
    ...feedbackText,
    "",
    `Campaign: ${input.campaignName}`,
    `Brand: ${input.brandName}`,
    "",
    `Contract page:`,
    input.contractUrl,
    "",
    "— Sent via PR Platform",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <h1 style="margin:0 0 8px;font-size:20px;">${escapeHtml(headline)}</h1>
      <p style="margin:0 0 16px;color:#6b7280;">Hi ${escapeHtml(input.influencerName)},</p>
      <p style="margin:0 0 16px;">${escapeHtml(intro)}</p>
      ${feedbackBlock}
      <table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr>
          <td style="padding:12px 16px;background:#f3f4f6;border-radius:8px;">
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Campaign</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">${escapeHtml(input.campaignName)}</div>
            <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-top:12px;">Brand</div>
            <div style="font-size:16px;font-weight:600;margin-top:4px;">${escapeHtml(input.brandName)}</div>
          </td>
        </tr>
      </table>
      <p style="margin:20px 0 0;">
        <a href="${escapeHtml(input.contractUrl)}"
           style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">
          ${escapeHtml(cta)}
        </a>
      </p>
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">Sent via PR Platform on behalf of ${escapeHtml(input.agencyName)}.</p>
    </div>
  </body>
</html>`;

  return { subject, html, text };
}
