/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getInboxLastSeenAt, markInboxSeen } from "@/lib/inbox";

type FeedItem = {
  kind: "event" | "message";
  id: string;
  ts: string;
  campaignId: string;
  campaignName: string;
  brandName: string | null;
  label: string;
  detail?: string | null;
  actorKind: "agency" | "brand";
};

const EVENT_LABEL: Record<string, string> = {
  package_sent: "sent the package",
  package_viewed: "viewed the package",
  item_approved: "approved a creator",
  item_rejected: "rejected a creator",
  item_commented: "commented on a creator",
  revision_requested: "requested a revision",
};

export default async function AgencyInboxPage() {
  const user = await requireAgencyMember();
  const supabase = await createSupabaseServerClient();

  const seenBefore = await getInboxLastSeenAt(user.agencyId, user.id);

  const [eventsRes, msgsRes] = await Promise.all([
    supabase
      .from("package_events")
      .select(
        `id, actor_kind, event_type, occurred_at, metadata,
         campaigns!inner ( id, name, agency_id, brands ( name ) )`,
      )
      .eq("campaigns.agency_id", user.agencyId)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("campaign_messages")
      .select(
        `id, sender_kind, body, created_at,
         campaigns!inner ( id, name, agency_id, brands ( name ) )`,
      )
      .eq("campaigns.agency_id", user.agencyId)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const events = (eventsRes.data ?? []) as any[];
  const msgs = (msgsRes.data ?? []) as any[];

  const feed: FeedItem[] = [];
  for (const e of events) {
    const camp = Array.isArray(e.campaigns) ? e.campaigns[0] : e.campaigns;
    const brand = Array.isArray(camp?.brands) ? camp.brands[0] : camp?.brands;
    feed.push({
      kind: "event",
      id: `e_${e.id}`,
      ts: e.occurred_at,
      campaignId: camp?.id,
      campaignName: camp?.name ?? "Unknown campaign",
      brandName: brand?.name ?? null,
      label: EVENT_LABEL[e.event_type] ?? e.event_type,
      detail:
        e.event_type === "item_commented" || e.event_type === "revision_requested"
          ? (e.metadata?.comment ?? e.metadata?.note ?? null)
          : null,
      actorKind: e.actor_kind,
    });
  }
  for (const m of msgs) {
    const camp = Array.isArray(m.campaigns) ? m.campaigns[0] : m.campaigns;
    const brand = Array.isArray(camp?.brands) ? camp.brands[0] : camp?.brands;
    feed.push({
      kind: "message",
      id: `m_${m.id}`,
      ts: m.created_at,
      campaignId: camp?.id,
      campaignName: camp?.name ?? "Unknown campaign",
      brandName: brand?.name ?? null,
      label: m.sender_kind === "brand" ? "sent a message" : "you sent a message",
      detail: m.body,
      actorKind: m.sender_kind,
    });
  }
  feed.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  const top = feed.slice(0, 60);

  const isUnread = (item: FeedItem) =>
    item.actorKind === "brand" && item.ts > seenBefore;
  const unreadCount = top.filter(isUnread).length;

  await markInboxSeen(user.agencyId, user.id);

  return (
    <div className="space-y-8">
      <header className="animate-in grid-bg -mx-10 -mt-10 border-b hairline px-10 pb-10 pt-14">
        <p className="eyebrow">Inbox</p>
        <h1 className="display mt-3 flex items-baseline gap-4 text-5xl">
          Everything the brand touched.
          {unreadCount > 0 && (
            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
              <span className="signal-dot bg-[var(--accent)]" />
              {unreadCount} new
            </span>
          )}
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          One feed of every view, decision, and message across every campaign
          — newest first. Nothing scattered across chat threads.
        </p>
      </header>

      {top.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-16 text-center text-sm text-[var(--muted)]">
          Nothing yet. Send a package to a brand to start the conversation.
        </div>
      ) : (
        <ul className="overflow-hidden rounded-lg border hairline">
          {top.map((item, i) => {
            const unread = isUnread(item);
            const actorLabel =
              item.actorKind === "brand"
                ? item.brandName ?? "Brand"
                : "You";
            return (
              <li key={item.id} className={i > 0 ? "border-t hairline" : ""}>
                <Link
                  href={`/agency/campaigns/${item.campaignId}${
                    item.kind === "message" ? "#thread" : ""
                  }`}
                  className={`flex items-start gap-4 px-4 py-3 text-[13px] transition-colors hover:bg-[var(--surface)] ${
                    unread ? "bg-[var(--accent-soft)]" : ""
                  }`}
                >
                  <span
                    className={`mt-1.5 signal-dot ${
                      unread ? "bg-[var(--accent)]" : "bg-transparent"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="font-semibold">{actorLabel}</span>{" "}
                      <span className="text-[var(--muted)]">{item.label} on</span>{" "}
                      <span className="font-medium">{item.campaignName}</span>
                    </div>
                    {item.detail && (
                      <blockquote className="mt-1.5 line-clamp-3 border-l-2 pl-3 text-[12px] leading-relaxed text-[var(--muted)] hairline-strong">
                        {item.detail}
                      </blockquote>
                    )}
                  </div>
                  <span className="shrink-0 pt-0.5 text-[11px] tabular text-[var(--subtle)]">
                    {relativeTime(new Date(item.ts))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function relativeTime(then: Date): string {
  const ms = Date.now() - then.getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return then.toLocaleDateString("en-IN", { dateStyle: "medium" });
}
