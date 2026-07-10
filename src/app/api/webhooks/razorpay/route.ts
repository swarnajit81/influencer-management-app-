/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/log";

// Razorpay sends payout.* and payment.* events.
// Docs: https://razorpay.com/docs/webhooks/validate-test/
// We map payout events onto our payouts.status enum
// (pending / queued / processing / paid / failed / reversed).

const PAYOUT_STATUS_MAP: Record<string, string> = {
  "payout.queued": "queued",
  "payout.initiated": "processing",
  "payout.pending": "processing",
  "payout.processing": "processing",
  "payout.processed": "paid",
  "payout.failed": "failed",
  "payout.rejected": "failed",
  "payout.reversed": "reversed",
};

const TERMINAL = new Set(["paid", "failed", "reversed"]);

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    log.warn("razorpay_webhook_bad_signature", {});
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: any;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const eventType: string = event?.event ?? "";
  const admin = createSupabaseAdminClient();

  if (!eventType.startsWith("payout.")) {
    return NextResponse.json({ received: true, ignored: eventType });
  }

  const payoutEntity = event?.payload?.payout?.entity;
  const razorpayPayoutId: string | undefined = payoutEntity?.id;
  if (!razorpayPayoutId) {
    return NextResponse.json({ error: "missing payout id" }, { status: 400 });
  }

  const nextStatus = PAYOUT_STATUS_MAP[eventType] ?? null;
  if (!nextStatus) {
    return NextResponse.json({ received: true, unmapped: eventType });
  }

  const { data: payout } = await admin
    .from("payouts")
    .select("id, status")
    .eq("razorpay_payout_id", razorpayPayoutId)
    .single();

  if (!payout) {
    log.warn("razorpay_webhook_no_matching_payout", {
      razorpay_payout_id: razorpayPayoutId,
      event: eventType,
    });
    return NextResponse.json({ received: true, no_match: razorpayPayoutId });
  }

  const currentStatus: string = (payout as any).status;
  if (TERMINAL.has(currentStatus) && currentStatus !== nextStatus) {
    return NextResponse.json({ received: true, already: currentStatus });
  }

  const nowIso = new Date().toISOString();
  const update: Record<string, any> = { status: nextStatus, updated_at: nowIso };

  if (nextStatus === "paid") update.completed_at = nowIso;
  if (nextStatus === "failed") {
    update.failure_reason =
      payoutEntity?.failure_reason ?? payoutEntity?.status_details?.description ?? null;
  }
  if (nextStatus === "processing" && !payoutEntity?.utr) {
    // No-op; initiated_at already stamped at create-time.
  }

  await admin
    .from("payouts")
    .update(update)
    .eq("id", (payout as any).id);

  await admin.from("audit_log").insert({
    actor_profile_id: null,
    entity_type: "payout",
    entity_id: (payout as any).id,
    action: `payout_${nextStatus}`,
    metadata: {
      event: eventType,
      razorpay_payout_id: razorpayPayoutId,
      utr: payoutEntity?.utr ?? null,
      failure_reason: update.failure_reason ?? null,
    },
  });

  return NextResponse.json({ received: true, applied: nextStatus });
}
