import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service — PR Platform" };

export default function Terms() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-900 dark:text-zinc-50">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 10 July 2026 · Pilot terms</p>

      <div className="prose prose-zinc mt-8 space-y-6 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">1. What this is</h2>
          <p className="mt-2">
            PR Platform is a workspace for PR agencies to manage influencer campaigns:
            briefs, invitations, contracts, deliverable approvals, and payout records.
            The service is currently offered as a <strong>pilot</strong>. Features may change,
            and availability is not guaranteed.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">2. Your account and data</h2>
          <p className="mt-2">
            You are responsible for the accuracy of campaign, contract, and payment
            information you enter. Your agency&rsquo;s data is isolated from other agencies.
            You may request export or deletion of your agency&rsquo;s data at any time.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">3. Contracts and payments</h2>
          <p className="mt-2">
            Contracts generated on the platform record the terms both parties accepted.
            You remain responsible for the legal sufficiency of your agreements and for
            all tax obligations (including GST and TDS) arising from payments to creators.
            The platform provides records; it does not provide legal or tax advice.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">4. Acceptable use</h2>
          <p className="mt-2">
            Don&rsquo;t use the platform for unlawful campaigns, to misrepresent offers to
            creators, or to attempt access to another agency&rsquo;s data.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">5. Liability</h2>
          <p className="mt-2">
            The service is provided &ldquo;as is&rdquo; during the pilot. To the maximum extent
            permitted by law, our liability is limited to the fees you paid in the
            preceding three months.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">6. Contact</h2>
          <p className="mt-2">
            Questions about these terms: email the address on your onboarding invoice or
            your pilot contact.
          </p>
        </section>
      </div>
    </main>
  );
}
