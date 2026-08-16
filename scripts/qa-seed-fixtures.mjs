// Seed dummy brands + influencers for the QA agency (qa-agency@example.com).
// Idempotent: wipes anything previously seeded (identified by the
// @qa-fixtures.test contact_email marker) before inserting fresh rows.
//
// Usage:
//   node scripts/qa-seed-fixtures.mjs
//   node scripts/qa-seed-fixtures.mjs --clean       # wipe + exit (no re-seed)
//   node scripts/qa-seed-fixtures.mjs --count 60    # seed N influencers
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
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const AGENCY_EMAIL = "qa-agency@example.com";
const MARKER = "@qa-fixtures.test";

const args = process.argv.slice(2);
const cleanOnly = args.includes("--clean");
const countArgIdx = args.indexOf("--count");
const INFLUENCER_COUNT = countArgIdx >= 0 ? Number(args[countArgIdx + 1]) : 45;
const BRAND_COUNT = 10;

// Resolve the QA agency.
const { data: profile } = await admin
  .from("profiles")
  .select("id, agency_members(agency_id)")
  .eq("email", AGENCY_EMAIL)
  .single();
if (!profile) {
  console.error(`No profile for ${AGENCY_EMAIL}. Sign up via /signup or /dev-login first.`);
  process.exit(1);
}
const agencyId = profile.agency_members[0].agency_id;
const profileId = profile.id;
console.log(`agency=${agencyId} profile=${profileId}`);

// -------- clean previous seed --------
// Brands: match on contact_email marker.
const { data: oldBrands } = await admin
  .from("brands")
  .select("id, contact_email")
  .eq("agency_id", agencyId)
  .like("contact_email", `%${MARKER}`);
if (oldBrands?.length) {
  const brandIds = oldBrands.map((b) => b.id);
  // Skip brands referenced by campaigns to avoid FK violation.
  const { data: usedBrandCampaigns } = await admin
    .from("campaigns")
    .select("brand_id")
    .in("brand_id", brandIds);
  const usedBrandSet = new Set((usedBrandCampaigns ?? []).map((c) => c.brand_id));
  const deletable = brandIds.filter((id) => !usedBrandSet.has(id));
  if (deletable.length) {
    const { error } = await admin.from("brands").delete().in("id", deletable);
    if (error) console.warn("brand cleanup:", error.message);
    else console.log(`deleted ${deletable.length} old QA brand(s)`);
  }
  const skipped = brandIds.length - deletable.length;
  if (skipped > 0) console.log(`skipped ${skipped} brand(s) still referenced by campaigns`);
}

// Influencers: match on contact_email marker.
const { data: oldInfs } = await admin
  .from("influencers")
  .select("id")
  .like("contact_email", `%${MARKER}`);
if (oldInfs?.length) {
  const ids = oldInfs.map((i) => i.id);
  // Skip influencers referenced by shortlist rows (FK is on delete restrict).
  const { data: usedShort } = await admin
    .from("campaign_shortlist_items")
    .select("influencer_id")
    .in("influencer_id", ids);
  const usedSet = new Set((usedShort ?? []).map((s) => s.influencer_id));
  const deletable = ids.filter((id) => !usedSet.has(id));
  if (deletable.length) {
    // Roster + rate card cascade on influencer delete.
    const { error } = await admin.from("influencers").delete().in("id", deletable);
    if (error) console.warn("influencer cleanup:", error.message);
    else console.log(`deleted ${deletable.length} old QA influencer(s)`);
  }
  const skipped = ids.length - deletable.length;
  if (skipped > 0) console.log(`skipped ${skipped} influencer(s) still referenced by shortlists`);
}

if (cleanOnly) {
  console.log("clean-only mode — done");
  process.exit(0);
}

// -------- fresh seed --------
const BRAND_SEEDS = [
  { name: "Sattva Ayurveda", handle: "sattva" },
  { name: "Kolkata Coffee Co.", handle: "kolkata-coffee" },
  { name: "Himalaya Trails", handle: "himalaya-trails" },
  { name: "Kanchipuram Silks", handle: "kanchi-silks" },
  { name: "Mango & Co.", handle: "mango-and-co" },
  { name: "Delhi Streetwear Lab", handle: "dsl" },
  { name: "Chennai Techspace", handle: "chennai-tech" },
  { name: "Nilgiri Tea House", handle: "nilgiri-tea" },
  { name: "Bombay Bath Co.", handle: "bombay-bath" },
  { name: "Rann Riders", handle: "rann-riders" },
];

const brandRows = BRAND_SEEDS.slice(0, BRAND_COUNT).map((b) => ({
  agency_id: agencyId,
  name: b.name,
  contact_email: `contact+${b.handle}${MARKER}`,
  contact_phone: `+9198${String(Math.floor(1e7 + Math.random() * 9e7)).slice(0, 8)}`,
}));

const { data: brandsInserted, error: brandErr } = await admin
  .from("brands")
  .upsert(brandRows, { onConflict: "agency_id,name", ignoreDuplicates: false })
  .select("id, name");
if (brandErr) {
  console.error("brand insert failed:", brandErr.message);
  process.exit(1);
}
console.log(`inserted/updated ${brandsInserted.length} brand(s)`);

// -------- influencers --------
const FIRST = [
  "Aarav", "Aditi", "Ananya", "Arjun", "Diya", "Ishaan", "Kavya", "Krish",
  "Meera", "Neha", "Nikhil", "Priya", "Rahul", "Riya", "Rohan", "Saanvi",
  "Sanya", "Shaurya", "Siya", "Tara", "Vihaan", "Ved", "Zara", "Zoya",
  "Ayaan", "Kabir", "Lakshmi", "Maanvi", "Reyansh", "Trisha",
];
const LAST = [
  "Sharma", "Iyer", "Patel", "Reddy", "Nair", "Khan", "Kapoor", "Menon",
  "Bose", "Rao", "Das", "Chopra", "Ghosh", "Malhotra", "Verma", "Bhat",
  "Joshi", "Shetty", "Roy", "Pillai",
];
const CITIES = [
  "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata", "Pune",
  "Ahmedabad", "Jaipur", "Goa", "Chandigarh", "Lucknow", "Kochi", "Indore",
];
const NICHES = [
  "fashion", "beauty", "food", "fitness", "travel", "tech", "gaming",
  "lifestyle", "parenting", "finance", "comedy", "music", "sustainability",
  "wellness", "dance",
];
const PLATFORMS = ["instagram", "youtube"];
const DELIVERABLE_TYPES = [
  "instagram_post", "instagram_reel", "instagram_story",
  "youtube_video", "youtube_short", "twitter_post", "blog_post",
];

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
const sampleN = (arr, n) => {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};

const usedHandles = new Set();
const influencerRows = [];
for (let i = 0; i < INFLUENCER_COUNT; i++) {
  const first = rand(FIRST);
  const last = rand(LAST);
  let handleBase = `${first}${last}`.toLowerCase();
  let handle = handleBase;
  let n = 1;
  while (usedHandles.has(handle)) handle = `${handleBase}${++n}`;
  usedHandles.add(handle);

  const platform = rand(PLATFORMS);
  const followers = randInt(5_000, 500_000);
  const engagement = (0.8 + Math.random() * 6).toFixed(2);
  const niches = sampleN(NICHES, randInt(1, 3));

  influencerRows.push({
    display_name: `${first} ${last}`,
    bio: `${niches.join(" / ")} creator based in India.`,
    primary_platform: platform,
    instagram_handle: platform === "instagram" ? handle : (Math.random() < 0.5 ? handle : null),
    youtube_handle: platform === "youtube" ? handle : (Math.random() < 0.3 ? handle : null),
    follower_count_total: followers,
    engagement_rate: Number(engagement),
    niches,
    city: rand(CITIES),
    state: null,
    contact_email: `${handle}${MARKER}`,
    contact_phone: `+9198${String(randInt(10_000_000, 99_999_999))}`,
    notes: null,
  });
}

const { data: infsInserted, error: infErr } = await admin
  .from("influencers")
  .insert(influencerRows)
  .select("id, display_name");
if (infErr) {
  console.error("influencer insert failed:", infErr.message);
  process.exit(1);
}
console.log(`inserted ${infsInserted.length} influencer(s)`);

// -------- roster join --------
const rosterRows = infsInserted.map((i) => ({
  agency_id: agencyId,
  influencer_id: i.id,
  added_by: profileId,
  notes: "qa-fixtures",
}));
const { error: rosterErr } = await admin
  .from("agency_influencer_roster")
  .upsert(rosterRows, { onConflict: "agency_id,influencer_id" });
if (rosterErr) console.warn("roster insert:", rosterErr.message);
else console.log(`added ${rosterRows.length} to roster`);

// -------- rate cards --------
const rateRows = [];
for (const inf of infsInserted) {
  const types = sampleN(DELIVERABLE_TYPES, randInt(2, 4));
  for (const type of types) {
    // Baseline pricing tied loosely to deliverable type.
    const base = {
      instagram_post: 30_000,
      instagram_reel: 60_000,
      instagram_story: 8_000,
      youtube_video: 150_000,
      youtube_short: 40_000,
      twitter_post: 10_000,
      blog_post: 25_000,
    }[type] ?? 20_000;
    const cost = randInt(base * 0.6, base * 1.6);
    rateRows.push({
      influencer_id: inf.id,
      deliverable_type: type,
      cost_inr_paise: cost * 100,
    });
  }
}
const { error: rateErr } = await admin
  .from("influencer_rate_card")
  .upsert(rateRows, { onConflict: "influencer_id,deliverable_type" });
if (rateErr) console.warn("rate card insert:", rateErr.message);
else console.log(`inserted ${rateRows.length} rate card row(s)`);

console.log(`\n✓ QA fixtures ready: ${brandsInserted.length} brands, ${infsInserted.length} influencers`);
