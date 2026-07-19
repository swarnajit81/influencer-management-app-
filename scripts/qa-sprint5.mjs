// Sprint 5 smoke test: agency inbox unread accounting.
// Seeds a brand-authored package_event + campaign_message on a real
// agency campaign, then verifies:
//   - unread count grows by exactly 2 for the QA agency owner
//   - bumping last_inbox_seen_at drops unread back to 0
// Mirrors the queries in src/lib/inbox.ts.
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

let PASS = 0, FAIL = 0;
const ok = (c, m) => {
  c ? PASS++ : FAIL++;
  console.log(`${c ? "  PASS" : "**FAIL"}  ${m}`);
};

const AGENCY_EMAIL = "qa-agency@example.com";

const { data: profile } = await admin
  .from("profiles")
  .select("id, agency_members(agency_id)")
  .eq("email", AGENCY_EMAIL)
  .single();
if (!profile) {
  console.error(`No profile for ${AGENCY_EMAIL}. Sign up first via /signup.`);
  process.exit(1);
}
const agencyId = profile.agency_members[0].agency_id;
const profileId = profile.id;
console.log(`agency=${agencyId} profile=${profileId}`);

// Verify migration applied.
const { data: memberRow, error: memberErr } = await admin
  .from("agency_members")
  .select("last_inbox_seen_at")
  .eq("agency_id", agencyId)
  .eq("profile_id", profileId)
  .single();
if (memberErr) {
  console.error("agency_members read failed:", memberErr.message);
  process.exit(1);
}
ok(memberRow.last_inbox_seen_at !== undefined, "last_inbox_seen_at column present");

// Reset seen to epoch so counts are deterministic.
await admin
  .from("agency_members")
  .update({ last_inbox_seen_at: "1970-01-01T00:00:00Z" })
  .eq("agency_id", agencyId)
  .eq("profile_id", profileId);

// Grab (or create) a campaign owned by this agency.
let { data: campaign } = await admin
  .from("campaigns")
  .select("id")
  .eq("agency_id", agencyId)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (!campaign) {
  const { data: brand } = await admin
    .from("brands")
    .select("id")
    .eq("agency_id", agencyId)
    .limit(1)
    .maybeSingle();
  if (!brand) {
    console.error("No brand exists — cannot create campaign for smoke test.");
    process.exit(1);
  }
  const { data: c, error: cErr } = await admin
    .from("campaigns")
    .insert({
      agency_id: agencyId,
      brand_id: brand.id,
      name: "Sprint 5 Inbox QA",
      brief: "Inbox smoke test.",
      total_budget_inr_paise: 10000000,
      start_date: "2026-08-01",
      end_date: "2026-09-30",
      status: "draft",
      created_by: profileId,
    })
    .select("id")
    .single();
  if (cErr) {
    console.error("campaign insert failed:", cErr.message);
    process.exit(1);
  }
  campaign = c;
}
const campaignId = campaign.id;
console.log(`campaign=${campaignId}`);

const countUnread = async () => {
  const { data: seen } = await admin
    .from("agency_members")
    .select("last_inbox_seen_at")
    .eq("agency_id", agencyId)
    .eq("profile_id", profileId)
    .single();
  const since = seen.last_inbox_seen_at;

  const [ev, msg] = await Promise.all([
    admin
      .from("package_events")
      .select("id, campaigns!inner(agency_id)", { head: true, count: "exact" })
      .eq("campaigns.agency_id", agencyId)
      .eq("actor_kind", "brand")
      .gt("occurred_at", since),
    admin
      .from("campaign_messages")
      .select("id, campaigns!inner(agency_id)", { head: true, count: "exact" })
      .eq("campaigns.agency_id", agencyId)
      .eq("sender_kind", "brand")
      .gt("created_at", since),
  ]);
  return (ev.count ?? 0) + (msg.count ?? 0);
};

const before = await countUnread();
console.log(`unread before seed=${before}`);

// Seed one brand package_event + one brand campaign_message.
const { error: evErr } = await admin.from("package_events").insert({
  campaign_id: campaignId,
  actor_kind: "brand",
  event_type: "package_viewed",
  metadata: { source: "qa-sprint5" },
});
ok(!evErr, `brand package_event seeded${evErr ? `: ${evErr.message}` : ""}`);

const { error: msgErr } = await admin.from("campaign_messages").insert({
  campaign_id: campaignId,
  sender_kind: "brand",
  body: "QA sprint5: brand inbox message ping",
});
ok(!msgErr, `brand campaign_message seeded${msgErr ? `: ${msgErr.message}` : ""}`);

const after = await countUnread();
console.log(`unread after seed=${after}`);
ok(after === before + 2, `unread grew by 2 (${before} -> ${after})`);

// Bump seen; count should drop to 0.
await admin
  .from("agency_members")
  .update({ last_inbox_seen_at: new Date().toISOString() })
  .eq("agency_id", agencyId)
  .eq("profile_id", profileId);

const cleared = await countUnread();
console.log(`unread after markSeen=${cleared}`);
ok(cleared === 0, `unread cleared after markInboxSeen`);

console.log(`\n${PASS} pass, ${FAIL} fail`);
process.exit(FAIL > 0 ? 1 : 0);
