import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { addInfluencerToRosterAction } from "@/app/(auth)/actions";

export default async function AgencyInfluencers({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; added?: string }>;
}) {
  const { error, added } = await searchParams;
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("influencer_id, influencers (display_name, instagram_handle, follower_count_total)")
    .eq("agency_id", user.agencyId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Influencers</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Your private roster. Add creators here to invite them to campaigns.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error === "influencer_not_found"
            ? "Creator not found. They must have signed up first."
            : error === "already_on_roster"
              ? "Already on your roster."
              : error}
        </div>
      )}
      {added && (
        <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Creator added to your roster!
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Roster list */}
        <div>
          <h2 className="mb-4 font-semibold">Your roster ({roster?.length ?? 0})</h2>
          {roster && roster.length > 0 ? (
            <div className="space-y-2">
              {roster.map((r: any) => (
                <Link
                  key={r.influencer_id}
                  href={`/agency/influencers/${r.influencer_id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                >
                  <div>
                    <p className="font-medium text-sm">{r.influencers?.display_name}</p>
                    <p className="text-xs text-zinc-500">@{r.influencers?.instagram_handle}</p>
                    <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                      {r.influencers?.follower_count_total.toLocaleString()} followers
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">→</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No creators on your roster yet.</p>
          )}
        </div>

        {/* Add form */}
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="mb-4 font-semibold">Add creator</h2>
          <form action={addInfluencerToRosterAction} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Creator email</span>
              <input
                name="email"
                type="email"
                placeholder="creator@example.com"
                className="input mt-1"
                required
              />
              <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                They must be signed up as a creator first.
              </p>
            </label>
            <button
              type="submit"
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Add to roster
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
