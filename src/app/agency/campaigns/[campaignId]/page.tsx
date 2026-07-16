/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireAgencyMember } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";
import {
  addShortlistItemAction,
  updateShortlistItemAction,
  removeShortlistItemAction,
  sendPackageToBrandAction,
  setCampaignStatusAction,
} from "@/app/(auth)/actions";
import { SubmitButton } from "@/components/SubmitButton";

const DELIVERABLE_TYPES: Array<{ key: string; label: string }> = [
  { key: "instagram_post", label: "IG post" },
  { key: "instagram_reel", label: "IG reel" },
  { key: "instagram_story", label: "IG story" },
  { key: "youtube_video", label: "YT video" },
  { key: "youtube_short", label: "YT short" },
  { key: "twitter_post", label: "X post" },
  { key: "blog_post", label: "Blog" },
  { key: "other", label: "Other" },
];

const DECISION_STYLE: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{
    error?: string;
    updated?: string;
    shortlisted?: string;
    item_saved?: string;
    item_removed?: string;
    package_sent?: string;
    status_set?: string;
  }>;
}) {
  const { campaignId } = await params;
  const sp = await searchParams;
  const user = await requireAgencyMember();

  const supabase = await createSupabaseServerClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, brands (name, contact_email)")
    .eq("id", campaignId)
    .eq("agency_id", user.agencyId)
    .single();

  if (!campaign) {
    return (
      <div className="text-center">
        <p className="text-red-600">Campaign not found.</p>
        <Link href="/agency/campaigns" className="mt-3 text-sm font-medium hover:underline">
          Back to campaigns
        </Link>
      </div>
    );
  }

  const { data: shortlist } = await supabase
    .from("campaign_shortlist_items")
    .select(
      `id, rationale, proposed_cost_inr_paise, brand_price_inr_paise,
       deliverables, sample_urls,
       brand_decision, brand_comment, decided_at,
       influencers!inner (
         id, display_name, instagram_handle, follower_count_total,
         engagement_rate, city, niches
       )`,
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select("influencer_id, influencers (id, display_name, instagram_handle)")
    .eq("agency_id", user.agencyId);

  const { data: versions } = await supabase
    .from("package_versions")
    .select("id, version_number, sent_at, sent_to_email")
    .eq("campaign_id", campaignId)
    .order("version_number", { ascending: false });

  const shortlistedIds = new Set((shortlist ?? []).map((s: any) => s.influencers?.id));

  const rosterAvailableForShortlist = (roster ?? []).filter(
    (r: any) => !shortlistedIds.has(r.influencer_id),
  );

  const totalCost = (shortlist ?? []).reduce(
    (sum: number, s: any) => sum + Number(s.proposed_cost_inr_paise ?? 0),
    0,
  );
  const totalPrice = (shortlist ?? []).reduce(
    (sum: number, s: any) => sum + Number(s.brand_price_inr_paise ?? 0),
    0,
  );
  const totalMargin = totalPrice - totalCost;
  const marginPct = totalPrice > 0 ? Math.round((totalMargin / totalPrice) * 100) : 0;

  return (
    <div className="max-w-4xl">
      <Link
        href="/agency/campaigns"
        transitionTypes={["nav-back"]}
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to campaigns
      </Link>

      <div
        style={{ viewTransitionName: `campaign-${campaignId}` }}
        className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{campaign.brands?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              {campaign.status}
            </span>
            <Link
              href={`/agency/campaigns/${campaignId}/edit`}
              transitionTypes={["nav-forward"]}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Edit
            </Link>
          </div>
        </div>

        {campaign.brief && (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{campaign.brief}</p>
        )}

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Budget</p>
            <p className="mt-1 text-lg font-semibold">
              {formatPaiseAsINR(campaign.total_budget_inr_paise)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Start</p>
            <p className="mt-1 text-sm">{campaign.start_date || "–"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">End</p>
            <p className="mt-1 text-sm">{campaign.end_date || "–"}</p>
          </div>
        </div>

        <LifecycleControls status={campaign.status} campaignId={campaignId} />
      </div>

      {sp.error && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {humanErr(sp.error)}
        </div>
      )}
      {sp.updated && <SuccessBanner>Campaign updated.</SuccessBanner>}
      {sp.shortlisted && <SuccessBanner>Creator added to shortlist.</SuccessBanner>}
      {sp.item_saved && <SuccessBanner>Shortlist item saved.</SuccessBanner>}
      {sp.item_removed && <MutedBanner>Removed from shortlist.</MutedBanner>}
      {sp.package_sent && (
        <SuccessBanner>Package version {sp.package_sent} sent to brand.</SuccessBanner>
      )}
      {sp.status_set && (
        <SuccessBanner>Campaign moved to {sp.status_set.replace("_", " ")}.</SuccessBanner>
      )}

      {/* Shortlist */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Shortlist</h2>
          {shortlist && shortlist.length > 0 && (
            <div className="text-right text-xs">
              <div className="text-zinc-500">
                Cost <strong>{formatPaiseAsINR(totalCost)}</strong> · Brand{" "}
                <strong>{formatPaiseAsINR(totalPrice)}</strong>
              </div>
              <div className="text-emerald-700 dark:text-emerald-400">
                Margin {formatPaiseAsINR(totalMargin)} ({marginPct}%)
              </div>
            </div>
          )}
        </div>

        {shortlist && shortlist.length > 0 ? (
          <ul className="space-y-3">
            {shortlist.map((it: any) => {
              const inf = Array.isArray(it.influencers) ? it.influencers[0] : it.influencers;
              const cost = Number(it.proposed_cost_inr_paise ?? 0);
              const price = Number(it.brand_price_inr_paise ?? 0);
              const margin = price - cost;
              const marginPctItem = price > 0 ? Math.round((margin / price) * 100) : 0;
              const deliverables = (it.deliverables ?? []) as Array<{
                type: string;
                count: number;
              }>;
              const delivMap = new Map(deliverables.map((d) => [d.type, d.count]));
              return (
                <li
                  key={it.id}
                  className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium">
                        {inf?.display_name}
                        {inf?.instagram_handle && (
                          <span className="ml-2 text-xs text-zinc-500">
                            @{inf.instagram_handle}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {Number(inf?.follower_count_total ?? 0).toLocaleString("en-IN")}{" "}
                        followers
                        {inf?.engagement_rate !== null && inf?.engagement_rate !== undefined && (
                          <> · {Number(inf.engagement_rate).toFixed(2)}%</>
                        )}
                        {inf?.city && <> · {inf.city}</>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${DECISION_STYLE[it.brand_decision] ?? DECISION_STYLE.pending}`}
                      >
                        {it.brand_decision}
                      </span>
                      <div className="mt-2 text-sm">
                        Cost {formatPaiseAsINR(cost)} → Brand {formatPaiseAsINR(price)}
                      </div>
                      <div className="text-xs text-emerald-700 dark:text-emerald-400">
                        Margin {formatPaiseAsINR(margin)} ({marginPctItem}%)
                      </div>
                    </div>
                  </div>

                  {it.brand_comment && (
                    <div className="mt-3 rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                      <strong>Brand:</strong> {it.brand_comment}
                    </div>
                  )}

                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                      Edit item
                    </summary>
                    <form
                      action={updateShortlistItemAction}
                      className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800"
                    >
                      <input type="hidden" name="item_id" value={it.id} />
                      <input type="hidden" name="campaign_id" value={campaignId} />

                      <label className="block">
                        <span className="text-xs font-medium">Rationale (shown to brand)</span>
                        <textarea
                          name="rationale"
                          rows={2}
                          defaultValue={it.rationale ?? ""}
                          className="input mt-1"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs font-medium">Creator cost (₹)</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            name="proposed_cost_rupees"
                            defaultValue={Math.round(cost / 100)}
                            className="input mt-1"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-medium">Brand price (₹)</span>
                          <input
                            type="number"
                            min="0"
                            step="100"
                            name="brand_price_rupees"
                            defaultValue={Math.round(price / 100)}
                            className="input mt-1"
                          />
                        </label>
                      </div>

                      <div>
                        <div className="text-xs font-medium">Deliverables</div>
                        <div className="mt-1 grid grid-cols-4 gap-2">
                          {DELIVERABLE_TYPES.map((d) => (
                            <label key={d.key} className="block text-xs">
                              <span>{d.label}</span>
                              <input
                                type="number"
                                min="0"
                                max="99"
                                step="1"
                                name={`deliv_${d.key}`}
                                defaultValue={delivMap.get(d.key) ?? ""}
                                className="input mt-1"
                              />
                            </label>
                          ))}
                        </div>
                      </div>

                      <label className="block">
                        <span className="text-xs font-medium">
                          Sample URLs (space or comma-separated)
                        </span>
                        <textarea
                          name="sample_urls"
                          rows={2}
                          defaultValue={(it.sample_urls ?? []).join(" ")}
                          className="input mt-1"
                        />
                      </label>

                      <div className="flex gap-2">
                        <SubmitButton pendingLabel="Saving…">Save item</SubmitButton>
                      </div>
                    </form>

                    <form action={removeShortlistItemAction} className="mt-3">
                      <input type="hidden" name="item_id" value={it.id} />
                      <input type="hidden" name="campaign_id" value={campaignId} />
                      <SubmitButton variant="secondary" pendingLabel="Removing…">
                        Remove from shortlist
                      </SubmitButton>
                    </form>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">
            No creators in shortlist yet. Add some from your roster below, then send the
            package to the brand.
          </p>
        )}

        {rosterAvailableForShortlist.length > 0 && (
          <form
            action={addShortlistItemAction}
            className="mt-4 flex items-end gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40"
          >
            <input type="hidden" name="campaign_id" value={campaignId} />
            <label className="flex-1">
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Add creator from roster
              </span>
              <select name="influencer_id" required className="input mt-1">
                <option value="">— Choose —</option>
                {rosterAvailableForShortlist.map((r: any) => (
                  <option key={r.influencer_id} value={r.influencer_id}>
                    {r.influencers?.display_name}
                    {r.influencers?.instagram_handle
                      ? ` (@${r.influencers.instagram_handle})`
                      : ""}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton pendingLabel="Adding…">Add to shortlist</SubmitButton>
          </form>
        )}

        {shortlist && shortlist.length > 0 && (
          <form
            action={sendPackageToBrandAction}
            className="mt-4 flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <input type="hidden" name="campaign_id" value={campaignId} />
            <div>
              <div className="text-sm font-semibold">Send package to brand</div>
              <div className="mt-1 text-xs text-zinc-500">
                Snapshots the shortlist at current prices and emails{" "}
                {campaign.brands?.contact_email ?? "the brand"}. Brand approves or rejects
                each creator.
                {versions && versions.length > 0 && (
                  <> Last version sent: v{versions[0].version_number}.</>
                )}
              </div>
            </div>
            <SubmitButton pendingLabel="Sending…">Send package</SubmitButton>
          </form>
        )}
      </section>

      {versions && versions.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Package versions sent
          </h2>
          <ul className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            {versions.map((v: any) => (
              <li key={v.id}>
                v{v.version_number} — sent{" "}
                {new Date(v.sent_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                {v.sent_to_email && <> · to {v.sent_to_email}</>}
              </li>
            ))}
          </ul>
        </section>
      )}

    </div>
  );
}

function SuccessBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
      {children}
    </div>
  );
}

function MutedBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
      {children}
    </div>
  );
}

function humanErr(code: string): string {
  if (code.startsWith("illegal_transition_")) {
    const [, from, , to] = code.split("_");
    return `Can't move a campaign from ${from} to ${to}.`;
  }
  switch (code) {
    case "already_shortlisted":
      return "That creator is already on the shortlist.";
    case "influencer_not_on_roster":
      return "That creator isn't on your roster.";
    case "invalid_input":
      return "Missing or invalid input.";
    case "empty_shortlist":
      return "Add at least one creator to the shortlist before sending.";
    case "invalid_status":
      return "That status isn't recognised.";
    default:
      return decodeURIComponent(code);
  }
}

const NEXT_STEP_LABEL: Record<string, { label: string; variant?: "primary" | "success" }> = {
  active: { label: "Mark live", variant: "success" },
  completed: { label: "Mark completed", variant: "primary" },
  brand_approved: { label: "Mark brand approved" },
  pitching: { label: "Move back to pitching" },
};

function LifecycleControls({
  status,
  campaignId,
}: {
  status: string;
  campaignId: string;
}) {
  const transitions: Record<string, readonly string[]> = {
    draft: ["pitching", "cancelled"],
    pitching: ["draft", "brand_approved", "cancelled"],
    brand_approved: ["active", "pitching", "cancelled"],
    active: ["completed", "cancelled"],
    completed: [],
    cancelled: [],
  };
  const options = transitions[status] ?? [];
  if (options.length === 0) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      <span className="text-xs uppercase tracking-wide text-zinc-500">Next step</span>
      {options.map((next) => {
        const meta = NEXT_STEP_LABEL[next];
        const variant =
          next === "cancelled" ? "danger" : (meta?.variant ?? "secondary");
        const label = meta?.label ?? `Set ${next.replace("_", " ")}`;
        return (
          <form key={next} action={setCampaignStatusAction}>
            <input type="hidden" name="campaign_id" value={campaignId} />
            <input type="hidden" name="target_status" value={next} />
            <SubmitButton
              variant={variant}
              className="!px-3 !py-1.5 !text-xs"
              pendingLabel="Saving…"
            >
              {next === "cancelled" ? "Cancel campaign" : label}
            </SubmitButton>
          </form>
        );
      })}
    </div>
  );
}
