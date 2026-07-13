import Link from "next/link";
import { logInAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Please enter your email.",
  agency_only: "This app is for agency members. Please sign up first.",
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

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Enter your email and we'll send you a magic link.
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

      <p className="mt-6 text-center text-sm text-zinc-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-zinc-900 dark:text-zinc-100">
          Create an account
        </Link>
      </p>
    </div>
  );
}
