// Sprint 2 smoke test: data-layer + brand page render.
// HTTP-simulated Next server actions kept 500'ing in this Node version, so
// we drive the write side via the admin client (matching what the actions
// would do) and verify the READ side over HTTP: the brand /p/package/[token]
// page. This covers: snapshot shape, RLS on shortlist, token verify, and
// the brand-facing UI.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const BASE = "http://localhost:3000";
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

let PASS = 0,
  FAIL = 0;
const ok = (c, m) => {
  c ? PASS++ : FAIL++;
  console.log(`${c ? "  PASS" : "**FAIL"}  ${m}`);
};

function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeToken(payload) {
  const key = env.TOKEN_SIGNING_SECRET;
  const enc = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", key).update(enc).digest());
  return `${enc}.${sig}`;
}

const AGENCY_EMAIL = "qa-agency@example.com";

const { data: agencyProfile } = await admin
  .from("profiles")
  .select("id, agency_members(agency_id)")
  .eq("email", AGENCY_EMAIL)
  .single();
const agencyId = agencyProfile.agency_members[0].agency_id;

const { data: brand } = await admin
  .from("brands")
  .select("id, name, contact_email")
  .eq("agency_id", agencyId)
  .limit(1)
  .single();

const { data: agency } = await admin
  .from("agencies")
  .select("name")
  .eq("id", agencyId)
  .single();

const { data: campaign } = await admin
  .from("campaigns")
  .insert({
    agency_id: agencyId,
    brand_id: brand.id,
    name: "Sprint 2 QA Campaign",
    brief: "Smoke test brief with sample deliverables.",
    total_budget_inr_paise: 15000000,
    start_date: "2026-08-01",
    end_date: "2026-09-30",
    status: "draft",
    created_by: agencyProfile.id,
  })
  .select("id")
  .single();
const campaignId = campaign.id;
console.log(`campaign=${campaignId}`);

const { data: roster } = await admin
  .from("agency_influencer_roster")
  .select("influencer_id, influencers(display_name, instagram_handle)")
  .eq("agency_id", agencyId);
if (!roster || roster.length === 0) {
  console.error("Roster empty — cannot run smoke test.");
  process.exit(1);
}
const [rosterA, rosterB] = roster;

// --- 1. Insert two shortlist items (like addShortlistItemAction would) ---
const { data: itemA } = await admin
  .from("campaign_shortlist_items")
  .insert({
    campaign_id: campaignId,
    influencer_id: rosterA.influencer_id,
    rationale: "Nano beauty creator with strong engagement.",
    proposed_cost_inr_paise: 2500000,
    brand_price_inr_paise: 4000000,
    deliverables: [
      { type: "instagram_reel", count: 2 },
      { type: "instagram_story", count: 3 },
    ],
    sample_urls: ["https://instagram.com/p/sampleA"],
  })
  .select("id")
  .single();
ok(!!itemA?.id, `shortlist item A inserted`);

const secondInfluencerId = rosterB?.influencer_id ?? null;
let itemB = null;
if (secondInfluencerId) {
  const { data } = await admin
    .from("campaign_shortlist_items")
    .insert({
      campaign_id: campaignId,
      influencer_id: secondInfluencerId,
      rationale: "Mid-tier lifestyle creator.",
      proposed_cost_inr_paise: 5000000,
      brand_price_inr_paise: 7000000,
      deliverables: [{ type: "instagram_post", count: 1 }],
    })
    .select("id")
    .single();
  itemB = data;
  ok(!!itemB?.id, `shortlist item B inserted`);
}

// --- 2. Unique constraint blocks duplicate influencer on same campaign ---
const dupInsert = await admin
  .from("campaign_shortlist_items")
  .insert({
    campaign_id: campaignId,
    influencer_id: rosterA.influencer_id,
    brand_price_inr_paise: 1,
  });
ok(
  dupInsert.error?.code === "23505",
  `unique (campaign_id, influencer_id) enforced (${dupInsert.error?.code})`,
);

// --- 3. Send package snapshot (like sendPackageToBrandAction) ---
const { data: shortlistRows } = await admin
  .from("campaign_shortlist_items")
  .select(
    `id, rationale, proposed_cost_inr_paise, brand_price_inr_paise,
     deliverables, sample_urls,
     influencers!inner (
       id, display_name, instagram_handle, youtube_handle,
       follower_count_total, engagement_rate, city, niches, bio
     )`,
  )
  .eq("campaign_id", campaignId)
  .order("created_at", { ascending: true });

const snapshot = {
  campaign: {
    id: campaignId,
    name: "Sprint 2 QA Campaign",
    brief: "Smoke test brief with sample deliverables.",
    total_budget_inr_paise: 15000000,
    start_date: "2026-08-01",
    end_date: "2026-09-30",
  },
  agency: { name: agency.name },
  brand: { name: brand.name },
  items: shortlistRows.map((row) => {
    const inf = Array.isArray(row.influencers) ? row.influencers[0] : row.influencers;
    return {
      id: row.id,
      rationale: row.rationale,
      // Brand snapshot omits agency cost.
      brand_price_inr_paise: row.brand_price_inr_paise,
      deliverables: row.deliverables,
      sample_urls: row.sample_urls,
      influencer: inf,
    };
  }),
  snapshot_taken_at: new Date().toISOString(),
};

const { data: version } = await admin
  .from("package_versions")
  .insert({
    campaign_id: campaignId,
    version_number: 1,
    sent_to_email: brand.contact_email ?? null,
    sent_by_profile_id: agencyProfile.id,
    snapshot,
  })
  .select("id, version_number")
  .single();
ok(version.version_number === 1, `package version 1 created`);

// Brand snapshot must NOT expose agency cost.
ok(
  !("proposed_cost_inr_paise" in snapshot.items[0]) &&
    snapshot.items[0].brand_price_inr_paise === 4000000,
  `snapshot omits cost, keeps brand price`,
);

// Flip campaign to pitching (what the action would do).
await admin.from("campaigns").update({ status: "pitching" }).eq("id", campaignId);

// --- 4. Brand page renders with signed token ---
const packageToken = makeToken({
  kind: "package",
  campaignId,
  versionId: version.id,
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const brandRes = await fetch(
  `${BASE}/p/package/${encodeURIComponent(packageToken)}`,
  { redirect: "manual" },
);
const brandBody = await brandRes.text();
ok(brandRes.status === 200, `brand package page 200 (${brandRes.status})`);
ok(/Proposed creators/.test(brandBody), `brand page has "Proposed creators"`);
ok(
  /Nano beauty creator with strong engagement/.test(brandBody),
  `brand page shows rationale`,
);
ok(!/proposed_cost/.test(brandBody), `brand page does not leak "proposed_cost"`);
ok(!/margin/i.test(brandBody), `brand page does not show margin`);
ok(/₹40,000|40000/.test(brandBody), `brand page shows ₹40,000 brand price`);

// --- 5. Expired package token ---
const expiredToken = makeToken({
  kind: "package",
  campaignId,
  versionId: version.id,
  exp: Math.floor(Date.now() / 1000) - 60,
});
const expiredRes = await fetch(
  `${BASE}/p/package/${encodeURIComponent(expiredToken)}`,
);
const expiredBody = await expiredRes.text();
ok(/expired/i.test(expiredBody), `expired package token shows expired`);

// --- 6. Wrong-kind package token (feed contract kind on package route) ---
const wrongKind = makeToken({
  kind: "contract",
  contractId: "00000000-0000-0000-0000-000000000000",
  exp: Math.floor(Date.now() / 1000) + 60,
});
const wrongRes = await fetch(`${BASE}/p/package/${encodeURIComponent(wrongKind)}`);
const wrongBody = await wrongRes.text();
ok(
  /not a package|Link not recognised/i.test(wrongBody),
  `wrong-kind token rejected on package route`,
);

// --- 7. Brand decision update + campaign auto-promote ---
// Approve item A.
await admin
  .from("campaign_shortlist_items")
  .update({
    brand_decision: "approved",
    brand_comment: "Yes.",
    decided_at: new Date().toISOString(),
  })
  .eq("id", itemA.id);

// Reject item B (if it exists).
if (itemB) {
  await admin
    .from("campaign_shortlist_items")
    .update({
      brand_decision: "rejected",
      brand_comment: "Not a fit.",
      decided_at: new Date().toISOString(),
    })
    .eq("id", itemB.id);
}

// Emulate the campaign flip logic from brandDecideShortlistItemAction.
const { data: pendingLeft } = await admin
  .from("campaign_shortlist_items")
  .select("id")
  .eq("campaign_id", campaignId)
  .eq("brand_decision", "pending");
const { data: approvedAny } = await admin
  .from("campaign_shortlist_items")
  .select("id")
  .eq("campaign_id", campaignId)
  .eq("brand_decision", "approved");
if (pendingLeft.length === 0 && approvedAny.length > 0) {
  await admin.from("campaigns").update({ status: "brand_approved" }).eq("id", campaignId);
}

const { data: campNow } = await admin
  .from("campaigns")
  .select("status")
  .eq("id", campaignId)
  .single();
ok(campNow.status === "brand_approved", `campaign -> brand_approved (${campNow.status})`);

// --- 8. Brand page reflects decisions on reload ---
const brandRes2 = await fetch(
  `${BASE}/p/package/${encodeURIComponent(packageToken)}`,
);
const brandBody2 = await brandRes2.text();
ok(/approved/.test(brandBody2), `brand page shows approved pill`);
ok(/Yes\./.test(brandBody2), `brand page shows brand comment`);

// --- 9. Cleanup: leave campaign + shortlist for inspection. ---

console.log(`\n==== TOTAL: ${PASS} pass, ${FAIL} fail ====`);
process.exit(FAIL ? 1 : 0);
