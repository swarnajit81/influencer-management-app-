import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { ImportInfluencersWizard } from "@/components/ImportInfluencersWizard";

export default async function ImportInfluencersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAgencyMember();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/agency/influencers"
        transitionTypes={["nav-back"]}
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to influencers
      </Link>

      <h1 className="text-2xl font-semibold">Import creators from CSV</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Bring your existing Excel roster into the app. Paste CSV, map columns, import.
      </p>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error === "empty_rows"
            ? "No rows to import."
            : error === "invalid_json"
              ? "Could not parse rows."
              : decodeURIComponent(error)}
        </div>
      )}

      <div className="mt-8">
        <ImportInfluencersWizard />
      </div>
    </div>
  );
}
