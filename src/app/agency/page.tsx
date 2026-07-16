/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaiseAsINR } from "@/lib/money";

export default async function AgencyDashboard() {
  const user = await requireAgencyMember();
  const supabase = await createSupabaseServerClient();

  const [campaignsRes, shortlistRes, auditRes] = await Promise.all([
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
      .from("audit_log")
      .select("id, action, entity_type, created_at")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const campaigns = (campaignsRes.data ?? []) as any[];
  const shortlist = (shortlistRes.data ?? []) as any[];
  const audit = (auditRes.data ?? []) as any[];

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
        <SectionHeader title="Recent activity" />
        {audit.length === 0 ? (
          <EmptyHint>No activity yet.</EmptyHint>
        ) : (
          <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {audit.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800"
              >
                <span className="truncate">
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] dark:bg-zinc-800">
                    {a.action}
                  </code>{" "}
                  on {a.entity_type}
                </span>
                <span className="shrink-0 text-zinc-400">
                  {new Date(a.created_at).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
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
