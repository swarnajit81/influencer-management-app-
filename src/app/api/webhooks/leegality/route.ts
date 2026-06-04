import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchSignedPdfUrl, type LeegalityWebhookEvent } from "@/lib/leegality/client";

// Leegality fires events when an invitation is sent, signed, completed, rejected,
// or expired. Verify the HMAC signature, then advance `contracts.status`.
//
// Leegality computes HMAC-SHA256(body, LEEGALITY_WEBHOOK_SECRET) and sends it
// in the `x-leegality-signature` header (lowercase hex).
// Docs: https://docs.leegality.com/

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-leegality-signature") ?? "";

  const secret = process.env.LEEGALITY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });
  }

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: LeegalityWebhookEvent;
  try {
    event = JSON.parse(body) as LeegalityWebhookEvent;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const invitationId = event.invitationId ?? event.invitation?.invitationId;
  if (!invitationId) {
    return NextResponse.json({ error: "missing invitationId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Reusing digio_document_id column; stores Leegality invitationId.
  const { data: contract } = await admin
    .from("contracts")
    .select("id, status, influencer_signed_at, brand_signed_at")
    .eq("digio_document_id", invitationId)
    .single();

  if (!contract) {
    return NextResponse.json({ received: true, matched: false });
  }

  const update: Record<string, unknown> = {};
  const nowIso = new Date().toISOString();
  const evt = (event.event ?? "").toUpperCase();
  const status = (event.invitation?.status ?? "").toUpperCase();

  if (evt.includes("REJECTED") || status === "REJECTED") {
    update.status = "cancelled";
    update.declined_at = nowIso;
    update.declined_reason = "rejected_by_signer";
  } else if (evt.includes("EXPIRED") || status === "EXPIRED") {
    update.status = "cancelled";
    update.declined_reason = "expired";
  } else if (evt.includes("COMPLETED") || status === "COMPLETED") {
    update.status = "fully_signed";
    if (!(contract as any).influencer_signed_at) update.influencer_signed_at = nowIso;
    if (!(contract as any).brand_signed_at) update.brand_signed_at = nowIso;
    const url = event.signedFileUrl ?? (await fetchSignedPdfUrl(invitationId).catch(() => null));
    if (url) update.signed_pdf_url = url;
  } else if (evt.includes("SIGNED") || status.includes("SIGNED")) {
    const signers = event.invitation?.signers ?? [];
    const allSigned =
      signers.length > 0 &&
      signers.every((s) => (s.status ?? "").toUpperCase() === "SIGNED");
    if (allSigned) {
      update.status = "fully_signed";
      update.influencer_signed_at = (contract as any).influencer_signed_at ?? nowIso;
      update.brand_signed_at = (contract as any).brand_signed_at ?? nowIso;
      const url =
        event.signedFileUrl ?? (await fetchSignedPdfUrl(invitationId).catch(() => null));
      if (url) update.signed_pdf_url = url;
    } else {
      // v1 only sends to influencer; treat any SIGNED event as influencer-signed.
      update.status = "signed_by_influencer";
      update.influencer_signed_at = (contract as any).influencer_signed_at ?? nowIso;
    }
  }

  if (Object.keys(update).length > 0) {
    await admin.from("contracts").update(update).eq("id", (contract as any).id);
    await admin.from("audit_log").insert({
      entity_type: "contract",
      entity_id: (contract as any).id,
      action: `leegality_${(event.event ?? "event").toLowerCase()}`,
      metadata: { invitation_id: invitationId, status, update },
    });
  }

  return NextResponse.json({ received: true });
}
