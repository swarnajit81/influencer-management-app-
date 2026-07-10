// Cross-tenant probe: create a second agency, authenticate as it, then try to
// read tenant A's campaigns/contracts/payouts and the influencer's bank details.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const lines = readFileSync(".env.local", "utf8").split("\n");
const env = Object.fromEntries(
  lines
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(SB_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const EVIL = "qa-evil-agency@example.com";

async function sessionFor(email) {
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;
  const anon = createClient(SB_URL, ANON, { auth: { persistSession: false } });
  const { data, error: e2 } = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.properties.hashed_token,
  });
  if (e2) throw e2;
  return createClient(SB_URL, ANON, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false },
  });
}

// Create the second agency if it doesn't exist.
const { data: existing } = await admin
  .from("profiles")
  .select("id")
  .eq("email", EVIL)
  .maybeSingle();

if (!existing) {
  const { error } = await admin.auth.admin.createUser({
    email: EVIL,
    email_confirm: true,
    user_metadata: { role: "agency_member", full_name: "Evil QA", agency_name: "Evil QA Agency" },
  });
  if (error) throw error;
  console.log("created second agency user");
}

const evil = await sessionFor(EVIL);

// Tenant A's real records (fetched with service role for comparison).
const { data: aCampaigns } = await admin.from("campaigns").select("id,name");
const { data: aContracts } = await admin.from("contracts").select("id");
const { data: aInfluencers } = await admin
  .from("influencers")
  .select("id,display_name,bank_account_number");
console.log(
  `tenant A truth: ${aCampaigns.length} campaigns, ${aContracts.length} contracts, ${aInfluencers.length} influencers\n`,
);

const checks = [
  ["campaigns", () => evil.from("campaigns").select("id,name")],
  ["contracts", () => evil.from("contracts").select("id,total_amount_inr_paise")],
  ["brands", () => evil.from("brands").select("id,name")],
  ["payouts", () => evil.from("payouts").select("id,amount_inr_paise")],
  ["deliverables", () => evil.from("deliverables").select("id,description")],
  ["audit_log", () => evil.from("audit_log").select("id,action")],
  [
    "influencers (bank details)",
    () => evil.from("influencers").select("id,display_name,bank_account_number,bank_ifsc,pan"),
  ],
];

console.log("--- BEFORE roster-add (evil agency has no roster) ---");
for (const [label, fn] of checks) {
  const { data, error } = await fn();
  const n = data?.length ?? 0;
  console.log(
    `${n > 0 ? "*** LEAK" : "ok      "}  ${label.padEnd(28)} rows=${n}${error ? " err=" + error.message.slice(0, 40) : ""}`,
  );
}

// Now: evil agency adds tenant A's influencer to its own roster — no consent required.
const victim = aInfluencers.find((i) => i.bank_account_number) ?? aInfluencers[0];
const { data: evilProfile } = await admin
  .from("profiles")
  .select("id")
  .eq("email", EVIL)
  .single();
const { data: evilMembership } = await admin
  .from("agency_members")
  .select("agency_id")
  .eq("profile_id", evilProfile.id)
  .single();

const { error: rosterErr } = await evil.from("agency_influencer_roster").insert({
  agency_id: evilMembership.agency_id,
  influencer_id: victim.id,
  added_by: evilProfile.id,
});
console.log(
  `\nevil agency roster-add of victim influencer -> ${rosterErr ? "BLOCKED: " + rosterErr.message.slice(0, 50) : "ALLOWED (no influencer consent)"}`,
);

console.log("\n--- AFTER roster-add ---");
const { data: stolen, error: stolenErr } = await evil
  .from("influencers")
  .select("id,display_name,bank_account_number,bank_ifsc,pan,razorpay_fund_account_id");
if (stolenErr) {
  console.log("ok        influencer read blocked:", stolenErr.message.slice(0, 60));
} else if (stolen?.length) {
  for (const s of stolen) {
    const masked = s.bank_account_number
      ? "PRESENT(" + String(s.bank_account_number).length + " chars)"
      : "null";
    console.log(
      `*** LEAK  influencer "${s.display_name}" bank_account=${masked} ifsc=${s.bank_ifsc ?? "null"} pan=${s.pan ? "PRESENT" : "null"}`,
    );
  }
} else {
  console.log("ok        no influencer rows visible");
}

// Can evil agency now also see the victim's contracts / payouts?
const { data: c2 } = await evil.from("contracts").select("id");
const { data: p2 } = await evil.from("payouts").select("id");
console.log(
  `after roster-add: contracts visible=${c2?.length ?? 0}, payouts visible=${p2?.length ?? 0}`,
);
