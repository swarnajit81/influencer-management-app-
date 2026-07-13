import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";
import {
  addDeliverableAction,
  reviewDeliverableAction,
  markDeliverableLiveAction,
} from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

const DELIVERABLE_TYPES: Array<{ value: string; label: string }> = [
  { value: "instagram_post", label: "Instagram post" },
  { value: "instagram_reel", label: "Instagram reel" },
  { value: "instagram_story", label: "Instagram story" },
  { value: "youtube_video", label: "YouTube video" },
  { value: "youtube_short", label: "YouTube short" },
  { value: "twitter_post", label: "Twitter / X post" },
  { value: "blog_post", label: "Blog post" },
  { value: "other", label: "Other" },
];

const DELIVERABLE_STATUS_LABEL: Record<string, string> = {
  pending: "Pending submission",
  submitted: "In review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  live: "Live",
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  changes_requested: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  approved: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  live: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default async function AgencyContractDetail({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{
    error?: string;
    added?: string;
    reviewed?: string;
    live?: string;
  }>;
}) {
  const { contractId } = await params;
  const { error, added, reviewed, live } = await searchParams;
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      `
      id, status, total_amount_inr_paise, payment_terms,
      influencer_signed_at, brand_signed_at, created_at,
      campaign_id, influencer_id,
      campaigns!inner ( id, name, agency_id, brands ( name ) ),
      influencers!inner ( id, display_name, instagram_handle, profiles ( email ) )
    `,
    )
    .eq("id", contractId)
    .single();

  const camp: any = Array.isArray((contract as any)?.campaigns)
    ? (contract as any).campaigns[0]
    : (contract as any)?.campaigns;

  if (!contract || camp?.agency_id !== user.agencyId) {
    return (
      <div className="text-center">
        <p className="text-red-600">Contract not found.</p>
        <Link
          href="/agency/campaigns"
          className="mt-3 inline-block text-sm font-medium hover:underline"
        >
          Back to campaigns
        </Link>
      </div>
    );
  }

  const brand: any = Array.isArray(camp?.brands) ? camp.brands[0] : camp?.brands;
  const influencer: any = Array.isArray((contract as any).influencers)
    ? (contract as any).influencers[0]
    : (contract as any).influencers;
  const profile: any = Array.isArray(influencer?.profiles)
    ? influencer.profiles[0]
    : influencer?.profiles;

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select(
      `
      id, type, description, due_date, amount_inr_paise, status, created_at,
      deliverable_submissions (
        id, content_url, caption, notes,
        reviewer_feedback, reviewed_by, reviewed_at, created_at
      )
    `,
    )
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-4xl">
      <Link
        href={`/agency/campaigns/${camp.id}`}
        transitionTypes={["nav-back"]}
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to campaign
      </Link>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">{camp.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {brand?.name} · {influencer?.display_name}
          {influencer?.instagram_handle ? ` (@${influencer.instagram_handle})` : ""}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Total</p>
            <p className="mt-1 text-lg font-semibold">
              {formatPaiseAsINR((contract as any).total_amount_inr_paise)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Status</p>
            <p className="mt-1">{(contract as any).status}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Influencer</p>
            <p className="mt-1 truncate">{profile?.email}</p>
          </div>
        </div>
      </div>

      {error && (
        <Banner tone="error">{decodeURIComponent(error)}</Banner>
      )}
      {added && <Banner tone="success">Deliverable added.</Banner>}
      {reviewed && <Banner tone="success">Review recorded.</Banner>}
      {live && <Banner tone="success">Marked live.</Banner>}

      <div className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Deliverables</h2>
        {!deliverables || deliverables.length === 0 ? (
          <p className="text-sm text-zinc-500">No deliverables yet. Add one below.</p>
        ) : (
          <div className="space-y-4">
            {deliverables.map((d: any) => (
              <DeliverableCard key={d.id} d={d} contractId={contractId} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h3 className="mb-4 font-semibold">Add deliverable</h3>
        <form action={addDeliverableAction} className="space-y-4">
          <input type="hidden" name="contract_id" value={contractId} />
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm font-medium">Type</span>
              <select name="type" required className="input mt-1">
                {DELIVERABLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium">Due date</span>
              <input type="date" name="due_date" className="input mt-1" />
            </label>
          </div>
          <label className="block">
            <span className="text-sm font-medium">Description</span>
            <textarea name="description" rows={2} className="input mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Amount (₹)</span>
            <input
              name="amount_rupees"
              type="number"
              step="100"
              min="0"
              defaultValue={0}
              className="input mt-1"
            />
          </label>
          <SubmitButton pendingLabel="Adding…">Add deliverable</SubmitButton>
        </form>
      </div>
    </div>
  );
}

function DeliverableCard({ d, contractId }: { d: any; contractId: string }) {
  const subs = (d.deliverable_submissions ?? []) as any[];
  const latest = subs.length
    ? subs.slice().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )[0]
    : null;
  const canReview = d.status === "submitted" && latest;
  const canMarkLive = d.status === "approved";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {DELIVERABLE_TYPES_LABEL[d.type] ?? d.type}
          </p>
          {d.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{d.description}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            {d.due_date ? `Due ${d.due_date}` : "No due date"} ·{" "}
            {formatPaiseAsINR(d.amount_inr_paise)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            STATUS_BADGE[d.status] ?? "bg-zinc-100 text-zinc-700"
          }`}
        >
          {DELIVERABLE_STATUS_LABEL[d.status] ?? d.status}
        </span>
      </div>

      {latest && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Latest submission
          </p>
          {latest.content_url && (
            <a
              href={latest.content_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all text-blue-600 hover:underline dark:text-blue-400"
            >
              {latest.content_url}
            </a>
          )}
          {latest.caption && (
            <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              <span className="text-xs text-zinc-500">Caption: </span>
              {latest.caption}
            </p>
          )}
          {latest.notes && (
            <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              <span className="text-xs text-zinc-500">Notes: </span>
              {latest.notes}
            </p>
          )}
          {latest.reviewer_feedback && (
            <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              <span className="text-xs text-zinc-500">Your feedback: </span>
              {latest.reviewer_feedback}
            </p>
          )}
        </div>
      )}

      {canReview && (
        <form action={reviewDeliverableAction} className="mt-4 space-y-3">
          <input type="hidden" name="deliverable_id" value={d.id} />
          <input type="hidden" name="contract_id" value={contractId} />
          <textarea
            name="feedback"
            rows={2}
            placeholder="Feedback (optional for approve, required for changes)"
            className="input"
          />
          <div className="flex gap-2">
            <SubmitButton
              name="decision"
              value="approve"
              variant="success"
              pendingLabel="Approving…"
            >
              Approve
            </SubmitButton>
            <SubmitButton
              name="decision"
              value="request_changes"
              variant="secondary"
              pendingLabel="Sending…"
            >
              Request changes
            </SubmitButton>
          </div>
        </form>
      )}

      {canMarkLive && (
        <form action={markDeliverableLiveAction} className="mt-4">
          <input type="hidden" name="deliverable_id" value={d.id} />
          <input type="hidden" name="contract_id" value={contractId} />
          <SubmitButton pendingLabel="Marking…">Mark live</SubmitButton>
        </form>
      )}
    </div>
  );
}

const DELIVERABLE_TYPES_LABEL: Record<string, string> = Object.fromEntries(
  DELIVERABLE_TYPES.map((t) => [t.value, t.label]),
);

function Banner({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
}) {
  const cls =
    tone === "error"
      ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  return <div className={`mb-4 rounded-md px-4 py-3 text-sm ${cls}`}>{children}</div>;
}
