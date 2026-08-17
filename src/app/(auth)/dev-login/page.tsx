import { notFound } from "next/navigation";
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { devLoginAction, devLoginEnabled } from "../dev-actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Enter an email.",
  test_login_no_token: "Supabase did not return a token — user may not exist.",
  test_login_verify_failed: "Session mint failed.",
};

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  if (!(await devLoginEnabled())) notFound();

  const { error, email } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Dev-only bypass. Skips magic-link inbox round-trip by minting a session
        server-side via the service-role key. Route is gated on{" "}
        <code>NODE_ENV !== &quot;production&quot;</code> or{" "}
        <code>ENABLE_DEV_LOGIN=1</code>. The account must already exist. Seed
        dummy brands + influencers with{" "}
        <code>node scripts/qa-seed-fixtures.mjs</code>.
      </div>

      <h1 className="text-2xl font-semibold">Dev sign-in</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Enter an existing agency account email. No email is sent.
      </p>

      <form action={devLoginAction} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={email ?? "qa-agency@example.com"}
            className="input mt-1"
          />
        </label>

        {message && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {message}
          </p>
        )}

        <SubmitButton className="w-full" pendingLabel="Minting session…">
          Sign in
        </SubmitButton>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
          Back to normal login
        </Link>
      </p>
    </div>
  );
}
