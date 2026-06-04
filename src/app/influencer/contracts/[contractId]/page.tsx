import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";
import { submitDeliverableAction } from "@/app/(auth)/actions";

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

const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting your submission",
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

export default async function InfluencerContractDetail({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ error?: string; submitted?: string }>;
}) {
  const { contractId } = await params;
  const { error, submitted } = await searchParams;
  const user = await requireRole("influencer");

  const supabase = await createSupabaseServerClient();

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      `
      id, status, total_amount_inr_paise,
      campaigns ( id, name, brands ( name ), agencies ( name ) )
    `,
    )
    .eq("id", contractId)
    .eq("influencer_id", user.influencerId)
    .single();

  if (!contract) {
    return (
      <div className="text-center">
        <p className="text-red-600">Contract not found.</p>
        <Link
          href="/influencer/contracts"
          className="mt-3 inline-block text-sm font-medium hover:underline"
        >
          Back to contracts
        </Link>
      </div>
    );
  }

  const camp: any = Array.isArray((contract as any).campaigns)
    ? (contract as any).campaigns[0]
    : (contract as any).campaigns;
  const brand: any = Array.isArray(camp?.brands) ? camp.brands[0] : camp?.brands;
  const agency: any = Array.isArray(camp?.agencies) ? camp.agencies[0] : camp?.agencies;

  const { data: deliverables } = await supabase
    .from("deliverables")
    .select(
      `
      id, type, description, due_date, amount_inr_paise, status,
      deliverable_submissions (
        id, content_url, caption, notes,
        reviewer_feedback, reviewed_at, created_at
      )
    `,
    )
    .eq("contract_id", contractId)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-3xl">
      <Link
        href="/influencer/contracts"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to contracts
      </Link>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold">{camp?.name}</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {brand?.name} · via {agency?.name}
        </p>
        <p className="mt-4 text-lg font-semibold">
          {formatPaiseAsINR((contract as any).total_amount_inr_paise)}
        </p>
      </div>

      {error && (
        <Banner tone="error">{decodeURIComponent(error)}</Banner>
      )}
      {submitted && <Banner tone="success">Submission sent for review.</Banner>}

      <h2 className="mb-3 text-lg font-semibold">Deliverables</h2>
      {!deliverables || deliverables.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No deliverables yet. The agency will add them shortly.
        </p>
      ) : (
        <div className="space-y-4">
          {deliverables.map((d: any) => (
            <DeliverableCard key={d.id} d={d} contractId={contractId} />
          ))}
        </div>
      )}
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
  const canSubmit = ["pending", "changes_requested"].includes(d.status);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">{DELIVERABLE_LABEL[d.type] ?? d.type}</p>
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
          {STATUS_LABEL[d.status] ?? d.status}
        </span>
      </div>

      {latest && (
        <div className="mt-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-700 dark:bg-zinc-800/40">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Last submission
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
          {latest.reviewer_feedback && (
            <p className="mt-2 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
              <span className="text-xs text-zinc-500">Agency feedback: </span>
              {latest.reviewer_feedback}
            </p>
          )}
        </div>
      )}

      {canSubmit && (
        <form action={submitDeliverableAction} className="mt-4 space-y-3">
          <input type="hidden" name="deliverable_id" value={d.id} />
          <input type="hidden" name="contract_id" value={contractId} />
          <label className="block">
            <span className="text-sm font-medium">Content URL</span>
            <input
              name="content_url"
              type="url"
              required
              placeholder="https://instagram.com/p/..."
              className="input mt-1"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Caption</span>
            <textarea name="caption" rows={2} className="input mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Notes for reviewer</span>
            <textarea name="notes" rows={2} className="input mt-1" />
          </label>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {d.status === "changes_requested" ? "Resubmit" : "Submit for review"}
          </button>
        </form>
      )}
    </div>
  );
}

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
