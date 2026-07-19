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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inbox</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Every brand action and message across your campaigns.
          {unreadCount > 0 && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
              {unreadCount} new
            </span>
          )}
        </p>
      </div>

      {top.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          Nothing yet. Send a package to a brand to start the conversation.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {top.map((item) => {
            const unread = isUnread(item);
            const actorLabel =
              item.actorKind === "brand"
                ? item.brandName ?? "Brand"
                : "You";
            return (
              <li
                key={item.id}
                className={`px-4 py-3 text-sm ${
                  unread ? "bg-blue-50/60 dark:bg-blue-950/20" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div>
                      <span
                        className={`mr-2 inline-flex h-2 w-2 rounded-full align-middle ${
                          unread ? "bg-blue-500" : "bg-transparent"
                        }`}
                        aria-hidden
                      />
                      <strong>{actorLabel}</strong> {item.label} on{" "}
                      <Link
                        href={`/agency/campaigns/${item.campaignId}${
                          item.kind === "message" ? "#thread" : ""
                        }`}
                        className="underline"
                      >
                        {item.campaignName}
                      </Link>
                    </div>
                    {item.detail && (
                      <blockquote className="mt-1 line-clamp-3 border-l-2 border-zinc-300 pl-3 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        {item.detail}
                      </blockquote>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {relativeTime(new Date(item.ts))}
                  </span>
                </div>
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
