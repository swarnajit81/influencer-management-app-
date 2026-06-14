/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken, type VerifyResult } from "@/lib/tokens";
import { formatPaiseAsINR } from "@/lib/money";
import { submitDeliverableViaTokenAction } from "./actions";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
};

const DELIVERABLE_LABEL: Record<string, string> = {
  instagram_post: "Instagram post",
  instagram_reel: "Instagram reel",
  instagram_story: "Instagram story",
  youtube_video: "YouTube video",
  youtube_short: "YouTube short",
  twitter_post: "Twitter post",
  blog_post: "Blog post",
  other: "Other",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting submission",
  submitted: "Submitted — under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  live: "Live",
};

const STATUS_KIND: Record<string, "muted" | "warn" | "good" | "bad"> = {
  pending: "muted",
  submitted: "warn",
  changes_requested: "warn",
  approved: "good",
  rejected: "bad",
  live: "good",
};

export default async function ContractPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { submitted, error } = await searchParams;

  const verified = verifyToken(token);
  if (!verified.ok) {
    return <ErrorShell title={titleForVerifyError(verified)} body={bodyForVerifyError(verified)} />;
  }
  if (verified.payload.kind !== "contract") {
    return <ErrorShell title="Link not recognised" body="This link isn't a contract link." />;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("contracts")
    .select(
      `id, status, total_amount_inr_paise, influencer_signed_at, brand_signed_at,
       signed_pdf_url,
       campaigns!inner (
         name, brief,
         agencies ( name ),
         brands ( name )
       ),
       influencers!inner ( display_name, profiles ( full_name ) ),
       deliverables (
         id, type, description, due_date, amount_inr_paise, status,
         deliverable_submissions ( id, content_url, caption, reviewer_feedback, created_at, reviewed_at )
       )`,
    )
    .eq("id", verified.payload.contractId)
    .single();

  if (!data) {
    return <ErrorShell title="Contract not found" body="The contract linked here no longer exists." />;
  }

  const c = data as any;
  const campaign = Array.isArray(c.campaigns) ? c.campaigns[0] : c.campaigns;
  const agency = Array.isArray(campaign?.agencies) ? campaign.agencies[0] : campaign?.agencies;
  const brand = Array.isArray(campaign?.brands) ? campaign.brands[0] : campaign?.brands;
  const influencer = Array.isArray(c.influencers) ? c.influencers[0] : c.influencers;
  const profile = Array.isArray(influencer?.profiles)
    ? influencer.profiles[0]
    : influencer?.profiles;

  const greeting = influencer?.display_name ?? profile?.full_name ?? "there";
  const deliverables = (c.deliverables ?? []) as any[];
  deliverables.sort(
    (a, b) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
      a.id.localeCompare(b.id),
  );

  return (
    <Shell>
      {submitted && (
        <Banner kind="success">
          Submission received. The agency will review and either approve it or request changes.
        </Banner>
      )}
      {error && <Banner kind="error">{humanError(error)}</Banner>}

      <h1 className="text-2xl font-semibold">Your contract</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Hi {greeting}, this is your live contract with{" "}
        <strong>{agency?.name ?? "the agency"}</strong> for{" "}
        <strong>{brand?.name ?? "the brand"}</strong>.
      </p>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <Row label="Campaign" value={campaign?.name ?? "—"} />
        <Row label="Brand" value={brand?.name ?? "—"} />
        <Row
          label="Total contract value"
          value={<span className="text-lg font-semibold">{formatPaiseAsINR(c.total_amount_inr_paise)}</span>}
        />
        <Row label="Contract status" value={c.status?.replace(/_/g, " ") ?? "—"} />
        {c.signed_pdf_url && (
          <Row
            label="Signed PDF"
            value={
              <a href={c.signed_pdf_url} className="underline" target="_blank" rel="noreferrer">
                Open signed document
              </a>
            }
          />
        )}
      </section>

      <h2 className="mt-10 text-lg font-semibold">Deliverables</h2>
      {deliverables.length === 0 ? (
        <p className="mt-2 text-sm text-zinc-500">
          No deliverables yet. The agency will add them shortly — check back soon.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {deliverables.map((d) => {
            const subs = ((d.deliverable_submissions ?? []) as any[]).slice().sort(
              (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
            );
            const latest = subs[0];
            const canSubmit = d.status === "pending" || d.status === "changes_requested";
            return (
              <li
                key={d.id}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold">
                      {DELIVERABLE_LABEL[d.type] ?? d.type}
                    </div>
                    {d.due_date && (
                      <div className="mt-1 text-xs text-zinc-500">Due {d.due_date}</div>
                    )}
                    {d.description && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                        {d.description}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold">
                      {formatPaiseAsINR(d.amount_inr_paise)}
                    </div>
                    <StatusPill status={d.status} />
                  </div>
                </div>

                {latest && (
                  <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
                    <div className="text-xs uppercase tracking-wide text-zinc-500">Latest submission</div>
                    {latest.content_url && (
                      <a
                        href={latest.content_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block break-all underline"
                      >
                        {latest.content_url}
                      </a>
                    )}
                    {latest.caption && (
                      <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                        {latest.caption}
                      </p>
                    )}
                    {latest.reviewer_feedback && (
                      <div className="mt-3 rounded-md bg-amber-50 p-2 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                        <div className="text-xs font-semibold uppercase tracking-wide">Feedback</div>
                        <p className="mt-1 whitespace-pre-wrap">{latest.reviewer_feedback}</p>
                      </div>
                    )}
                  </div>
                )}

                {canSubmit && (
                  <form
                    action={submitDeliverableViaTokenAction}
                    className="mt-4 space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-800"
                  >
                    <input type="hidden" name="token" value={token} />
                    <input type="hidden" name="deliverable_id" value={d.id} />
                    <Field label="Content URL">
                      <input
                        type="url"
                        name="content_url"
                        required
                        placeholder="https://instagram.com/p/..."
                        className="input"
                        defaultValue={latest?.content_url ?? ""}
                      />
                    </Field>
                    <Field label="Caption (optional)">
                      <textarea
                        name="caption"
                        rows={3}
                        className="input"
                        defaultValue={latest?.caption ?? ""}
                      />
                    </Field>
                    <Field label="Notes for the agency (optional)">
                      <input type="text" name="notes" className="input" />
                    </Field>
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {d.status === "changes_requested" ? "Resubmit" : "Submit"}
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-10 text-xs text-zinc-500">
        This page is your live link — bookmark it. We&apos;ll also email a fresh
        link whenever the agency requests changes.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto max-w-3xl px-6 py-12 text-zinc-900 dark:text-zinc-50">
        {children}
      </main>
    </div>
  );
}

function ErrorShell({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{body}</p>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-zinc-100 py-3 first:pt-0 last:border-b-0 last:pb-0 dark:border-zinc-800">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-sm">{value}</div>
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

function StatusPill({ status }: { status: string }) {
  const kind = STATUS_KIND[status] ?? "muted";
  const styles =
    kind === "good"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : kind === "bad"
        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : kind === "warn"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
          : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error" | "muted";
  children: React.ReactNode;
}) {
  const styles =
    kind === "success"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : kind === "error"
        ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  return <div className={`rounded-md px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function titleForVerifyError(v: VerifyResult & { ok: false }): string {
  switch (v.reason) {
    case "expired":
      return "This contract link has expired";
    case "bad_signature":
    case "malformed":
      return "This link isn't valid";
    case "no_secret":
      return "Server misconfiguration";
  }
}

function bodyForVerifyError(v: VerifyResult & { ok: false }): string {
  switch (v.reason) {
    case "expired":
      return "Ask the agency to send you a fresh link.";
    case "bad_signature":
    case "malformed":
      return "The link may be incomplete or tampered with. Open the original email and click again.";
    case "no_secret":
      return "Token verification is unavailable. The agency has been notified.";
  }
}

function humanError(code: string): string {
  if (code.startsWith("not_submittable_")) {
    const status = code.slice("not_submittable_".length).replace(/_/g, " ");
    return `This deliverable is ${status} — you can't submit right now.`;
  }
  switch (code) {
    case "invalid_input":
      return "Please paste a content URL before submitting.";
    case "not_found":
      return "Deliverable not found.";
    case "wrong_contract":
      return "That deliverable doesn't belong to this contract.";
    case "wrong_kind":
      return "This link isn't a contract link.";
    case "missing_profile":
      return "Couldn't identify you. Contact the agency.";
    default:
      return decodeURIComponent(code);
  }
}
