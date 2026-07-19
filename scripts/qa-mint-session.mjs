// Mint a Supabase SSR session cookie jar for the QA agency and dump it in
// Netscape/curl format. Prints jar path on the last line.
//   node scripts/qa-mint-session.mjs qa-agency@example.com > /tmp/jar.txt
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { readFileSync, writeFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const email = process.argv[2] ?? "qa-agency@example.com";
const jarPath = process.argv[3] ?? "/tmp/agency-cookies.jar";

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
});
if (linkErr) throw linkErr;
const tokenHash = link.properties.hashed_token;

const store = new Map();
const ssr = createServerClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    cookies: {
      getAll() {
        return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
      },
      setAll(cookies) {
        for (const { name, value, options } of cookies) {
          if (options?.maxAge === 0 || value === "") store.delete(name);
          else store.set(name, value);
        }
      },
    },
  },
);

const { data, error } = await ssr.auth.verifyOtp({
  token_hash: tokenHash,
  type: "magiclink",
});
if (error) throw error;
if (!data.session) throw new Error("no session");

const lines = ["# Netscape HTTP Cookie File"];
for (const [name, value] of store) {
  lines.push(["localhost", "FALSE", "/", "FALSE", "0", name, value].join("\t"));
}
writeFileSync(jarPath, lines.join("\n") + "\n");
console.error(`user=${data.session.user.email} cookies=${store.size}`);
console.log(jarPath);
