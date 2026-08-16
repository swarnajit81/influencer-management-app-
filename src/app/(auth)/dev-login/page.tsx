import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SubmitButton } from "@/components/SubmitButton";

function devLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_LOGIN === "1";
}

async function devLoginAction(formData: FormData): Promise<void> {
  "use server";

  if (!devLoginEnabled()) notFound();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/dev-login?error=invalid_input");

  const admin = createSupabaseAdminClient();
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr || !link?.properties?.hashed_token) {
    redirect(`/dev-login?error=${encodeURIComponent(linkErr?.message ?? "no_token")}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: link!.properties.hashed_token,
    type: "magiclink",
  });
  if (error || !data.session) {
    redirect(`/dev-login?error=${encodeURIComponent(error?.message ?? "verify_failed")}`);
  }

  redirect("/agency");
}

const ERROR_MESSAGES: Record<string, string> = {
  invalid_input: "Enter an email.",
  no_token: "Supabase did not return a token — user may not exist.",
  verify_failed: "Session mint failed.",
};

export default async function DevLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email?: string }>;
}) {
  if (!devLoginEnabled()) notFound();

  const { error, email } = await searchParams;
  const message = error ? (ERROR_MESSAGES[error] ?? error) : null;

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Dev-only bypass. Skips magic-link inbox round-trip by minting a session
        server-side via the service-role key. Route is gated on{" "}
        <code>NODE_ENV !== &quot;production&quot;</code> or{" "}
        <code>ENABLE_DEV_LOGIN=1</code>. The account must already exist.
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
