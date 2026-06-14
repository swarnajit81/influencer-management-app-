/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaiseAsINR } from "@/lib/money";

export default async function AgencyDashboard() {
  const user = await requireAgencyMember();
  const supabase = await createSupabaseServerClient();

  const [campaignsRes, invitationsRes, deliverablesRes, payoutsRes, auditRes] = await Promise.all([
    supabase
      .from("campaigns")
      .select("id, name, status, total_budget_inr_paise, created_at, brands ( name )")
      .eq("agency_id", user.agencyId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("campaign_invitations")
      .select("id, status, offer_amount_inr_paise, created_at, campaigns!inner ( name, agency_id )")
      .eq("campaigns.agency_id", user.agencyId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("deliverables")
      .select(
        `id, status, type, amount_inr_paise, due_date,
         contracts!inner ( id, campaigns!inner ( name, agency_id ) )`,
      )
      .eq("contracts.campaigns.agency_id", user.agencyId)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("payouts")
      .select(
        `id, status, amount_inr_paise, created_at,
         contracts!inner ( campaigns!inner ( name, agency_id ) )`,
      )
      .eq("contracts.campaigns.agency_id", user.agencyId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("audit_log")
      .select("id, action, entity_type, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const campaigns = (campaignsRes.data ?? []) as any[];
  const invitations = (invitationsRes.data ?? []) as any[];
  const deliverables = (deliverablesRes.data ?? []) as any[];
  const payouts = (payoutsRes.data ?? []) as any[];
  const audit = (auditRes.data ?? []) as any[];

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;
  const pendingInvitations = invitations.filter((i) => i.status === "pending").length;
  const awaitingReview = deliverables.filter((d) => d.status === "submitted").length;
  const liveDeliverables = deliverables.filter((d) => d.status === "live").length;
  const pendingPayouts = payouts.filter((p) =>
    ["pending", "queued", "processing"].includes(p.status),
  );
  const pendingPayoutTotal = pendingPayouts.reduce(
    (sum, p) => sum + Number(p.amount_inr_paise ?? 0),
    0,
  );

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user.fullName.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Snapshot of what&apos;s happening across your campaigns right now.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active campaigns" value={activeCampaigns} href="/agency/campaigns" />
        <Stat label="Pending invitations" value={pendingInvitations} href="/agency/campaigns" />
        <Stat label="Awaiting review" value={awaitingReview} hint="Influencer submissions in your queue" />
        <Stat
          label="Payouts pending"
          value={formatPaiseAsINR(pendingPayoutTotal)}
          hint={`${pendingPayouts.length} payout${pendingPayouts.length === 1 ? "" : "s"}`}
          href="/agency/payouts"
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
        <SectionHeader title="What needs your attention" />
        <ul className="mt-3 space-y-2 text-sm">
          {awaitingReview === 0 && pendingInvitations === 0 && deliverables.filter((d) => d.status === "changes_requested").length === 0 ? (
            <li className="rounded-md bg-emerald-50 px-4 py-3 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
              Inbox zero. No reviews queued, no influencer follow-ups due.
            </li>
          ) : (
            <>
              {awaitingReview > 0 && (
                <Item>
                  {awaitingReview} influencer submission{awaitingReview === 1 ? "" : "s"} waiting for review.
                </Item>
              )}
              {pendingInvitations > 0 && (
                <Item>
                  {pendingInvitations} invitation{pendingInvitations === 1 ? "" : "s"} still pending influencer response.
                </Item>
              )}
              {deliverables.filter((d) => d.status === "changes_requested").length > 0 && (
                <Item>
                  {deliverables.filter((d) => d.status === "changes_requested").length}{" "}
                  deliverable
                  {deliverables.filter((d) => d.status === "changes_requested").length === 1 ? "" : "s"}{" "}
                  waiting on influencer to resubmit.
                </Item>
              )}
            </>
          )}
        </ul>
      </section>

      <section>
        <SectionHeader title="Live deliverables" />
        <p className="mt-1 text-sm text-zinc-500">
          {liveDeliverables} deliverable{liveDeliverables === 1 ? "" : "s"} are live across all your campaigns.
        </p>
      </section>

      <section>
        <SectionHeader title="Recent activity" />
        {audit.length === 0 ? (
          <EmptyHint>No activity yet.</EmptyHint>
        ) : (
          <ul className="mt-3 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 border-b border-zinc-100 py-2 last:border-b-0 dark:border-zinc-800">
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

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-md bg-amber-50 px-4 py-3 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    paused: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    completed: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
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
