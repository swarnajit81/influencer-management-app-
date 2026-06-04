import Link from "next/link";
import { signUpAction } from "../actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Please fill in all required fields.",
  agency_name_required: "Agency name is required when signing up as an agency.",
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
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="mt-2 text-sm text-zinc-500">
        We'll email you a magic link &mdash; no password needed.
      </p>

      <form action={signUpAction} className="mt-8 space-y-4">
        <Field label="Full name">
          <input
            name="full_name"
            type="text"
            required
            autoComplete="name"
            className="input"
          />
        </Field>

        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </Field>

        <Field label="I am a">
          <select name="role" required defaultValue="agency_member" className="input">
            <option value="agency_member">PR Agency</option>
            <option value="brand_member">Brand</option>
            <option value="influencer">Influencer / Creator</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Brands are typically invited by their agency &mdash; signing up directly
            requires an invite link in v1.
          </p>
        </Field>

        <Field label="Agency name (Agencies only)">
          <input name="agency_name" type="text" className="input" />
        </Field>

        {message && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Send magic link
        </button>
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
