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
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: profiles, error } = await admin
  .from("profiles")
  .select("id, email, full_name, primary_role")
  .eq("primary_role", "agency_member")
  .limit(5);
if (error) throw error;
console.log("agency profiles:", profiles);

const email = process.argv[2] ?? profiles?.[0]?.email;
if (!email) {
  console.log("NO_AGENCY_USER");
  process.exit(0);
}

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: "http://localhost:3000/auth/callback" },
});
if (linkErr) throw linkErr;
console.log("LOGIN_LINK", link.properties.action_link);
