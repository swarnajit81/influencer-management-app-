import Link from "next/link";
import { signUpAction } from "../actions";
import { SubmitButton } from "@/components/SubmitButton";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Please fill in all required fields.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-2xl font-semibold">Create your agency account</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Built for PR agencies running influencer campaigns. We&apos;ll email you a
        magic link &mdash; no password needed.
      </p>

      <form action={signUpAction} className="mt-8 space-y-4">
        <Field label="Your name">
          <input
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="input"
          />
        </Field>

        <Field label="Work email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </Field>

        <Field label="Agency name">
          <input
            name="agency_name"
            type="text"
            required
            className="input"
          />
        </Field>

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
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-zinc-900 dark:text-zinc-100">
          Log in
        </Link>
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
