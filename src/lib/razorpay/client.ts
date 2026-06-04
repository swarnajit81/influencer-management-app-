// Razorpay SDK wrapper.
//
// We use Razorpay Route (X) for marketplace payouts to influencers.
// Flow:
//   1. Onboard influencer -> create RazorpayX Contact + Fund Account (UPI / bank).
//      Persist the IDs on `influencers.razorpay_contact_id` / `razorpay_fund_account_id`.
//   2. On deliverable approval -> create a Payout from the agency virtual account
//      to the influencer's fund account. Persist the payout id on `payouts`.
//   3. Webhook (`/api/webhooks/razorpay`) updates `payouts.status` on success/failure.

import Razorpay from "razorpay";

let _client: Razorpay | null = null;

export function razorpay(): Razorpay {
  if (!_client) {
    _client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _client;
}
