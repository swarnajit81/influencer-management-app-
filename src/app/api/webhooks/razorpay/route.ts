import { NextResponse } from "next/server";
import crypto from "node:crypto";

// Razorpay sends payout.* and payment.* events.
// Verify the signature with RAZORPAY_WEBHOOK_SECRET, then update `payouts.status`.
// Docs: https://razorpay.com/docs/webhooks/validate-test/

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");

  if (expected !== signature) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  // TODO: parse event, look up payout by razorpay_payout_id, update status,
  // write to audit_log.
  return NextResponse.json({ received: true });
}
