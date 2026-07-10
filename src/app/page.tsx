import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50">
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="font-semibold tracking-tight">PR Platform</span>
          <div className="flex gap-3 text-sm">
            <Link href="/login" className="rounded-md px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-white dark:bg-zinc-50 dark:text-zinc-900"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Your brand asks &ldquo;where are we?&rdquo; This answers before they ask.
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
          One workspace for PR agencies running influencer campaigns. Every brief,
          offer, approval, and revision on the record &mdash; with a live status link
          your brand can open any time. No more Friday status decks.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            title="Live brand status page"
            body="Every campaign gets a link the brand can open any time — brief, deliverables, approvals, spend. No signup for them, no reporting afternoon for you."
          />
          <FeatureCard
            title="Audit trail on everything"
            body="Who approved what, when, with what feedback — timestamped. Disputes end with a link, not a screenshot hunt."
          />
          <FeatureCard
            title="Offers &amp; contracts on record"
            body="Structured invitations replace DM negotiations. One-click acceptance generates the contract. Automated INR payouts on the roadmap."
          />
        </div>

        <p className="mt-12 text-sm text-zinc-500">
          Built for Indian agencies. Amounts in INR, records that hold up when someone asks
          &ldquo;who approved this?&rdquo;
        </p>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-zinc-500">
          <span>PR Platform</span>
          <div className="flex gap-4">
            <Link href="/terms" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}
