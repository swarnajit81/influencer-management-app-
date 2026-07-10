/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { updateInfluencerBankAction } from "@/app/(auth)/actions";
import { formatPaiseAsINR } from "@/lib/money";

type PageProps = {
  params: Promise<{ influencerId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function InfluencerDetailPage({ params, searchParams }: PageProps) {
  const user = await requireAgencyMember();
  const { influencerId } = await params;
  const { saved, error } = await searchParams;

  const supabase = await createSupabaseServerClient();
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select(
      `notes,
       influencers!inner (
         id, display_name, instagram_handle, youtube_handle, twitter_handle,
         primary_platform, follower_count_total, city, state,
         bank_account_number, bank_ifsc, bank_account_holder_name, pan, gstin,
         razorpay_contact_id, razorpay_fund_account_id,
         profiles ( email, full_name )
       )`,
    )
    .eq("agency_id", user.agencyId)
    .eq("influencer_id", influencerId)
    .single();

  if (!roster) notFound();

  const r = roster as any;
  const inf = Array.isArray(r.influencers) ? r.influencers[0] : r.influencers;
  const profile = Array.isArray(inf?.profiles) ? inf.profiles[0] : inf?.profiles;

  // Past payouts to this influencer (from this agency's contracts)
  const { data: payouts } = await supabase
    .from("payouts")
    .select(
      `id, status, amount_inr_paise, created_at, razorpay_payout_id, failure_reason,
       contracts!inner ( campaigns!inner ( name, agency_id ) )`,
    )
    .eq("influencer_id", influencerId)
    .eq("contracts.campaigns.agency_id", user.agencyId)
    .order("created_at", { ascending: false })
    .limit(20);

  const accountMasked = inf.bank_account_number
    ? `••• ${String(inf.bank_account_number).slice(-4)}`
    : "Not set";

  return (
    <div className="space-y-8">
      <div>
        <Link href="/agency/influencers" className="text-sm text-zinc-500 hover:underline">
          ← Back to influencers
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{inf.display_name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {profile?.email}
          {inf.instagram_handle && ` · @${inf.instagram_handle}`}
        </p>
      </div>

      {saved && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Saved.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {decodeURIComponent(error)}
        </p>
      )}

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-base font-semibold">Profile</h2>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Primary platform" value={inf.primary_platform ?? "—"} />
          <Row
            label="Followers"
            value={Number(inf.follower_count_total ?? 0).toLocaleString("en-IN")}
          />
          <Row label="City / State" value={[inf.city, inf.state].filter(Boolean).join(", ") || "—"} />
          <Row label="Instagram" value={inf.instagram_handle ? `@${inf.instagram_handle}` : "—"} />
          <Row label="YouTube" value={inf.youtube_handle ? `@${inf.youtube_handle}` : "—"} />
          <Row label="Twitter" value={inf.twitter_handle ? `@${inf.twitter_handle}` : "—"} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Bank details for payouts</h2>
          <span className="text-xs text-zinc-500">
            {inf.razorpay_fund_account_id ? "Razorpay fund account ready" : "Not yet linked to Razorpay"}
          </span>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Required before any payout can be sent. Razorpay Route handles GST / TDS on Indian payouts.
        </p>
        <form action={updateInfluencerBankAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="influencer_id" value={inf.id} />
          <Field label={`Account number (currently ${accountMasked})`}>
            <input
              type="text"
              name="bank_account_number"
              defaultValue={inf.bank_account_number ?? ""}
              className="input"
              maxLength={20}
            />
          </Field>
          <Field label="IFSC">
            <input
              type="text"
              name="bank_ifsc"
              defaultValue={inf.bank_ifsc ?? ""}
              className="input"
              maxLength={11}
              placeholder="HDFC0001234"
            />
          </Field>
          <Field label="Account holder name" className="sm:col-span-2">
            <input
              type="text"
              name="bank_account_holder_name"
              defaultValue={inf.bank_account_holder_name ?? ""}
              className="input"
            />
          </Field>
          <Field label="PAN">
            <input
              type="text"
              name="pan"
              defaultValue={inf.pan ?? ""}
              className="input"
              maxLength={10}
            />
          </Field>
          <Field label="GSTIN (optional)">
            <input
              type="text"
              name="gstin"
              defaultValue={inf.gstin ?? ""}
              className="input"
              maxLength={15}
            />
          </Field>
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Save bank details
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="text-base font-semibold">Payout history</h2>
        {!payouts || payouts.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No payouts yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {payouts.map((p: any) => {
              const camp = Array.isArray(p.contracts?.campaigns)
                ? p.contracts.campaigns[0]
                : p.contracts?.campaigns;
              return (
                <li key={p.id} className="px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{camp?.name ?? "Campaign"}</div>
                      <div className="text-xs text-zinc-500">
                        {new Date(p.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatPaiseAsINR(p.amount_inr_paise)}</div>
                      <div className="text-xs text-zinc-500">{p.status}</div>
                    </div>
                  </div>
                  {p.failure_reason && (
                    <p className="mt-1 text-xs text-red-600">{p.failure_reason}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1">{value}</div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
