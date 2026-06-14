/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaiseAsINR } from "@/lib/money";
import { initiatePayoutAction } from "@/app/(auth)/actions";

type PageProps = {
  searchParams: Promise<{
    initiated?: string;
    error?: string;
    details?: string;
  }>;
};

const ERROR_LABELS: Record<string, string> = {
  invalid_input: "Invalid input.",
  not_found: "Deliverable not found.",
  not_yours: "That deliverable isn't on one of your campaigns.",
  already_initiated: "A payout is already in flight for this deliverable.",
  missing_bank_details:
    "Influencer is missing bank account number, IFSC, or holder name. Set those on the influencer detail page first.",
  no_account_number:
    "RAZORPAY_ACCOUNT_NUMBER is not set in the environment. Add the agency's RazorpayX virtual account number to .env.local.",
  razorpay_error: "Razorpay rejected the payout.",
  db_insert_failed: "Couldn't write the payout row.",
};

export default async function PayoutsPage({ searchParams }: PageProps) {
  const user = await requireAgencyMember();
  const { initiated, error, details } = await searchParams;

  const supabase = await createSupabaseServerClient();

  const [deliverablesRes, payoutsRes] = await Promise.all([
    supabase
      .from("deliverables")
      .select(
        `id, type, status, amount_inr_paise, due_date,
         contracts!inner (
           id, influencer_id,
           campaigns!inner ( id, name, agency_id, brand_id, brands ( name ) ),
           influencers!inner ( id, display_name )
         ),
         payouts ( id, status )`,
      )
      .in("status", ["approved", "live"])
      .eq("contracts.campaigns.agency_id", user.agencyId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("payouts")
      .select(
        `id, status, amount_inr_paise, created_at, completed_at,
         razorpay_payout_id, failure_reason,
         deliverable_id, influencer_id,
         contracts!inner ( campaigns!inner ( name, agency_id ) ),
         influencers ( display_name )`,
      )
      .eq("contracts.campaigns.agency_id", user.agencyId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const deliverables = (deliverablesRes.data ?? []) as any[];
  const payouts = (payoutsRes.data ?? []) as any[];

  const payable = deliverables.filter((d) => {
    const ps = (d.payouts ?? []) as any[];
    return !ps.some((p) => ["pending", "queued", "processing", "paid"].includes(p.status));
  });

  const inFlight = payouts.filter((p) =>
    ["pending", "queued", "processing"].includes(p.status),
  );
  const completed = payouts.filter((p) => p.status === "paid");
  const failed = payouts.filter((p) => ["failed", "reversed"].includes(p.status));

  const errorMessage = error
    ? `${ERROR_LABELS[error] ?? decodeURIComponent(error)}${
        details ? ` — ${decodeURIComponent(details)}` : ""
      }`
    : null;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Initiate INR payouts to influencers via Razorpay Route. GST / TDS are handled natively.
        </p>
      </div>

      {initiated && (
        <p className="rounded-md bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          Payout initiated. We&apos;ll update the status as Razorpay reports it.
        </p>
      )}
      {errorMessage && (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <section>
        <h2 className="text-lg font-semibold">Ready to pay ({payable.length})</h2>
        {payable.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            Nothing to pay right now. Approved or live deliverables show up here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {payable.map((d) => {
              const contract = Array.isArray(d.contracts) ? d.contracts[0] : d.contracts;
              const campaign = Array.isArray(contract?.campaigns)
                ? contract.campaigns[0]
                : contract?.campaigns;
              const brand = Array.isArray(campaign?.brands)
                ? campaign.brands[0]
                : campaign?.brands;
              const inf = Array.isArray(contract?.influencers)
                ? contract.influencers[0]
                : contract?.influencers;
              return (
                <li
                  key={d.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="text-sm">
                    <div className="font-medium">{inf?.display_name ?? "Influencer"}</div>
                    <div className="text-xs text-zinc-500">
                      {campaign?.name} · {brand?.name} · {d.type.replace(/_/g, " ")}
                    </div>
                    {d.due_date && (
                      <div className="text-xs text-zinc-500">Due {d.due_date}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatPaiseAsINR(d.amount_inr_paise)}
                      </div>
                      <div className="text-xs text-zinc-500">{d.status}</div>
                    </div>
                    <form action={initiatePayoutAction}>
                      <input type="hidden" name="deliverable_id" value={d.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Initiate payout
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PayoutSection title="In flight" items={inFlight} emptyText="No payouts in flight." />
      <PayoutSection title="Completed" items={completed} emptyText="No completed payouts yet." />
      <PayoutSection
        title="Failed or reversed"
        items={failed}
        emptyText="No failed or reversed payouts."
      />
    </div>
  );
}

function PayoutSection({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: any[];
  emptyText: string;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">{emptyText}</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {items.map((p) => {
            const contract = Array.isArray(p.contracts) ? p.contracts[0] : p.contracts;
            const campaign = Array.isArray(contract?.campaigns)
              ? contract.campaigns[0]
              : contract?.campaigns;
            const inf = Array.isArray(p.influencers) ? p.influencers[0] : p.influencers;
            return (
              <li key={p.id} className="p-4 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/agency/influencers/${p.influencer_id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {inf?.display_name ?? "Influencer"}
                    </Link>
                    <div className="text-xs text-zinc-500">
                      {campaign?.name} ·{" "}
                      {new Date(p.created_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </div>
                    {p.razorpay_payout_id && (
                      <div className="text-xs text-zinc-500 font-mono">
                        {p.razorpay_payout_id}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{formatPaiseAsINR(p.amount_inr_paise)}</div>
                    <div className="text-xs text-zinc-500">{p.status}</div>
                  </div>
                </div>
                {p.failure_reason && (
                  <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
                    {p.failure_reason}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
