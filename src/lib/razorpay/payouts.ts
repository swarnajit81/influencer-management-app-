/* eslint-disable @typescript-eslint/no-explicit-any */
import { razorpay } from "./client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type InfluencerForPayout = {
  id: string;
  display_name: string;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  bank_account_holder_name: string | null;
  razorpay_contact_id: string | null;
  razorpay_fund_account_id: string | null;
  profile_id: string;
  email: string;
  full_name: string | null;
};

export type EnsurePayoutsResult =
  | { ok: true; contactId: string; fundAccountId: string }
  | {
      ok: false;
      reason: "missing_bank_details" | "razorpay_error";
      message?: string;
    };

async function loadInfluencerForPayout(
  influencerId: string,
): Promise<InfluencerForPayout | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("influencers")
    .select(
      `id, display_name, bank_account_number, bank_ifsc, bank_account_holder_name,
       razorpay_contact_id, razorpay_fund_account_id, profile_id,
       profiles ( email, full_name )`,
    )
    .eq("id", influencerId)
    .single();

  if (!data) return null;
  const row = data as any;
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return {
    id: row.id,
    display_name: row.display_name,
    bank_account_number: row.bank_account_number,
    bank_ifsc: row.bank_ifsc,
    bank_account_holder_name: row.bank_account_holder_name,
    razorpay_contact_id: row.razorpay_contact_id,
    razorpay_fund_account_id: row.razorpay_fund_account_id,
    profile_id: row.profile_id,
    email: profile?.email ?? "",
    full_name: profile?.full_name ?? null,
  };
}

export async function ensureInfluencerPayoutSetup(
  influencerId: string,
): Promise<EnsurePayoutsResult> {
  const inf = await loadInfluencerForPayout(influencerId);
  if (!inf) return { ok: false, reason: "missing_bank_details" };

  if (!inf.bank_account_number || !inf.bank_ifsc || !inf.bank_account_holder_name) {
    return { ok: false, reason: "missing_bank_details" };
  }

  const rzp = razorpay() as any;
  const admin = createSupabaseAdminClient();

  let contactId = inf.razorpay_contact_id;
  let fundAccountId = inf.razorpay_fund_account_id;

  try {
    if (!contactId) {
      const contact = await rzp.contacts.create({
        name: inf.display_name || inf.full_name || "Influencer",
        email: inf.email || undefined,
        type: "vendor",
        reference_id: inf.id,
      });
      contactId = contact.id;
      await admin
        .from("influencers")
        .update({ razorpay_contact_id: contactId })
        .eq("id", inf.id);
    }

    if (!fundAccountId) {
      const fundAccount = await rzp.fundAccount.create({
        contact_id: contactId,
        account_type: "bank_account",
        bank_account: {
          name: inf.bank_account_holder_name,
          ifsc: inf.bank_ifsc,
          account_number: inf.bank_account_number,
        },
      });
      fundAccountId = fundAccount.id;
      await admin
        .from("influencers")
        .update({ razorpay_fund_account_id: fundAccountId })
        .eq("id", inf.id);
    }

    return {
      ok: true,
      contactId: contactId!,
      fundAccountId: fundAccountId!,
    };
  } catch (err: any) {
    return {
      ok: false,
      reason: "razorpay_error",
      message: err?.error?.description ?? err?.message ?? "razorpay_failed",
    };
  }
}

export type CreatePayoutInput = {
  influencerId: string;
  contractId: string;
  deliverableId?: string;
  amountPaise: number;
  purpose?: string;
  narration?: string;
};

export type CreatePayoutResult =
  | { ok: true; payoutId: string; razorpayPayoutId: string }
  | { ok: false; reason: string; message?: string };

export async function createInfluencerPayout(
  input: CreatePayoutInput,
): Promise<CreatePayoutResult> {
  const accountNumber = process.env.RAZORPAY_ACCOUNT_NUMBER;
  if (!accountNumber) {
    return { ok: false, reason: "no_account_number" };
  }

  const setup = await ensureInfluencerPayoutSetup(input.influencerId);
  if (!setup.ok) {
    return { ok: false, reason: setup.reason, message: setup.message };
  }

  const admin = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Create the payout row up-front so we always have an ID even if the
  // Razorpay call fails partway through — easier to reconcile.
  const { data: payoutRow, error: insertErr } = await admin
    .from("payouts")
    .insert({
      contract_id: input.contractId,
      deliverable_id: input.deliverableId ?? null,
      influencer_id: input.influencerId,
      amount_inr_paise: input.amountPaise,
      status: "pending",
      initiated_at: nowIso,
    })
    .select("id")
    .single();

  if (insertErr || !payoutRow) {
    return { ok: false, reason: "db_insert_failed", message: insertErr?.message };
  }

  const rzp = razorpay() as any;
  try {
    const payout = await rzp.payouts.create({
      account_number: accountNumber,
      fund_account_id: setup.fundAccountId,
      amount: input.amountPaise,
      currency: "INR",
      mode: "IMPS",
      purpose: input.purpose ?? "payout",
      queue_if_low_balance: true,
      reference_id: (payoutRow as any).id,
      narration: input.narration ?? "Influencer payout",
    });

    await admin
      .from("payouts")
      .update({
        razorpay_payout_id: payout.id,
        status: payout.status === "queued" ? "queued" : "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", (payoutRow as any).id);

    return {
      ok: true,
      payoutId: (payoutRow as any).id,
      razorpayPayoutId: payout.id,
    };
  } catch (err: any) {
    const message =
      err?.error?.description ?? err?.message ?? "razorpay_payout_failed";
    await admin
      .from("payouts")
      .update({
        status: "failed",
        failure_reason: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (payoutRow as any).id);
    return { ok: false, reason: "razorpay_error", message };
  }
}
