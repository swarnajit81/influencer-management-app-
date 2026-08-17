import Link from "next/link";
import { logInAction } from "../actions";
import { devLoginAction, devLoginEnabled } from "../dev-actions";
import { SubmitButton } from "@/components/SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Please enter your email.",
  agency_only: "This app is for agency members. Please sign up first.",
  test_login_no_token:
    "Test agency not seeded. Run `node scripts/qa-seed-fixtures.mjs` first.",
  test_login_verify_failed: "Test session mint failed.",
  "Signups not allowed for otp":
    "No account found with that email. Please sign up first.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;
  const demoEnabled = await devLoginEnabled();

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Enter your email and we&apos;ll send you a magic link.
      </p>

      <form action={logInAction} className="mt-8 space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Email</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input mt-1"
          />
        </label>

        {message && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {message}
          </p>
        )}

        <SubmitButton className="w-full" pendingLabel="Sending link…">
          Send magic link
        </SubmitButton>
      </form>

      {demoEnabled && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
              or
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <form action={devLoginAction} className="mt-4">
            {/* Empty email → server action defaults to qa-agency@example.com. */}
            <button
              type="submit"
              className="group flex w-full items-center justify-between rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-4 py-3 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)] hover:brightness-95"
            >
              <span className="flex items-center gap-2">
                <span className="signal-dot bg-[var(--accent)]" />
                Log in as test agency
              </span>
              <span className="text-[10px] font-medium uppercase tracking-[0.14em] opacity-70 transition-opacity group-hover:opacity-100">
                Demo →
              </span>
            </button>
            <p className="mt-2 text-center text-[11px] text-zinc-500">
              Pre-seeded workspace with 10 brands + 45 creators. No email required.
            </p>
          </form>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-zinc-900 dark:text-zinc-100">
          Create an account
        </Link>
      </p>
    </div>
  );
}
