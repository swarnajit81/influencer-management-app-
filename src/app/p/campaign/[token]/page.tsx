/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken, type VerifyResult } from "@/lib/tokens";
import { formatPaiseAsINR } from "@/lib/money";
import { brandReviewDeliverableViaTokenAction } from "./actions";

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ reviewed?: string; error?: string }>;
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

export default async function BrandCampaignPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { reviewed, error } = await searchParams;

  const verified = verifyToken(token);
  if (!verified.ok) {
    return <ErrorShell title={titleForVerifyError(verified)} body={bodyForVerifyError(verified)} />;
  }
  if (verified.payload.kind !== "campaign") {
    return <ErrorShell title="Link not recognised" body="This link isn't a campaign link." />;
  }

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("campaigns")
    .select(
      `id, name, brief, status, total_budget_inr_paise, start_date, end_date,
       agencies ( name ),
       brands ( name ),
       campaign_invitations (
         id, status, offer_amount_inr_paise, created_at,
         influencers ( display_name, instagram_handle )
       ),
       contracts (
         id, status, total_amount_inr_paise,
         influencers ( display_name ),
         deliverables (
           id, type, description, due_date, amount_inr_paise, status,
           deliverable_submissions (
             id, content_url, caption, reviewer_feedback, created_at, reviewed_at
           )
         )
       )`,
    )
    .eq("id", verified.payload.campaignId)
    .single();

  if (!data) {
    return <ErrorShell title="Campaign not found" body="The campaign linked here no longer exists." />;
  }

  const c = data as any;
  const agency = Array.isArray(c.agencies) ? c.agencies[0] : c.agencies;
  const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
  const invitations = (c.campaign_invitations ?? []) as any[];
  const contracts = (c.contracts ?? []) as any[];

  const allDeliverables = contracts.flatMap((ct) =>
    ((ct.deliverables ?? []) as any[]).map((d) => ({ ...d, contract: ct })),
  );
  const awaitingReview = allDeliverables.filter((d) => d.status === "submitted");
  const totalSpend = allDeliverables
    .filter((d) => ["approved", "live"].includes(d.status))
    .reduce((sum, d) => sum + Number(d.amount_inr_paise ?? 0), 0);

  return (
    <Shell>
      {reviewed && (
        <Banner kind="success">
          Decision recorded. The influencer has been notified.
        </Banner>
      )}
      {error && <Banner kind="error">{humanError(error)}</Banner>}

      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold">{c.name}</h1>
        <span className="text-xs uppercase tracking-wide text-zinc-500">{c.status}</span>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        For <strong>{brand?.name ?? "your brand"}</strong> — managed by{" "}
        <strong>{agency?.name ?? "your agency"}</strong>.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Budget" value={formatPaiseAsINR(c.total_budget_inr_paise)} />
        <Stat
          label="Committed"
          value={formatPaiseAsINR(totalSpend)}
          hint={`${allDeliverables.filter((d) => ["approved", "live"].includes(d.status)).length} deliverables`}
        />
        <Stat
          label="Your reviews waiting"
          value={awaitingReview.length}
          hint="Approve or request changes below"
        />
      </section>

      {c.brief && (
        <section className="mt-8 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-base font-semibold">Brief</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
            {c.brief}
          </p>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Invitations ({invitations.length})</h2>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No invitations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {invitations.map((inv) => {
              const influencer = Array.isArray(inv.influencers)
                ? inv.influencers[0]
                : inv.influencers;
              return (
                <li
                  key={inv.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{influencer?.display_name ?? "Influencer"}</div>
                    {influencer?.instagram_handle && (
                      <div className="text-xs text-zinc-500">@{influencer.instagram_handle}</div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {formatPaiseAsINR(inv.offer_amount_inr_paise)}
                    </div>
                    <div className="text-xs text-zinc-500">{inv.status}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Deliverables</h2>
        {allDeliverables.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No deliverables added yet.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {allDeliverables.map((d) => {
              const influencer = Array.isArray(d.contract?.influencers)
                ? d.contract.influencers[0]
                : d.contract?.influencers;
              const subs = ((d.deliverable_submissions ?? []) as any[]).slice().sort(
                (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
              );
              const latest = subs[0];
              const canReview = d.status === "submitted";
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
                      <div className="mt-1 text-xs text-zinc-500">
                        {influencer?.display_name ?? "Influencer"}
                        {d.due_date && ` · Due ${d.due_date}`}
                      </div>
                      {d.description && (
                        <p className="mt-2 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
                          {d.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {formatPaiseAsINR(d.amount_inr_paise)}
                      </div>
                      <div className="text-xs text-zinc-500">{d.status}</div>
                    </div>
                  </div>

                  {latest && (
                    <div className="mt-4 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800/60">
                      <div className="text-xs uppercase tracking-wide text-zinc-500">
                        Submission
                      </div>
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
                          <div className="text-xs font-semibold uppercase tracking-wide">
                            Previous feedback
                          </div>
                          <p className="mt-1 whitespace-pre-wrap">{latest.reviewer_feedback}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {canReview && (
                    <div className="mt-4 grid gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800 sm:grid-cols-2">
                      <form action={brandReviewDeliverableViaTokenAction} className="space-y-2">
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="deliverable_id" value={d.id} />
                        <input type="hidden" name="decision" value="approve" />
                        <button
                          type="submit"
                          className="w-full rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      </form>
                      <form action={brandReviewDeliverableViaTokenAction} className="space-y-2">
                        <input type="hidden" name="token" value={token} />
                        <input type="hidden" name="deliverable_id" value={d.id} />
                        <input type="hidden" name="decision" value="request_changes" />
                        <input
                          type="text"
                          name="feedback"
                          placeholder="What needs to change?"
                          className="input"
                        />
                        <button
                          type="submit"
                          className="w-full rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          Request changes
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="mt-10 text-xs text-zinc-500">
        Bookmark this page — it stays live for the full campaign. The agency can issue a fresh link if this one expires.
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

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

function Banner({
  kind,
  children,
}: {
  kind: "success" | "error";
  children: React.ReactNode;
}) {
  const styles =
    kind === "success"
      ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  return <div className={`mb-4 rounded-md px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function titleForVerifyError(v: VerifyResult & { ok: false }): string {
  switch (v.reason) {
    case "expired":
      return "This campaign link has expired";
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
  if (code.startsWith("not_reviewable_")) {
    const status = code.slice("not_reviewable_".length).replace(/_/g, " ");
    return `That deliverable is ${status} — nothing to review right now.`;
  }
  switch (code) {
    case "invalid_decision":
      return "Invalid decision.";
    case "not_found":
      return "Deliverable not found on this campaign.";
    case "wrong_kind":
      return "This link isn't a campaign link.";
    default:
      return decodeURIComponent(code);
  }
}
