// Seed one end-to-end demo campaign for the demo agency: creates the
// campaign, picks 3 creators from the roster, sets prices + deliverables,
// and freezes package v1 so /dev-brand has something to open.
//
//   SEED_AGENCY_EMAIL=demo-agency@example.com node scripts/qa-seed-demo-campaign.mjs
//
// Idempotent-ish: skips if a campaign named "Diwali '26 Skincare Demo"
// already exists for the agency.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const AGENCY_EMAIL = process.env.SEED_AGENCY_EMAIL ?? "demo-agency@example.com";
const CAMPAIGN_NAME = "Diwali '26 Skincare Demo";

// Resolve agency + profile.
const { data: profile } = await admin
  .from("profiles")
  .select("id, agency_members(agency_id)")
  .eq("email", AGENCY_EMAIL)
  .single();
if (!profile) throw new Error(`No profile for ${AGENCY_EMAIL}`);
const agencyId = profile.agency_members[0].agency_id;
const profileId = profile.id;
console.log(`agency=${agencyId} profile=${profileId}`);

// Bail if already seeded.
const { data: existing } = await admin
  .from("campaigns")
  .select("id, name")
  .eq("agency_id", agencyId)
  .eq("name", CAMPAIGN_NAME)
  .maybeSingle();
if (existing) {
  console.log(`campaign already exists: ${existing.id} — nothing to do`);
  process.exit(0);
}

// Pick a brand seeded by qa-seed-fixtures.
const { data: brand } = await admin
  .from("brands")
  .select("id, name")
  .eq("agency_id", agencyId)
  .eq("name", "Sattva Ayurveda")
  .maybeSingle();
if (!brand) throw new Error("Sattva Ayurveda brand missing — run qa-seed-fixtures first");
console.log(`brand=${brand.id} (${brand.name})`);

// Grab 3 creators from the roster.
const { data: roster } = await admin
  .from("agency_influencer_roster")
  .select("influencer_id, influencers ( id, display_name )")
  .eq("agency_id", agencyId)
  .limit(3);
if (!roster || roster.length < 3) throw new Error("roster too small");
console.log(`picking creators: ${roster.map((r) => r.influencers.display_name).join(", ")}`);

// Create campaign.
const { data: campaign, error: cErr } = await admin
  .from("campaigns")
  .insert({
    agency_id: agencyId,
    brand_id: brand.id,
    name: CAMPAIGN_NAME,
    brief:
      "Demo campaign for the platform walkthrough. 3 creators across Instagram reels and stories.",
    total_budget_inr_paise: 30_000_000, // 3L
    start_date: "2026-10-01",
    end_date: "2026-11-30",
    status: "draft",
    created_by: profileId,
  })
  .select("id")
  .single();
if (cErr) throw cErr;
const campaignId = campaign.id;
console.log(`campaign=${campaignId}`);

// Shortlist items with realistic prices + deliverables.
const items = [
  {
    influencer_id: roster[0].influencer_id,
    proposed_cost_inr_paise: 6_000_000, // 60k
    brand_price_inr_paise: 9_000_000, // 90k
    deliverables: [
      { type: "instagram_reel", count: 1 },
      { type: "instagram_story", count: 2 },
    ],
    rationale: "Strong beauty/skincare audience; historic engagement 4.6%.",
    sample_urls: ["https://instagram.com/p/sample-1"],
  },
  {
    influencer_id: roster[1].influencer_id,
    proposed_cost_inr_paise: 4_500_000, // 45k
    brand_price_inr_paise: 7_000_000, // 70k
    deliverables: [{ type: "instagram_reel", count: 1 }],
    rationale: "Lower cost, high engagement; good for reach top-up.",
    sample_urls: [],
  },
  {
    influencer_id: roster[2].influencer_id,
    proposed_cost_inr_paise: 5_500_000, // 55k
    brand_price_inr_paise: 8_000_000, // 80k
    deliverables: [
      { type: "instagram_post", count: 1 },
      { type: "instagram_story", count: 3 },
    ],
    rationale: "Lifestyle overlap; brand has worked with them once before.",
    sample_urls: [],
  },
];

const { data: inserted, error: iErr } = await admin
  .from("campaign_shortlist_items")
  .insert(
    items.map((it) => ({
      campaign_id: campaignId,
      ...it,
    })),
  )
  .select("id, influencer_id, proposed_cost_inr_paise, brand_price_inr_paise, deliverables, sample_urls, rationale, influencers ( id, display_name, instagram_handle, youtube_handle, follower_count_total, engagement_rate, city, niches, bio )");
if (iErr) throw iErr;
console.log(`inserted ${inserted.length} shortlist rows`);

// Freeze package v1.
const { data: agency } = await admin
  .from("agencies")
  .select("name")
  .eq("id", agencyId)
  .single();

const snapshot = {
  campaign: {
    id: campaignId,
    name: CAMPAIGN_NAME,
    brief: "Demo campaign for the platform walkthrough. 3 creators across Instagram reels and stories.",
    total_budget_inr_paise: 30_000_000,
    start_date: "2026-10-01",
    end_date: "2026-11-30",
  },
  agency: { name: agency?.name ?? null },
  brand: { name: brand.name },
  items: inserted.map((row) => {
    const inf = Array.isArray(row.influencers) ? row.influencers[0] : row.influencers;
    return {
      id: row.id,
      rationale: row.rationale,
      brand_price_inr_paise: Number(row.brand_price_inr_paise),
      deliverables: row.deliverables,
      sample_urls: row.sample_urls ?? [],
      influencer: {
        display_name: inf.display_name,
        instagram_handle: inf.instagram_handle,
        youtube_handle: inf.youtube_handle,
        follower_count_total: Number(inf.follower_count_total ?? 0),
        engagement_rate: inf.engagement_rate ? Number(inf.engagement_rate) : null,
        city: inf.city,
        niches: inf.niches,
        bio: inf.bio,
      },
    };
  }),
};

const { data: version, error: vErr } = await admin
  .from("package_versions")
  .insert({
    campaign_id: campaignId,
    version_number: 1,
    sent_at: new Date().toISOString(),
    sent_to_email: "brand-contact@example.com",
    sent_by_profile_id: profileId,
    snapshot,
  })
  .select("id, version_number")
  .single();
if (vErr) throw vErr;
console.log(`package v${version.version_number} frozen (id=${version.id})`);

// Update campaign status + log event.
await admin
  .from("campaigns")
  .update({ status: "pitching" })
  .eq("id", campaignId);

await admin.from("package_events").insert({
  campaign_id: campaignId,
  package_version_id: version.id,
  actor_kind: "agency",
  actor_profile_id: profileId,
  event_type: "package_sent",
  metadata: { version: 1, source: "qa-seed-demo-campaign" },
});

console.log(`\n✓ demo campaign ready: ${CAMPAIGN_NAME}`);
console.log(`  /agency/campaigns/${campaignId}`);
console.log(`  Send v1 via /dev-brand`);
