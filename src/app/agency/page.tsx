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
  const liveCount = campaigns.filter((c) => c.status === "active").length;
  const pendingDecisions = shortlist.filter((s) => s.brand_decision === "pending").length;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Snapshot of your brand pitches and live campaigns.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Pitching to brand" value={pitchingCount} href="/agency/campaigns" />
        <Stat label="Brand-approved" value={approvedCount} href="/agency/campaigns" />
        <Stat label="Live campaigns" value={liveCount} href="/agency/campaigns" />
        <Stat
          label="Pending brand decisions"
          value={pendingDecisions}
          hint="Shortlist items awaiting brand response"
        />
      </section>

      <section>
        <SectionHeader title="Recent campaigns" href="/agency/campaigns" />
        {campaigns.length === 0 ? (
          <EmptyHint>
            No campaigns yet.{" "}
            <Link href="/agency/campaigns/new" className="underline">
              Create one
            </Link>
            .
          </EmptyHint>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {campaigns.map((c) => {
              const brand = Array.isArray(c.brands) ? c.brands[0] : c.brands;
              return (
                <li key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <Link href={`/agency/campaigns/${c.id}`} className="flex-1">
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-zinc-500">{brand?.name ?? "Unknown brand"}</div>
                  </Link>
                  <div className="ml-4 text-right">
                    <StatusPill status={c.status} />
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatPaiseAsINR(c.total_budget_inr_paise)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <SectionHeader title="Brand activity" />
        {events.length === 0 ? (
          <EmptyHint>
            No brand activity yet. Send a package to start.
          </EmptyHint>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {events.map((e) => {
              const camp = Array.isArray(e.campaigns) ? e.campaigns[0] : e.campaigns;
              return (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-4 px-4 py-2"
                >
                  <div className="min-w-0 flex-1 truncate">
                    <span
                      className={`mr-2 inline-flex h-2 w-2 rounded-full align-middle ${
                        e.actor_kind === "brand" ? "bg-blue-500" : "bg-zinc-400"
                      }`}
                      aria-hidden
                    />
                    <strong className="capitalize">{e.actor_kind}</strong>{" "}
                    {EVENT_LABEL[e.event_type] ?? e.event_type}
                    {camp && (
                      <>
                        {" on "}
                        <Link
                          href={`/agency/campaigns/${camp.id}`}
                          className="underline"
                        >
                          {camp.name}
                        </Link>
                      </>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500">
                    {relativeTime(new Date(e.occurred_at))}
                  </span>
                </li>
              );
            })}
          </ul>
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

function Stat({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string | number;
  href?: string;
  hint?: string;
}) {
  const card = (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <h2 className="text-lg font-semibold">{title}</h2>
      {href && (
        <Link href={href} className="text-sm text-zinc-500 hover:underline">
          View all →
        </Link>
      )}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-zinc-300 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    pitching: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    brand_approved: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    completed: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        map[status] ?? map.draft
      }`}
    >
      {status}
    </span>
  );
}
