import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";
import { acceptInvitationAction, declineInvitationAction } from "@/app/(auth)/actions";

export default async function InfluencerInvitations({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; declined?: string }>;
}) {
  const { error, declined } = await searchParams;
  const user = await requireRole("influencer");

  const supabase = await createSupabaseServerClient();
  const { data: invitations } = await supabase
    .from("campaign_invitations")
    .select(
      `
      id, status, offer_amount_inr_paise, offer_message, deliverables_summary,
      expires_at, created_at,
      campaigns ( id, name, brief, start_date, end_date,
                  brands ( name ),
                  agencies ( name ) )
    `,
    )
    .eq("influencer_id", user.influencerId)
    .order("created_at", { ascending: false });

  const pending = invitations?.filter((i: any) => i.status === "pending") ?? [];
  const responded = invitations?.filter((i: any) => i.status !== "pending") ?? [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Invitations</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Review pending offers from agencies and brands.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {decodeURIComponent(error)}
        </div>
      )}
      {declined && (
        <div className="mt-4 rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
          Invitation declined.
        </div>
      )}

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Pending</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending invitations.</p>
        ) : (
          <div className="space-y-4">
            {pending.map((inv: any) => {
              const c = Array.isArray(inv.campaigns) ? inv.campaigns[0] : inv.campaigns;
              const brand = Array.isArray(c?.brands) ? c.brands[0] : c?.brands;
              const agency = Array.isArray(c?.agencies) ? c.agencies[0] : c?.agencies;
              return (
                <div
                  key={inv.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{c?.name}</h3>
                      <p className="text-sm text-zinc-500">
                        {brand?.name} · via {agency?.name}
                      </p>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatPaiseAsINR(inv.offer_amount_inr_paise)}
                    </p>
                  </div>

                  {c?.brief && (
                    <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{c.brief}</p>
                  )}
                  {inv.deliverables_summary && (
                    <p className="mt-3 text-sm">
                      <span className="font-medium">Deliverables:</span>{" "}
                      {inv.deliverables_summary}
                    </p>
                  )}
                  {inv.offer_message && (
                    <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-400">
                      “{inv.offer_message}”
                    </p>
                  )}

                  {(c?.start_date || c?.end_date) && (
                    <p className="mt-3 text-xs text-zinc-500">
                      {c.start_date ?? "—"} → {c.end_date ?? "—"}
                    </p>
                  )}

                  <div className="mt-5 flex gap-3">
                    <form action={acceptInvitationAction}>
                      <input type="hidden" name="invitation_id" value={inv.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                      >
                        Accept &amp; sign contract
                      </button>
                    </form>
                    <form action={declineInvitationAction}>
                      <input type="hidden" name="invitation_id" value={inv.id} />
                      <button
                        type="submit"
                        className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {responded.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">History</h2>
          <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">Campaign</th>
                  <th className="px-4 py-2 text-left font-medium">Offer</th>
                  <th className="px-4 py-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {responded.map((inv: any) => {
                  const c = Array.isArray(inv.campaigns) ? inv.campaigns[0] : inv.campaigns;
                  return (
                    <tr key={inv.id}>
                      <td className="px-4 py-2">{c?.name}</td>
                      <td className="px-4 py-2">
                        {formatPaiseAsINR(inv.offer_amount_inr_paise)}
                      </td>
                      <td className="px-4 py-2">
                        <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">
                          {inv.status}
                        </span>
                        {inv.status === "accepted" && (
                          <Link
                            href="/influencer/contracts"
                            className="ml-3 text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                          >
                            View contract →
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
