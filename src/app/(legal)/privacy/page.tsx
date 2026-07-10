import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy — PR Platform" };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-900 dark:text-zinc-50">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 10 July 2026</p>

      <div className="mt-8 space-y-6 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <strong>Agency users:</strong> name, work email, agency details (name, GSTIN, PAN,
              address) that you provide.
            </li>
            <li>
              <strong>Creators:</strong> name, email, social handles, and — only when an agency
              sets up payouts — bank account details (account number, IFSC, holder name, PAN).
            </li>
            <li>
              <strong>Brand contacts:</strong> name and email, used only to send campaign links.
            </li>
            <li>
              <strong>Activity records:</strong> an audit log of actions taken on campaigns,
              contracts, and deliverables (who, what, when).
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">How we use it</h2>
          <p className="mt-2">
            Solely to operate the service: running campaigns, generating contracts,
            processing payout records, and sending transactional emails (invitations,
            contract links, status updates). We do not sell personal data, and we do not
            use it for advertising.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Where it lives</h2>
          <p className="mt-2">
            Data is stored with Supabase (database and authentication) and emails are sent
            via Resend. Payment processing, when enabled, uses Razorpay. Access is
            restricted per-agency by row-level security at the database layer.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Your rights (DPDP Act, 2023)</h2>
          <p className="mt-2">
            You may request access to, correction of, or erasure of your personal data.
            Creators whose data was added by an agency may direct requests to us or to
            that agency. We honour verified erasure requests within 30 days, except
            records we must retain for legal or tax compliance.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Retention</h2>
          <p className="mt-2">
            Campaign and contract records are retained while your agency account is
            active and for up to 8 years after (tax record requirements). Audit logs are
            retained for the life of the related record.
          </p>
        </section>
        <section>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">Contact</h2>
          <p className="mt-2">
            Data questions or requests: email the address on your onboarding invoice or
            your pilot contact.
          </p>
        </section>
      </div>
    </main>
  );
}
