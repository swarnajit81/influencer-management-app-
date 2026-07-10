// Probes every public table with the browser-exposed publishable key.
// Any row returned is an RLS hole: that key ships in the client bundle.
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

const base = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const tables = [
  "profiles", "agencies", "agency_members", "brands", "brand_members",
  "influencers", "agency_influencer_roster", "campaigns", "campaign_invitations",
  "contracts", "deliverables", "deliverable_submissions", "payouts", "audit_log",
];

for (const t of tables) {
  const r = await fetch(`${base}/rest/v1/${t}?select=*&limit=3`, {
    headers: { apikey: key },
  });
  const body = await r.text();
  let detail;
  let leak = false;
  try {
    const j = JSON.parse(body);
    if (Array.isArray(j)) {
      detail = `${j.length} rows`;
      leak = j.length > 0;
    } else {
      detail = (j.message ?? "").slice(0, 50);
    }
  } catch {
    detail = body.slice(0, 40);
  }
  console.log(`${leak ? "*** LEAK" : "ok      "}  ${t.padEnd(24)} ${r.status}  ${detail}`);
}

// Anonymous write attempt — RLS should reject.
const w = await fetch(`${base}/rest/v1/agencies`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "qa-anon-write", slug: "qa-anon-write-" + Date.now() }),
});
console.log(`\nanon INSERT into agencies -> ${w.status} ${w.status >= 400 ? "(blocked, good)" : "*** WRITABLE"}`);
