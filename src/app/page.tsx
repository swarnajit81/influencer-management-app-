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
          Run influencer campaigns without losing the thread.
        </h1>
        <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400">
          One workspace for PR agencies, brands, and creators. Briefs, contracts,
          deliverables, and payouts &mdash; all in one place, all in INR.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <FeatureCard title="Campaigns" body="Brand briefs, influencer shortlists, and status tracking in one view." />
          <FeatureCard title="Contracts" body="E-signed via Aadhaar (Digio) &mdash; no more PDF email chains." />
          <FeatureCard title="Payouts" body="Razorpay-backed UPI / bank transfers triggered on approval." />
        </div>
      </main>
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
