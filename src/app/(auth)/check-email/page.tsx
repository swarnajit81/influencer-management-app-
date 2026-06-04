export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  return (
    <div className="mx-auto max-w-md px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold">Check your email</h1>
      <p className="mt-3 text-sm text-zinc-500">
        We sent a magic link
        {email ? (
          <>
            {" "}to <span className="font-medium text-zinc-900 dark:text-zinc-100">{email}</span>
          </>
        ) : null}
        . Click the link to finish signing in.
      </p>
      <p className="mt-8 text-xs text-zinc-500">You can close this tab.</p>
    </div>
  );
}
