/* eslint-disable @typescript-eslint/no-explicit-any */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifyToken, type VerifyResult } from "@/lib/tokens";
import { formatPaiseAsINR } from "@/lib/money";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageThread } from "@/components/MessageThread";
import { BrandDecisionForm } from "@/components/BrandDecisionForm";
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

      <header className="grid-bg animate-in overflow-hidden rounded-lg border hairline bg-[var(--surface)] px-8 py-10">
        <p className="eyebrow">
          {snap.agency.name ?? "The agency"} → {snap.brand.name ?? "Your brand"}
        </p>
        <h1 className="display mt-3 text-4xl sm:text-5xl">
          {snap.campaign.name}
        </h1>
        <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
          Version {(version as any).version_number} · sent{" "}
          {new Date((version as any).sent_at).toLocaleString("en-IN", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </header>

      {snap.campaign.brief && (
        <section className="mt-6 panel p-6">
          <h2 className="eyebrow">The brief</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--foreground)]">
            {snap.campaign.brief}
          </p>
        </section>
      )}

      <section className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border hairline bg-[var(--border)] sm:grid-cols-4">
        <Stat label="Creators" value={String(snap.items.length)} />
        <Stat label="Total" value={formatPaiseAsINR(totalPrice)} />
        <Stat
          label="Timeline"
          value={
            snap.campaign.start_date && snap.campaign.end_date
              ? `${snap.campaign.start_date}→${snap.campaign.end_date}`
              : "TBD"
          }
        />
        <Stat
          label="Decisions"
          value={`${approvedCount}·${rejectedCount}·${pendingCount}`}
          hint={`approved / rejected / pending`}
        />
      </section>

      <div className="mt-12 flex items-baseline justify-between border-b pb-2 hairline">
        <h2 className="text-[13px] font-medium">Proposed creators</h2>
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
          {snap.items.length} · ₹{formatPaiseAsINR(totalPrice).replace("₹", "")}
        </p>
      </div>
      <ul className="mt-4 space-y-4">
        {snap.items.map((it) => {
          const live = decisionMap.get(it.id) ?? { decision: "pending", comment: null };
          return (
            <li
              key={it.id}
              className="panel panel-hover animate-in p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold tracking-tight">
                    {it.influencer.display_name}
                  </div>
                  {it.influencer.instagram_handle && (
                    <a
                      href={`https://instagram.com/${it.influencer.instagram_handle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[12px] text-[var(--subtle)] hover:text-[var(--accent)]"
                    >
                      @{it.influencer.instagram_handle}
                    </a>
                  )}
                  <div className="mt-2 text-[12px] tabular text-[var(--muted)]">
                    {Number(it.influencer.follower_count_total ?? 0).toLocaleString("en-IN")}{" "}
                    followers
                    {it.influencer.engagement_rate !== null && (
                      <> · {Number(it.influencer.engagement_rate).toFixed(2)}% engagement</>
                    )}
                    {it.influencer.city && <> · {it.influencer.city}</>}
                  </div>
                  {(it.influencer.niches ?? []).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(it.influencer.niches ?? []).map((n) => (
                        <span
                          key={n}
                          className="rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)] hairline"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <div className="display text-2xl tabular">
                    {formatPaiseAsINR(Number(it.brand_price_inr_paise))}
                  </div>
                </div>
              </div>

              {it.rationale && (
                <div className="mt-4 border-l-2 pl-3 text-[13px] italic text-[var(--muted)] hairline-strong">
                  {it.rationale}
                </div>
              )}

              {it.deliverables.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                    Deliverables
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5 text-sm">
                    {it.deliverables.map((d, i) => (
                      <li
                        key={i}
                        className="rounded-md border border-zinc-200 px-2 py-1 text-xs tabular-nums text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
                      >
                        <span className="tabular-nums">{d.count}×</span>{" "}
                        {DELIVERABLE_LABEL[d.type] ?? d.type}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {it.sample_urls.length > 0 && (
                <div className="mt-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
                    Sample work
                  </div>
                  <ul className="mt-2 space-y-1 text-sm">
                    {it.sample_urls.map((u) => (
                      <li key={u}>
                        <a
                          href={u}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[var(--accent)] hover:underline"
                        >
                          {u}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <BrandDecisionForm
                itemId={it.id}
                token={token}
                initial={{
                  decision: live.decision as "pending" | "approved" | "rejected",
                  comment: live.comment,
                }}
                postAction={brandDecideShortlistItemAction}
              />
            </li>
          );
        })}
      </ul>

      <section id="thread" className="mt-12">
        <div className="flex items-baseline justify-between border-b pb-2 hairline">
          <h2 className="text-[13px] font-medium">Message the agency</h2>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
            Live
          </p>
        </div>
        <div className="mt-4">
          <MessageThread
            campaignId={(version as any).campaign_id}
            packageToken={token}
            viewerKind="brand"
            viewerName={snap.brand.name}
            initialMessages={initialMessages}
            postAction={postBrandMessageAction}
            hiddenFields={{ token }}
          />
        </div>
      </section>

      <section className="mt-12 panel p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[13px] font-medium">Not happy with the mix?</h2>
          <p className="eyebrow">Fresh package</p>
        </div>
        <p className="mt-2 text-[13px] text-[var(--muted)]">
          Tell the agency what to change and they&apos;ll send a fresh package.
        </p>
        <form action={brandRequestRevisionAction} className="mt-4 space-y-3">
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
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <main className="relative mx-auto max-w-3xl px-6 py-12">
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

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
        {label}
      </div>
      <div className="mt-1.5 display text-2xl leading-none tracking-tight tabular-nums">
        {value}
      </div>
      {hint && (
        <div className="mt-1 text-[11px] text-zinc-500">{hint}</div>
      )}
    </div>
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
