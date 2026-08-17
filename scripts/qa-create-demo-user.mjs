// One-shot: create a demo agency account on whichever Supabase stack
// .env.local currently points at. Safe to re-run: reports existing.
//   node scripts/qa-create-demo-user.mjs demo-agency@example.com "Demo Agency" "Demo Agency Owner"
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

const email = process.argv[2] ?? "demo-agency@example.com";
const agencyName = process.argv[3] ?? "Demo Agency";
const fullName = process.argv[4] ?? "Demo Agency Owner";

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: existing } = await admin.auth.admin.listUsers();
const found = existing?.users?.find((u) => u.email === email);
if (found) {
  console.log(`already exists: ${email} (id=${found.id})`);
  process.exit(0);
}

const { data, error } = await admin.auth.admin.createUser({
  email,
  email_confirm: true,
  user_metadata: {
    full_name: fullName,
    role: "agency_member",
    agency_name: agencyName,
  },
});
if (error) {
  console.error("createUser failed:", error.message);
  process.exit(1);
}
console.log(`created ${email} (id=${data.user.id})`);

// Wait a tick for the handle_new_user trigger to create profile + agencies + agency_members.
await new Promise((r) => setTimeout(r, 500));

const { data: profile } = await admin
  .from("profiles")
  .select("id, email, agency_members(agency_id)")
  .eq("email", email)
  .single();
console.log("profile:", JSON.stringify(profile));
