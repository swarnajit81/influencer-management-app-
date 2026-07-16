/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  updateInfluencerProfileAction,
  removeInfluencerFromRosterAction,
  saveRateCardAction,
} from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

type PageProps = {
  params: Promise<{ influencerId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

const DELIVERABLE_TYPES: Array<{ key: string; label: string }> = [
  { key: "instagram_post", label: "Instagram post" },
  { key: "instagram_reel", label: "Instagram reel" },
  { key: "instagram_story", label: "Instagram story" },
  { key: "youtube_video", label: "YouTube video" },
  { key: "youtube_short", label: "YouTube short" },
  { key: "twitter_post", label: "Twitter / X post" },
  { key: "blog_post", label: "Blog post" },
  { key: "other", label: "Other" },
];

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
         primary_platform, follower_count_total, engagement_rate,
         bio, notes, city, state, contact_email, contact_phone,
         niches, portfolio_urls,
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

  const { data: rateCardRows } = await supabase
    .from("influencer_rate_card")
    .select("deliverable_type, cost_inr_paise")
    .eq("influencer_id", influencerId);

  const rateMap = new Map<string, number>(
    (rateCardRows ?? []).map((row: any) => [row.deliverable_type, row.cost_inr_paise]),
  );

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/agency/influencers"
          transitionTypes={["nav-back"]}
          className="text-sm text-zinc-500 hover:underline"
        >
          ← Back to influencers
        </Link>
        <div
          style={{ viewTransitionName: `influencer-${influencerId}` }}
          className="mt-2 flex items-start justify-between gap-4"
        >
          <div>
            <h1 className="text-2xl font-semibold">{inf.display_name}</h1>
            <p className="mt-1 text-sm text-zinc-500">
              {inf.instagram_handle && `@${inf.instagram_handle}`}
              {inf.instagram_handle && (profile?.email || inf.contact_email) && " · "}
              {profile?.email ?? inf.contact_email ?? "no email"}
              {" · "}
              {Number(inf.follower_count_total ?? 0).toLocaleString("en-IN")} followers
            </p>
          </div>
          <form action={removeInfluencerFromRosterAction}>
            <input type="hidden" name="influencer_id" value={influencerId} />
            <SubmitButton variant="secondary" pendingLabel="Removing…">
              Remove from roster
            </SubmitButton>
          </form>
        </div>
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
        <form
          action={updateInfluencerProfileAction}
          className="mt-4 grid gap-4 sm:grid-cols-2"
        >
          <input type="hidden" name="influencer_id" value={influencerId} />

          <Field label="Display name *">
            <input
              type="text"
              name="display_name"
              defaultValue={inf.display_name}
              className="input"
              required
            />
          </Field>
          <Field label="Primary platform">
            <select
              name="primary_platform"
              defaultValue={inf.primary_platform ?? ""}
              className="input"
            >
              <option value="">—</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">Twitter / X</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Instagram handle">
            <input
              type="text"
              name="instagram_handle"
              defaultValue={inf.instagram_handle ?? ""}
              className="input"
            />
          </Field>
          <Field label="YouTube handle">
            <input
              type="text"
              name="youtube_handle"
              defaultValue={inf.youtube_handle ?? ""}
              className="input"
            />
          </Field>
          <Field label="Twitter handle">
            <input
              type="text"
              name="twitter_handle"
              defaultValue={inf.twitter_handle ?? ""}
              className="input"
            />
          </Field>

          <Field label="Follower count">
            <input
              type="number"
              min="0"
              step="1"
              name="follower_count_total"
              defaultValue={inf.follower_count_total ?? 0}
              className="input"
            />
          </Field>
          <Field label="Engagement rate (%)">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              name="engagement_rate"
              defaultValue={inf.engagement_rate ?? ""}
              className="input"
            />
          </Field>

          <Field label="City">
            <input
              type="text"
              name="city"
              defaultValue={inf.city ?? ""}
              className="input"
            />
          </Field>
          <Field label="State">
            <input
              type="text"
              name="state"
              defaultValue={inf.state ?? ""}
              className="input"
            />
          </Field>

          <Field label="Contact email">
            <input
              type="email"
              name="contact_email"
              defaultValue={inf.contact_email ?? ""}
              className="input"
            />
          </Field>
          <Field label="Contact phone">
            <input
              type="tel"
              name="contact_phone"
              defaultValue={inf.contact_phone ?? ""}
              className="input"
            />
          </Field>

          <Field label="Categories (comma-separated)" className="sm:col-span-2">
            <input
              type="text"
              name="categories"
              defaultValue={(inf.niches ?? []).join(", ")}
              className="input"
              placeholder="beauty, skincare, hindi"
            />
          </Field>

          <Field label="Portfolio URLs (space or comma-separated)" className="sm:col-span-2">
            <textarea
              name="portfolio_urls"
              defaultValue={(inf.portfolio_urls ?? []).join(" ")}
              rows={2}
              className="input"
            />
          </Field>

          <Field label="Bio" className="sm:col-span-2">
            <textarea
              name="bio"
              defaultValue={inf.bio ?? ""}
              rows={3}
              className="input"
            />
          </Field>

          <Field label="Internal notes (agency only)" className="sm:col-span-2">
            <textarea
              name="notes"
              defaultValue={inf.notes ?? ""}
              rows={2}
              className="input"
            />
          </Field>

          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Saving…">Save profile</SubmitButton>
          </div>
        </form>
      </section>

      <section
        id="rate-card"
        className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h2 className="text-base font-semibold">Rate card</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Baseline cost per deliverable (what the creator earns). Leave blank to remove.
          Agency margin lives on the campaign shortlist.
        </p>
        <form action={saveRateCardAction} className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="influencer_id" value={influencerId} />
          {DELIVERABLE_TYPES.map((d) => {
            const paise = rateMap.get(d.key);
            const rupees =
              paise !== undefined && paise !== null
                ? Math.round(Number(paise) / 100)
                : "";
            return (
              <Field key={d.key} label={`${d.label} (₹)`}>
                <input
                  type="number"
                  min="0"
                  step="100"
                  name={`rate_${d.key}`}
                  defaultValue={rupees}
                  className="input"
                />
              </Field>
            );
          })}
          <div className="sm:col-span-2">
            <SubmitButton pendingLabel="Saving…">Save rate card</SubmitButton>
          </div>
        </form>
      </section>

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
