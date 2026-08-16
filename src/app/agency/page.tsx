/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaiseAsINR } from "@/lib/money";

export default async function AgencyDashboard() {
  const user = await requireAgencyMember();
  const supabase = await createSupabaseServerClient();

  const [campaignsRes, shortlistRes, eventsRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, total_budget_inr_paise, created_at, brands ( name )")
      .eq("agency_id", user.agencyId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("campaign_shortlist_items")
      .select(
        `id, brand_decision, brand_price_inr_paise,
         campaigns!inner ( id, agency_id, status )`,
      )
      .eq("campaigns.agency_id", user.agencyId),
    supabase
      .from("package_events")
      .select(
        `id, actor_kind, event_type, occurred_at, metadata,
         campaigns!inner ( id, name, agency_id )`,
      )
      .eq("campaigns.agency_id", user.agencyId)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);

  const campaigns = (campaignsRes.data ?? []) as any[];
  const shortlist = (shortlistRes.data ?? []) as any[];
  const events = (eventsRes.data ?? []) as any[];

  const pitchingCount = campaigns.filter((c) => c.status === "pitching").length;
  const approvedCount = campaigns.filter((c) => c.status === "brand_approved").length;
  const pendingDecisions = shortlist.filter((s) => s.brand_decision === "pending").length;

  const totalPipelinePaise = shortlist.reduce(
    (s, it) => s + Number(it.brand_price_inr_paise ?? 0),
    0,
  );

  const shortlistByCampaign = new Map<
    string,
    { approved: number; rejected: number; pending: number }
  >();
  for (const s of shortlist) {
    const cid = Array.isArray(s.campaigns) ? s.campaigns[0]?.id : s.campaigns?.id;
    if (!cid) continue;
    const cur = shortlistByCampaign.get(cid) ?? {
      approved: 0,
      rejected: 0,
      pending: 0,
    };
    if (s.brand_decision === "approved") cur.approved++;
    else if (s.brand_decision === "rejected") cur.rejected++;
    else cur.pending++;
    shortlistByCampaign.set(cid, cur);
  }

  return (
    <div className="space-y-14">
      {/* Hero. Linear-style: ambient grid + spotlight, tight display type, one clear message. */}
      <section className="grid-bg animate-in -mx-10 -mt-10 border-b hairline px-10 pb-14 pt-14">
        <p className="eyebrow">Dashboard · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
        <h1 className="display mt-3 text-5xl sm:text-6xl">
          Every brand touch, on the record.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
          {user.fullName.split(" ")[0]}&apos;s live snapshot of every pitch,
          decision, and message across the agency. Nothing hidden in a chat
          thread.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/agency/campaigns/new" className="btn-dark">
            New campaign
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
          </Link>
          <Link href="/agency/campaigns" className="btn-ghost">
            View campaigns
          </Link>
        </div>
      </section>

      {/* KPI strip. Hairline dividers, tabular numerals, no cards. */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border hairline bg-[var(--border)] sm:grid-cols-4">
        <Metric label="Pipeline value" value={formatPaiseAsINR(totalPipelinePaise)} />
        <Metric label="Pitching" value={String(pitchingCount)} />
        <Metric label="Brand approved" value={String(approvedCount)} tint="accent" />
        <Metric label="Pending decisions" value={String(pendingDecisions)} />
      </section>

      {/* Recent campaigns. Hairline row with decision rail. */}
      <section>
        <SectionHead title="Recent campaigns" href="/agency/campaigns" />
        {campaigns.length === 0 ? (
          <EmptyHint>
            No campaigns yet.{" "}
            <Link href="/agency/campaigns/new" className="text-[var(--accent)] hover:underline">
              Create one
            </Link>
            .
          </EmptyHint>
        ) : (
          <ul className="mt-4 overflow-hidden rounded-lg border hairline">
            {campaigns.map((c, i) => {
              const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
              const rail = shortlistByCampaign.get(c.id) ?? {
                approved: 0,
                rejected: 0,
                pending: 0,
              };
              const total = rail.approved + rail.rejected + rail.pending;
              return (
                <li key={c.id} className={i > 0 ? "border-t hairline" : ""}>
                  <Link
                    href={`/agency/campaigns/${c.id}`}
                    className="flex items-center gap-4 px-4 py-3 text-sm transition-colors hover:bg-[var(--surface)]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <div className="truncate font-medium">{c.name}</div>
                        <div className="truncate text-[12px] text-[var(--subtle)]">
                          · {brand?.name ?? "Unknown brand"}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <DecisionRail rail={rail} />
                        <span className="text-[11px] tabular text-[var(--subtle)]">
                          {total === 0
                            ? "no creators yet"
                            : `${rail.approved}/${total} approved`}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <StatusPill status={c.status} />
                      <div className="mt-1 text-[11px] tabular text-[var(--subtle)]">
                        {formatPaiseAsINR(c.total_budget_inr_paise)}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Activity timeline. Dots on a rail. */}
      <section>
        <SectionHead title="Brand activity" />
        {events.length === 0 ? (
          <EmptyHint>No brand activity yet. Send a package to start.</EmptyHint>
        ) : (
          <ol className="mt-4 space-y-0">
            {events.map((e, i) => {
              const camp = Array.isArray(e.campaigns) ? e.campaigns[0] : e.campaigns;
              const isBrand = e.actor_kind === "brand";
              return (
                <li
                  key={e.id}
                  className="group flex items-start gap-3 rounded-md px-2 py-2 text-[13px] transition-colors hover:bg-[var(--surface)]"
                >
                  <div className="relative flex flex-col items-center pt-1.5">
                    <span
                      className={`signal-dot ${
                        isBrand ? "bg-[var(--accent)]" : "bg-[var(--subtle)]"
                      }`}
                    />
                    {i < events.length - 1 && (
                      <span
                        className="mt-1 h-full w-px flex-1"
                        style={{ backgroundColor: "var(--border)" }}
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      <span className="font-medium capitalize">{e.actor_kind}</span>{" "}
                      <span className="text-[var(--muted)]">
                        {EVENT_LABEL[e.event_type] ?? e.event_type}
                      </span>
                      {camp && (
                        <>
                          {" on "}
                          <Link
                            href={`/agency/campaigns/${camp.id}`}
                            className="font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
                          >
                            {camp.name}
                          </Link>
                        </>
                      )}
                    </div>
                    {(e.metadata?.comment || e.metadata?.note) && (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--subtle)]">
                        “{e.metadata.comment ?? e.metadata.note}”
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 pt-1 text-[11px] tabular text-[var(--subtle)]">
                    {relativeTime(new Date(e.occurred_at))}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}

const EVENT_LABEL: Record<string, string> = {
  package_sent: "sent the package",
  package_viewed: "viewed the package",
  item_approved: "approved a creator",
  item_rejected: "rejected a creator",
  item_commented: "commented on a creator",
  revision_requested: "requested a revision",
};

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

function Metric({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: "accent";
}) {
  return (
    <div className="bg-[var(--surface)] px-5 py-4">
      <div className="eyebrow">{label}</div>
      <div
        className={`display mt-2 text-3xl tabular ${
          tint === "accent" ? "text-[var(--accent)]" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function DecisionRail({
  rail,
}: {
  rail: { approved: number; rejected: number; pending: number };
}) {
  const total = rail.approved + rail.rejected + rail.pending;
  if (total === 0) {
    return <div className="h-1 w-40 rounded-full bg-[var(--border)]" />;
  }
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-1 w-40 overflow-hidden rounded-full bg-[var(--border)]">
      {rail.approved > 0 && (
        <span className="h-full bg-emerald-500" style={{ width: w(rail.approved) }} />
      )}
      {rail.pending > 0 && (
        <span className="h-full bg-amber-400" style={{ width: w(rail.pending) }} />
      )}
      {rail.rejected > 0 && (
        <span className="h-full bg-red-400" style={{ width: w(rail.rejected) }} />
      )}
    </div>
  );
}

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b pb-2 hairline">
      <h2 className="text-[13px] font-medium">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)] hover:text-[var(--foreground)]"
        >
          View all →
        </Link>
      )}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-10 text-center text-sm text-[var(--muted)]">
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { dot: string; text: string }> = {
    draft: { dot: "bg-[var(--subtle)]", text: "text-[var(--muted)]" },
    pitching: { dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-300" },
    brand_approved: { dot: "bg-[var(--accent)]", text: "text-[var(--accent)]" },
    active: { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
    completed: { dot: "bg-[var(--subtle)]", text: "text-[var(--muted)]" },
    cancelled: { dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  };
  const c = map[status] ?? map.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${c.text}`}>
      <span className={`signal-dot ${c.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}
