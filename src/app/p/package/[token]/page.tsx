/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken, type VerifyResult } from "@/lib/tokens";
import { formatPaiseAsINR } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageThread } from "@/components/MessageThread";
import {
  brandDecideShortlistItemAction,
  brandRequestRevisionAction,
  postBrandMessageAction,
} from "./actions";

const DELIVERABLE_LABEL: Record<string, string> = {
  instagram_post: "Instagram post",
  instagram_reel: "Instagram reel",
  instagram_story: "Instagram story",
  youtube_video: "YouTube video",
  youtube_short: "YouTube short",
  twitter_post: "Twitter / X post",
  blog_post: "Blog post",
  other: "Other",
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    error?: string;
    decided?: string;
    revision?: string;
    message_sent?: string;
  }>;
};

export default async function BrandPackagePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { error, decided, revision, message_sent } = await searchParams;

  const verified = verifyToken(token);
  if (!verified.ok) {
    return <ErrorShell title={titleForVerifyError(verified)} body={bodyForVerifyError(verified)} />;
  }
  if (verified.payload.kind !== "package") {
    return <ErrorShell title="Link not recognised" body="This link isn't a package link." />;
  }

  const admin = createSupabaseAdminClient();

  // Load the frozen snapshot (what the brand sees never shifts).
  const { data: version } = await admin
    .from("package_versions")
    .select("id, version_number, sent_at, snapshot, campaign_id")
    .eq("id", verified.payload.versionId)
    .single();

  if (!version) {
    return <ErrorShell title="Package not found" body="This package version no longer exists." />;
  }

  // Log a package_viewed event, throttled to once every 15 min per version so
  // brand refreshes don't spam the agency dashboard.
  {
    const throttleCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: recentView } = await admin
      .from("package_events")
      .select("id")
      .eq("package_version_id", (version as any).id)
      .eq("event_type", "package_viewed")
      .gt("occurred_at", throttleCutoff)
      .limit(1)
      .maybeSingle();
    if (!recentView) {
      await admin.from("package_events").insert({
        campaign_id: (version as any).campaign_id,
        package_version_id: (version as any).id,
        actor_kind: "brand",
        event_type: "package_viewed",
        metadata: {},
      });
    }
  }

  // Live decisions per item (brand decisions are stored on the shortlist row,
  // not in the snapshot — so brand always sees their latest state).
  const { data: liveItems } = await admin
    .from("campaign_shortlist_items")
    .select("id, brand_decision, brand_comment, decided_at")
    .eq("campaign_id", (version as any).campaign_id);

  const decisionMap = new Map<string, { decision: string; comment: string | null }>(
    (liveItems ?? []).map((it: any) => [
      it.id,
      { decision: it.brand_decision, comment: it.brand_comment ?? null },
    ]),
  );

  const { data: messages } = await admin
    .from("campaign_messages")
    .select(
      `id, sender_kind, body, created_at,
       profiles:sender_profile_id ( full_name, email )`,
    )
    .eq("campaign_id", (version as any).campaign_id)
    .is("shortlist_item_id", null)
    .order("created_at", { ascending: true })
    .limit(200);

  const initialMessages = (messages ?? []).map((m: any) => ({
    id: m.id,
    sender_kind: m.sender_kind,
    body: m.body,
    created_at: m.created_at,
    sender_name: m.profiles?.full_name ?? m.profiles?.email ?? null,
  }));

  const snap = (version as any).snapshot as {
    campaign: {
      name: string;
      brief: string | null;
      start_date: string | null;
      end_date: string | null;
    };
    agency: { name: string | null };
    brand: { name: string | null };
    items: Array<{
      id: string;
      rationale: string | null;
      brand_price_inr_paise: number;
      deliverables: Array<{ type: string; count: number }>;
      sample_urls: string[];
      influencer: {
        display_name: string;
        instagram_handle: string | null;
        youtube_handle: string | null;
        follower_count_total: number;
        engagement_rate: number | null;
        city: string | null;
        niches: string[] | null;
        bio: string | null;
      };
    }>;
  };

  const totalPrice = snap.items.reduce((s, it) => s + Number(it.brand_price_inr_paise), 0);
  const approvedCount = Array.from(decisionMap.values()).filter(
    (d) => d.decision === "approved",
  ).length;
  const rejectedCount = Array.from(decisionMap.values()).filter(
    (d) => d.decision === "rejected",
  ).length;
  const pendingCount = snap.items.length - approvedCount - rejectedCount;

  return (
    <Shell>
      {revision && (
        <Banner kind="muted">
          Revision requested. The agency will send an updated package.
        </Banner>
      )}
      {decided && (
        <Banner kind="success">Decision saved.</Banner>
      )}
      {message_sent && <Banner kind="success">Message sent.</Banner>}
      {error && <Banner kind="error">{humanError(error)}</Banner>}

      <h1 className="text-2xl font-semibold">
        {snap.campaign.name}
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        From <strong>{snap.agency.name ?? "the agency"}</strong> for{" "}
        <strong>{snap.brand.name ?? "your brand"}</strong>. Version{" "}
        {(version as any).version_number} — sent{" "}
        {new Date((version as any).sent_at).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        .
      </p>

      {snap.campaign.brief && (
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Brief
          </h2>
          <p className="mt-2 whitespace-pre-wrap text-sm">{snap.campaign.brief}</p>
        </section>
      )}

      <section className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
        <Stat label="Creators" value={String(snap.items.length)} />
        <Stat label="Total" value={formatPaiseAsINR(totalPrice)} />
        <Stat
          label="Timeline"
          value={
            snap.campaign.start_date && snap.campaign.end_date
              ? `${snap.campaign.start_date} → ${snap.campaign.end_date}`
              : "TBD"
          }
        />
        <Stat
          label="Decisions"
          value={`${approvedCount} approved · ${rejectedCount} rejected · ${pendingCount} pending`}
        />
      </section>

      <h2 className="mt-8 text-lg font-semibold">Proposed creators</h2>
      <ul className="mt-4 space-y-4">
        {snap.items.map((it) => {
          const live = decisionMap.get(it.id) ?? { decision: "pending", comment: null };
          return (
            <li
              key={it.id}
              className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-base font-semibold">
                    {it.influencer.display_name}
                    {it.influencer.instagram_handle && (
                      <a
                        href={`https://instagram.com/${it.influencer.instagram_handle}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 text-sm text-zinc-500 hover:underline"
                      >
                        @{it.influencer.instagram_handle}
                      </a>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {Number(it.influencer.follower_count_total ?? 0).toLocaleString("en-IN")}{" "}
                    followers
                    {it.influencer.engagement_rate !== null && (
                      <> · {Number(it.influencer.engagement_rate).toFixed(2)}% engagement</>
                    )}
                    {it.influencer.city && <> · {it.influencer.city}</>}
                  </div>
                  {(it.influencer.niches ?? []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(it.influencer.niches ?? []).map((n) => (
                        <span
                          key={n}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg font-semibold">
                    {formatPaiseAsINR(Number(it.brand_price_inr_paise))}
                  </div>
                  <StatusPill decision={live.decision} />
                </div>
              </div>

              {it.rationale && (
                <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800/50">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Why this creator
                  </div>
                  <p className="mt-1 whitespace-pre-wrap">{it.rationale}</p>
                </div>
              )}

              {it.deliverables.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Deliverables
                  </div>
                  <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                    {it.deliverables.map((d, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        {d.count}× {DELIVERABLE_LABEL[d.type] ?? d.type}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {it.sample_urls.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Sample work
                  </div>
                  <ul className="mt-1 space-y-1 text-sm">
                    {it.sample_urls.map((u) => (
                      <li key={u}>
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {live.comment && (
                <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm dark:bg-amber-950/40">
                  <div className="text-xs font-medium uppercase tracking-wide text-amber-900 dark:text-amber-300">
                    Your comment
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-amber-900 dark:text-amber-200">
                    {live.comment}
                  </p>
                </div>
              )}

              {live.decision === "pending" && (
                <form
                  action={brandDecideShortlistItemAction}
                  className="mt-4 space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
                >
                  <input type="hidden" name="token" value={token} />
                  <input type="hidden" name="item_id" value={it.id} />
                  <textarea
                    name="brand_comment"
                    rows={2}
                    placeholder="Comment (optional — required for reject)"
                    className="input"
                  />
                  <div className="flex gap-2">
                    <SubmitButton
                      name="decision"
                      value="approved"
                      variant="success"
                      pendingLabel="Saving…"
                    >
                      Approve
                    </SubmitButton>
                    <SubmitButton
                      name="decision"
                      value="rejected"
                      variant="secondary"
                      pendingLabel="Saving…"
                    >
                      Reject
                    </SubmitButton>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>

      <section id="thread" className="mt-10">
        <h2 className="text-lg font-semibold">Message the agency</h2>
        <div className="mt-3">
          <MessageThread
            campaignId={(version as any).campaign_id}
            packageToken={token}
            viewerKind="brand"
            initialMessages={initialMessages}
          />
        </div>
        <form
          action={postBrandMessageAction}
          className="mt-3 flex items-start gap-2"
        >
          <input type="hidden" name="token" value={token} />
          <textarea
            name="body"
            rows={2}
            required
            maxLength={4000}
            placeholder="Write to the agency…"
            className="input flex-1"
          />
          <SubmitButton pendingLabel="Sending…">Send</SubmitButton>
        </form>
      </section>

      <section className="mt-10 rounded-lg border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-sm font-semibold">Not happy with the mix?</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Tell the agency what to change and they&apos;ll send a fresh package.
        </p>
        <form action={brandRequestRevisionAction} className="mt-3 space-y-2">
          <input type="hidden" name="token" value={token} />
          <textarea
            name="note"
            rows={2}
            placeholder="e.g. remove reels, add more South-Indian creators…"
            className="input"
          />
          <SubmitButton variant="secondary" pendingLabel="Sending…">
            Request revision
          </SubmitButton>
        </form>
      </section>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function StatusPill({ decision }: { decision: string }) {
  const cls =
    decision === "approved"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      : decision === "rejected"
        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";
  return (
    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {decision}
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
  return <div className={`mb-4 rounded-md px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function titleForVerifyError(v: VerifyResult & { ok: false }): string {
  switch (v.reason) {
    case "expired":
      return "This package link has expired";
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
      return "Ask the agency to resend a fresh link.";
    case "bad_signature":
    case "malformed":
      return "The link may be incomplete or tampered with. Open the original email.";
    case "no_secret":
      return "Package verification is unavailable. The agency has been notified.";
  }
}

function humanError(code: string): string {
  switch (code) {
    case "invalid_decision":
      return "Choose approve or reject.";
    case "item_not_found":
      return "That creator isn't part of this package.";
    case "empty_message":
      return "Type a message first.";
    case "message_too_long":
      return "Message must be under 4000 characters.";
    default:
      return decodeURIComponent(code);
  }
}
