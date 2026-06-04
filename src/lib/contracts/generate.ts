// Contract HTML + minimal PDF builder.
//
// We render a plain-text contract and wrap it in a hand-rolled PDF (Helvetica)
// so we don't pull a PDF dependency. Digio's /uploadpdf endpoint accepts
// base64 PDF payloads.

import { formatPaiseAsINR } from "@/lib/money";

export type ContractData = {
  campaignName: string;
  brandName: string;
  agencyName: string;
  influencerName: string;
  influencerEmail: string;
  totalAmountInrPaise: number | bigint;
  paymentTerms: string;
  deliverablesSummary: string | null;
  offerMessage: string | null;
  startDate: string | null;
  endDate: string | null;
  effectiveDate: string; // yyyy-mm-dd
};

export function buildContractHtml(d: ContractData): string {
  const amount = formatPaiseAsINR(d.totalAmountInrPaise);
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Influencer Marketing Agreement</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:2rem auto;padding:0 1rem;line-height:1.55;color:#111}h1{font-size:1.4rem}h2{font-size:1.05rem;margin-top:1.5rem}p{margin:.6rem 0}.kv{margin:.25rem 0}.kv b{display:inline-block;min-width:160px}</style>
</head><body>
<h1>Influencer Marketing Agreement</h1>
<p>This Agreement is made effective on <b>${escapeHtml(d.effectiveDate)}</b> between
<b>${escapeHtml(d.agencyName)}</b> (acting on behalf of <b>${escapeHtml(d.brandName)}</b>, the "Brand"),
and <b>${escapeHtml(d.influencerName)}</b> (the "Influencer", ${escapeHtml(d.influencerEmail)}).</p>

<h2>1. Scope</h2>
<p>The Influencer agrees to produce promotional content for the Brand under the campaign
"<b>${escapeHtml(d.campaignName)}</b>".</p>
${d.deliverablesSummary ? `<p><b>Deliverables:</b> ${escapeHtml(d.deliverablesSummary)}</p>` : ""}
${d.offerMessage ? `<p><b>Notes:</b> ${escapeHtml(d.offerMessage)}</p>` : ""}

<h2>2. Compensation</h2>
<p class="kv"><b>Total fee:</b> ${escapeHtml(amount)}</p>
<p class="kv"><b>Payment terms:</b> ${escapeHtml(d.paymentTerms)}</p>
<p>Payouts are processed via Razorpay to the Influencer's verified bank account on file.</p>

<h2>3. Term</h2>
<p class="kv"><b>Start date:</b> ${escapeHtml(d.startDate ?? "On signing")}</p>
<p class="kv"><b>End date:</b> ${escapeHtml(d.endDate ?? "On final deliverable approval")}</p>

<h2>4. Content rights</h2>
<p>The Influencer grants the Brand a non-exclusive, worldwide, royalty-free license to
use, reproduce, and distribute the deliverables for marketing purposes for 12 months
from the date of publication.</p>

<h2>5. Confidentiality</h2>
<p>Both parties shall keep campaign briefs, fees, and unreleased creative confidential.</p>

<h2>6. Termination</h2>
<p>Either party may terminate for material breach with 7 days' written notice. Fees for
work already delivered remain payable.</p>

<h2>7. Governing law</h2>
<p>This Agreement is governed by the laws of India. Disputes shall be resolved by the
courts at Bengaluru, Karnataka.</p>

<p style="margin-top:2rem">By electronically signing this document via Digio Aadhaar e-sign,
the Influencer accepts these terms.</p>
</body></html>`;
}

export function buildContractPlainText(d: ContractData): string {
  const amount = formatPaiseAsINR(d.totalAmountInrPaise);
  return [
    "INFLUENCER MARKETING AGREEMENT",
    "",
    `Effective date: ${d.effectiveDate}`,
    `Agency: ${d.agencyName}`,
    `Brand: ${d.brandName}`,
    `Influencer: ${d.influencerName} (${d.influencerEmail})`,
    `Campaign: ${d.campaignName}`,
    "",
    "1. SCOPE",
    "The Influencer agrees to produce promotional content for the Brand",
    `under the campaign "${d.campaignName}".`,
    ...(d.deliverablesSummary ? ["", "Deliverables:", d.deliverablesSummary] : []),
    ...(d.offerMessage ? ["", "Notes:", d.offerMessage] : []),
    "",
    "2. COMPENSATION",
    `Total fee: ${amount}`,
    `Payment terms: ${d.paymentTerms}`,
    "Payouts are processed via Razorpay to the Influencer's verified bank account.",
    "",
    "3. TERM",
    `Start date: ${d.startDate ?? "On signing"}`,
    `End date: ${d.endDate ?? "On final deliverable approval"}`,
    "",
    "4. CONTENT RIGHTS",
    "The Influencer grants the Brand a non-exclusive, worldwide, royalty-free",
    "license to use, reproduce, and distribute the deliverables for marketing",
    "purposes for 12 months from the date of publication.",
    "",
    "5. CONFIDENTIALITY",
    "Both parties shall keep campaign briefs, fees, and unreleased creative",
    "confidential.",
    "",
    "6. TERMINATION",
    "Either party may terminate for material breach with 7 days' written notice.",
    "Fees for work already delivered remain payable.",
    "",
    "7. GOVERNING LAW",
    "This Agreement is governed by the laws of India. Disputes shall be resolved",
    "by the courts at Bengaluru, Karnataka.",
    "",
    "By electronically signing this document via Digio Aadhaar e-sign,",
    "the Influencer accepts these terms.",
  ].join("\n");
}

// Build a minimal one-or-more page PDF (Helvetica 11pt) from plain text.
// Returns base64-encoded PDF, suitable for Digio /uploadpdf file_data.
export function buildContractPdfBase64(text: string): string {
  const PAGE_W = 612;
  const PAGE_H = 792;
  const MARGIN_X = 54;
  const MARGIN_Y = 54;
  const FONT_SIZE = 11;
  const LEADING = 15;
  const MAX_CHARS = 88;
  const MAX_LINES = Math.floor((PAGE_H - 2 * MARGIN_Y) / LEADING);

  const wrapped: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.length === 0) {
      wrapped.push("");
      continue;
    }
    let line = raw;
    while (line.length > MAX_CHARS) {
      let cut = line.lastIndexOf(" ", MAX_CHARS);
      if (cut < 20) cut = MAX_CHARS;
      wrapped.push(line.slice(0, cut));
      line = line.slice(cut).trimStart();
    }
    wrapped.push(line);
  }

  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += MAX_LINES) {
    pages.push(wrapped.slice(i, i + MAX_LINES));
  }
  if (pages.length === 0) pages.push([""]);

  const escapePdfText = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  const pageContents = pages.map((lines) => {
    const ops: string[] = [];
    ops.push("BT");
    ops.push(`/F1 ${FONT_SIZE} Tf`);
    ops.push(`${LEADING} TL`);
    ops.push(`${MARGIN_X} ${PAGE_H - MARGIN_Y} Td`);
    lines.forEach((l, idx) => {
      ops.push(`(${escapePdfText(l)}) Tj`);
      if (idx < lines.length - 1) ops.push("T*");
    });
    ops.push("ET");
    return ops.join("\n");
  });

  // Object layout:
  //   1: Catalog
  //   2: Pages
  //   3: Font Helvetica
  //   4..(3+N): Page objects
  //   (4+N)..(3+2N): Page content streams
  const N = pages.length;
  const pageObjStart = 4;
  const contentObjStart = 4 + N;
  const totalObjs = 3 + 2 * N;

  const objects: string[] = [];
  objects.push(""); // 0 placeholder
  // 1: Catalog
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  // 2: Pages
  const kids = Array.from({ length: N }, (_, i) => `${pageObjStart + i} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${N} >>`);
  // 3: Font
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  // 4..3+N: Pages
  for (let i = 0; i < N; i++) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
        `/Resources << /Font << /F1 3 0 R >> >> ` +
        `/Contents ${contentObjStart + i} 0 R >>`,
    );
  }
  // 4+N..3+2N: Content streams
  for (let i = 0; i < N; i++) {
    const stream = pageContents[i];
    objects.push(`<< /Length ${Buffer.byteLength(stream, "binary")} >>\nstream\n${stream}\nendstream`);
  }

  // Assemble
  let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets: number[] = [0];
  for (let i = 1; i <= totalObjs; i++) {
    offsets.push(Buffer.byteLength(out, "binary"));
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(out, "binary");
  out += `xref\n0 ${totalObjs + 1}\n`;
  out += "0000000000 65535 f \n";
  for (let i = 1; i <= totalObjs; i++) {
    out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(out, "binary").toString("base64");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
