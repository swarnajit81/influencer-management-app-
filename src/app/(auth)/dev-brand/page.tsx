import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signToken } from "@/lib/tokens";

function devBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_LOGIN === "1";
}

async function openAsBrandAction(formData: FormData): Promise<void> {
  "use server";

  if (!devBypassEnabled()) notFound();

  const versionId = String(formData.get("version_id") ?? "").trim();
  const campaignId = String(formData.get("campaign_id") ?? "").trim();
  if (!versionId || !campaignId) redirect("/dev-brand?error=invalid_input");

  const token = signToken({ kind: "package", campaignId, versionId }, { ttlDays: 7 });
  redirect(`/p/package/${token}`);
}

export default async function DevBrandPage() {
  if (!devBypassEnabled()) notFound();

  const admin = createSupabaseAdminClient();

  // Show every campaign that belongs to the demo agency, with its latest
  // package_version (if any). Newest campaigns first.
  const demoEmail =
    process.env.DEMO_AGENCY_EMAIL ?? "qa-agency@example.com";
  const { data: qaProfile } = await admin
    .from("profiles")
    .select("id, agency_members(agency_id)")
    .eq("email", demoEmail)
    .maybeSingle();

  const agencyId = qaProfile?.agency_members?.[0]?.agency_id ?? null;

  const { data: campaigns } = agencyId
    ? await admin
        .from("campaigns")
        .select(
          `id, name, status, created_at,
           brands ( name ),
           package_versions ( id, version_number, sent_at )`,
        )
        .eq("agency_id", agencyId)
        .order("created_at", { ascending: false })
        .limit(50)
    : { data: [] as unknown[] };

  type Row = {
    id: string;
    name: string;
    status: string;
    created_at: string;
    brands: { name: string | null } | { name: string | null }[] | null;
    package_versions: Array<{ id: string; version_number: number; sent_at: string }>;
  };
  const rows = (campaigns ?? []) as Row[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Dev-only brand bypass. Mints a signed <code>package</code> token
        (TTL 7d) for the QA agency&apos;s campaigns and drops you straight
        into <code>/p/package/[token]</code> without needing the agency to
        press <em>Send to brand</em>. Gated on{" "}
        <code>NODE_ENV !== &quot;production&quot;</code> or{" "}
        <code>ENABLE_DEV_LOGIN=1</code>.
      </div>

      <h1 className="text-2xl font-semibold">Open a campaign as the brand</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Campaigns under <code>{demoEmail}</code>. Campaigns without a package
        version show a link to the agency detail page — send the package
        there first, then come back.
      </p>

      {!agencyId && (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          Demo agency not found. Sign up as <code>{demoEmail}</code> via{" "}
          <Link className="underline" href="/dev-login">/dev-login</Link>{" "}
          first.
        </p>
      )}

      {agencyId && rows.length === 0 && (
        <p className="mt-6 text-sm text-zinc-500">
          No campaigns yet. Create one at{" "}
          <Link className="underline" href="/agency/campaigns/new">
            /agency/campaigns/new
          </Link>
          .
        </p>
      )}

      <ul className="mt-6 space-y-3">
        {rows.map((r) => {
          const brand = Array.isArray(r.brands) ? r.brands[0] : r.brands;
          const versions = [...(r.package_versions ?? [])].sort(
            (a, b) => b.version_number - a.version_number,
          );
          const latest = versions[0];

          return (
            <li
              key={r.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-zinc-500">
                    {brand?.name ?? "no brand"} · status: {r.status}
                    {latest && (
                      <>
                        {" · "}latest v{latest.version_number} sent{" "}
                        {new Date(latest.sent_at).toLocaleDateString("en-IN")}
                      </>
                    )}
                    {!latest && " · no package version yet"}
                  </div>
                </div>
                <div className="shrink-0">
                  {latest ? (
                    <form action={openAsBrandAction}>
                      <input type="hidden" name="campaign_id" value={r.id} />
                      <input type="hidden" name="version_id" value={latest.id} />
                      <button
                        type="submit"
                        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                      >
                        Open as brand
                      </button>
                    </form>
                  ) : (
                    <Link
                      href={`/agency/campaigns/${r.id}`}
                      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                      Go send package
                    </Link>
                  )}
                </div>
              </div>

              {versions.length > 1 && (
                <details className="mt-3 text-xs text-zinc-500">
                  <summary className="cursor-pointer">
                    Older versions ({versions.length - 1})
                  </summary>
                  <ul className="mt-2 space-y-1">
                    {versions.slice(1).map((v) => (
                      <li key={v.id} className="flex items-center gap-2">
                        <span>
                          v{v.version_number} —{" "}
                          {new Date(v.sent_at).toLocaleDateString("en-IN")}
                        </span>
                        <form action={openAsBrandAction}>
                          <input type="hidden" name="campaign_id" value={r.id} />
                          <input type="hidden" name="version_id" value={v.id} />
                          <button
                            type="submit"
                            className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
                          >
                            open
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <p className="mt-8 text-center text-sm text-zinc-500">
        <Link href="/dev-login" className="underline">
          Back to dev sign-in
        </Link>
      </p>
    </div>
  );
}
