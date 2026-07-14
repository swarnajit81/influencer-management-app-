/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";

const FOLLOWER_BANDS = [
  { key: "all", label: "All", min: 0, max: Infinity },
  { key: "nano", label: "1K–10K", min: 1_000, max: 10_000 },
  { key: "micro", label: "10K–100K", min: 10_000, max: 100_000 },
  { key: "mid", label: "100K–1M", min: 100_000, max: 1_000_000 },
  { key: "macro", label: "1M+", min: 1_000_000, max: Infinity },
] as const;

const ERROR_LABEL: Record<string, string> = {
  invalid_email: "Enter a valid creator email.",
  already_on_roster: "Already on your roster.",
  influencer_not_found: "Creator not found.",
  invalid_input: "Missing or invalid input.",
  not_on_roster: "Not on your roster.",
  display_name_required: "Display name is required.",
};

export default async function AgencyInfluencers({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    band?: string;
    category?: string;
    error?: string;
    added?: string;
    removed?: string;
    imported?: string;
    skipped?: string;
  }>;
}) {
  const sp = await searchParams;
  const user = await requireAgencyMember();
  const supabase = await createSupabaseServerClient();

  const q = (sp.q ?? "").trim().toLowerCase();
  const bandKey = sp.band ?? "all";
  const band =
    FOLLOWER_BANDS.find((b) => b.key === bandKey) ?? FOLLOWER_BANDS[0];
  const category = (sp.category ?? "").trim().toLowerCase();

  // Server-side base query then in-memory filter (roster is small per agency).
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select(
      `influencer_id, notes, created_at,
       influencers!inner (
         id, display_name, instagram_handle, youtube_handle,
         primary_platform, follower_count_total, engagement_rate,
         city, state, niches
       )`,
    )
    .eq("agency_id", user.agencyId)
    .order("created_at", { ascending: false });

  const rows =
    (roster ?? [])
      .map((r: any) => ({
        id: r.influencer_id,
        notes: r.notes as string | null,
        inf: (Array.isArray(r.influencers) ? r.influencers[0] : r.influencers) as {
          id: string;
          display_name: string;
          instagram_handle: string | null;
          youtube_handle: string | null;
          primary_platform: string | null;
          follower_count_total: number;
          engagement_rate: number | null;
          city: string | null;
          state: string | null;
          niches: string[] | null;
        },
      }))
      .filter(({ inf }) => {
        if (!inf) return false;
        if (q) {
          const hay = [
            inf.display_name,
            inf.instagram_handle,
            inf.youtube_handle,
            inf.city,
            ...(inf.niches ?? []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (category && !(inf.niches ?? []).includes(category)) return false;
        const followers = Number(inf.follower_count_total ?? 0);
        if (followers < band.min) return false;
        if (band.max !== Infinity && followers >= band.max) return false;
        return true;
      });

  // All categories seen on roster — for filter chips.
  const allCategories = Array.from(
    new Set(
      (roster ?? []).flatMap(
        (r: any) =>
          (Array.isArray(r.influencers) ? r.influencers[0] : r.influencers)
            ?.niches ?? [],
      ),
    ),
  ).sort();

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Influencers</h1>
          <p className="mt-2 text-sm text-zinc-500">
            Your private roster ({roster?.length ?? 0} creators). No creator signup needed —
            add manually or import from Excel.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/agency/influencers/import"
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            Import CSV
          </Link>
          <Link
            href="/agency/influencers/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            New creator
          </Link>
        </div>
      </div>

      {sp.error && (
        <div className="mt-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {ERROR_LABEL[sp.error] ?? decodeURIComponent(sp.error)}
        </div>
      )}
      {sp.added && (
        <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Creator added.
        </div>
      )}
      {sp.removed && (
        <div className="mt-4 rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          Creator removed from roster.
        </div>
      )}
      {sp.imported && (
        <div className="mt-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Imported {sp.imported} creator{sp.imported === "1" ? "" : "s"}.
          {sp.skipped && Number(sp.skipped) > 0
            ? ` Skipped ${sp.skipped} (missing name or duplicate handle).`
            : null}
        </div>
      )}

      <form className="mt-6 flex flex-wrap items-end gap-3" action="/agency/influencers">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Search
          </span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="name, handle, city, category…"
            className="input mt-1 w-72"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Followers
          </span>
          <select
            name="band"
            defaultValue={band.key}
            className="input mt-1"
          >
            {FOLLOWER_BANDS.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </label>
        {allCategories.length > 0 && (
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Category
            </span>
            <select
              name="category"
              defaultValue={category}
              className="input mt-1"
            >
              <option value="">All</option>
              {allCategories.map((c) => (
                <option key={c as string} value={c as string}>
                  {c as string}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Apply
        </button>
        {(q || category || band.key !== "all") && (
          <Link
            href="/agency/influencers"
            className="text-sm text-zinc-500 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-zinc-500">
          {roster && roster.length > 0
            ? "No creators match your filters."
            : "No creators on your roster yet. Add one or import your Excel."}
        </p>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Creator</th>
                <th className="px-4 py-3 text-left font-medium">Platform</th>
                <th className="px-4 py-3 text-left font-medium">Followers</th>
                <th className="px-4 py-3 text-left font-medium">Engagement</th>
                <th className="px-4 py-3 text-left font-medium">City</th>
                <th className="px-4 py-3 text-left font-medium">Categories</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {rows.map(({ id, inf }) => (
                <tr
                  key={id}
                  style={{ viewTransitionName: `influencer-${id}` }}
                  className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/agency/influencers/${id}`}
                      transitionTypes={["nav-forward"]}
                      className="font-medium hover:underline"
                    >
                      {inf.display_name}
                    </Link>
                    {inf.instagram_handle && (
                      <div className="text-xs text-zinc-500">
                        @{inf.instagram_handle}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {inf.primary_platform ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {Number(inf.follower_count_total ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {inf.engagement_rate !== null && inf.engagement_rate !== undefined
                      ? `${Number(inf.engagement_rate).toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {[inf.city, inf.state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(inf.niches ?? []).slice(0, 3).map((n: string) => (
                        <span
                          key={n}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {n}
                        </span>
                      ))}
                      {(inf.niches ?? []).length > 3 && (
                        <span className="text-xs text-zinc-500">
                          +{(inf.niches ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
