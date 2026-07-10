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

const { data, error } = await admin.auth.admin.createUser({
  email: "qa-influencer@example.com",
  email_confirm: true,
  user_metadata: {
    role: "influencer",
    full_name: "QA Influencer",
  },
});
if (error) throw error;
console.log("created user", data.user.id);

const { data: inf } = await admin
  .from("influencers")
  .select("id, display_name")
  .eq("profile_id", data.user.id)
  .single();
console.log("influencer row", inf);
