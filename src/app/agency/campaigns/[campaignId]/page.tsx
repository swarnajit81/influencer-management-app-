import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/getCurrentUser";
import { formatPaiseAsINR } from "@/lib/money";
import { inviteInfluencerAction } from "@/app/(auth)/actions";

export default async function CampaignDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ campaignId: string }>;
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  const { campaignId } = await params;
  const { error, invited } = await searchParams;
  const user = await requireRole("agency_member");

  const supabase = await createSupabaseServerClient();

  // Fetch campaign
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*, brands (name)")
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

  // Fetch invitations for this campaign
  const { data: invitations } = await supabase
    .from("campaign_invitations")
    .select(
      `
      id,
      status,
      offer_amount_inr_paise,
      responded_at,
      influencers (id, display_name, instagram_handle),
      contracts (id, status)
    `,
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  // Fetch agency's roster for invite dropdown
  const { data: roster } = await supabase
    .from("agency_influencer_roster")
    .select(
      `
      influencer_id,
      influencers (id, display_name, instagram_handle)
    `,
    )
    .eq("agency_id", user.agencyId);

  // Filter out already-invited influencers
  const alreadyInvited = new Set(invitations?.map((i: any) => i.influencers?.id) ?? []);
  const availableInfluencers = roster?.filter(
    (r: any) => !alreadyInvited.has(r.influencer_id),
  ) ?? [];

  return (
    <div className="max-w-4xl">
      <Link
        href="/agency/campaigns"
        className="mb-6 inline-block text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        ← Back to campaigns
      </Link>

      <div className="mb-8 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{campaign.name}</h1>
            <p className="mt-1 text-sm text-zinc-500">{campaign.brands?.name}</p>
          </div>
          <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {campaign.status}
          </span>
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
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}
      {invited && (
        <div className="mb-6 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
          Invitation sent!
        </div>
      )}

      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Invitations</h2>

        {invitations && invitations.length > 0 ? (
          <div className="space-y-3">
            {invitations.map((inv: any) => {
              const contract = Array.isArray(inv.contracts)
                ? inv.contracts[0]
                : inv.contracts;
              return (
                <div
                  key={inv.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div>
                    <p className="font-medium">{inv.influencers?.display_name}</p>
                    <p className="text-sm text-zinc-500">@{inv.influencers?.instagram_handle}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatPaiseAsINR(inv.offer_amount_inr_paise)}
                      </p>
                      <p className="text-xs text-zinc-500">{inv.status}</p>
                    </div>
                    {contract?.id && (
                      <Link
                        href={`/agency/contracts/${contract.id}`}
                        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        Manage →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No invitations yet.</p>
        )}
      </div>

      {availableInfluencers.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
          <h3 className="mb-4 font-semibold">Invite influencer</h3>
          <form action={inviteInfluencerAction} className="space-y-4">
            <input type="hidden" name="campaign_id" value={campaignId} />

            <label className="block">
              <span className="text-sm font-medium">Creator</span>
              <select
                name="influencer_id"
                className="input mt-1"
                required
              >
                <option value="">— Select a creator —</option>
                {availableInfluencers.map((r: any) => (
                  <option key={r.influencer_id} value={r.influencer_id}>
                    {r.influencers?.display_name} (@{r.influencers?.instagram_handle})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium">Offer amount (₹)</span>
              <input
                name="offer_amount_rupees"
                type="number"
                step="100"
                min="0"
                className="input mt-1"
                required
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Message (optional)</span>
              <textarea name="offer_message" rows={3} className="input mt-1" />
            </label>

            <button
              type="submit"
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Send invitation
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
