import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createInfluencerAction } from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

const ERROR_LABEL: Record<string, string> = {
  display_name_required: "Display name is required.",
  invalid_platform: "Choose a valid platform.",
  create_failed: "Could not create the creator.",
};

export default async function NewInfluencerPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAgencyMember();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/agency/influencers"
        transitionTypes={["nav-back"]}
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to influencers
      </Link>

      <h1 className="text-2xl font-semibold">New creator</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Add a creator to your roster. No signup needed on their side.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {ERROR_LABEL[error] ?? decodeURIComponent(error)}
        </div>
      )}

      <form action={createInfluencerAction} className="mt-8 space-y-6">
        <Field label="Display name" required>
          <input name="display_name" type="text" className="input" required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary platform">
            <select name="primary_platform" defaultValue="" className="input">
              <option value="">—</option>
              <option value="instagram">Instagram</option>
              <option value="youtube">YouTube</option>
              <option value="twitter">Twitter / X</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <Field label="City">
            <input name="city" type="text" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Instagram handle">
            <input
              name="instagram_handle"
              type="text"
              placeholder="handle"
              className="input"
            />
          </Field>
          <Field label="YouTube handle">
            <input name="youtube_handle" type="text" className="input" />
          </Field>
          <Field label="Twitter handle">
            <input name="twitter_handle" type="text" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Follower count (total)">
            <input
              name="follower_count_total"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              className="input"
            />
          </Field>
          <Field label="Engagement rate (%)">
            <input
              name="engagement_rate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="input"
              placeholder="e.g. 3.5"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Contact email">
            <input
              name="contact_email"
              type="email"
              className="input"
              placeholder="creator@example.com"
            />
          </Field>
          <Field label="Contact phone">
            <input
              name="contact_phone"
              type="tel"
              className="input"
              placeholder="+91…"
            />
          </Field>
        </div>

        <Field label="Categories (comma-separated)">
          <input
            name="categories"
            type="text"
            className="input"
            placeholder="beauty, skincare, hindi, mumbai"
          />
        </Field>

        <Field label="Portfolio URLs (space or comma separated)">
          <textarea
            name="portfolio_urls"
            rows={2}
            className="input"
            placeholder="https://instagram.com/p/…"
          />
        </Field>

        <Field label="Bio">
          <textarea name="bio" rows={3} className="input" />
        </Field>

        <Field label="Internal notes (only agency sees)">
          <textarea name="notes" rows={2} className="input" />
        </Field>

        <div className="flex gap-3 pt-4">
          <SubmitButton pendingLabel="Creating…">Create creator</SubmitButton>
          <Link
            href="/agency/influencers"
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
