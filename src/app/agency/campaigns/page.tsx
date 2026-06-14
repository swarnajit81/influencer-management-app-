import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";

export default async function AgencyCampaigns({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select(
      `
      id,
      name,
      brief,
      status,
      total_budget_inr_paise,
      start_date,
      end_date,
      brands (name)
    `,
    )
    .eq("agency_id", user.agencyId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link
          href="/agency/campaigns/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New campaign
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {campaigns && campaigns.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Campaign</th>
                <th className="px-4 py-3 text-left font-medium">Brand</th>
                <th className="px-4 py-3 text-left font-medium">Budget</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Dates</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {campaigns.map((c: any) => (
                <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link href={`/agency/campaigns/${c.id}`} className="font-medium hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {c.brands?.name}
                  </td>
                  <td className="px-4 py-3">{formatPaiseAsINR(c.total_budget_inr_paise)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                    {c.start_date && c.end_date
                      ? `${c.start_date} → ${c.end_date}`
                      : "–"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-12 text-center dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-500">No campaigns yet.</p>
          <Link
            href="/agency/campaigns/new"
            className="mt-3 inline-block text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
          >
            Create your first campaign
          </Link>
        </div>
      )}
    </div>
  );
}
