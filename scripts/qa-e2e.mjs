// Headless end-to-end journey against the running dev server + local Supabase.
// Drives the real Next server actions (Next-Action header + $ACTION_ID field)
// with a real session cookie — mimics a user clicking through the app.
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
  (c ? PASS++ : FAIL++);
  console.log(`${c ? "  PASS" : "**FAIL"}  ${m}`);
};

// ---- cookie jar ----
let cookies = {};
function setCookiesFrom(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    cookies[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
}
const cookieHeader = () =>
  Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { cookie: cookieHeader() },
    redirect: "manual",
  });
  setCookiesFrom(res);
  const body = await res.text();
  return { status: res.status, loc: res.headers.get("location"), body };
}

// Invoke a server action by grabbing its $ACTION_ID off the page and POSTing FormData.
async function action(pagePath, fields, actionMatch) {
  const page = await get(pagePath);
  const ids = [...page.body.matchAll(/\$ACTION_ID_([a-f0-9]+)/g)].map((m) => m[1]);
  // pick the action id nearest the field names if multiple; default first
  const id = ids[0];
  if (!id) return { status: 0, error: "no action id on " + pagePath };
  const fd = new FormData();
  fd.set(`$ACTION_ID_${id}`, "");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  const res = await fetch(BASE + pagePath, {
    method: "POST",
    headers: { cookie: cookieHeader(), "Next-Action": id },
    body: fd,
    redirect: "manual",
  });
  setCookiesFrom(res);
  const body = await res.text();
  // server actions that redirect() return the location in an x-action-redirect header or body
  const redirect =
    res.headers.get("x-action-redirect") || res.headers.get("location") || null;
  return { status: res.status, redirect, body, actionId: id };
}

// ---------- 1. session via magic link (mimics clicking the email link) ----------
const EMAIL = "qa-agency@example.com";
const { data: link, error: le } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: EMAIL,
  options: { redirectTo: `${BASE}/auth/callback` },
});
if (le) throw le;
// verify via the hashed token to get a session, then set cookies as @supabase/ssr would
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});
const { data: sess, error: ve } = await anon.auth.verifyOtp({
  type: "magiclink",
  token_hash: link.properties.hashed_token,
});
if (ve) throw ve;
const s = sess.session;
const payload = {
  access_token: s.access_token,
  token_type: s.token_type,
  expires_in: s.expires_in,
  expires_at: s.expires_at,
  refresh_token: s.refresh_token,
  user: s.user,
};
const val = "base64-" + Buffer.from(JSON.stringify(payload)).toString("base64url");
const CH = 3180;
const ref = "sb-127-auth-token";
for (let i = 0, p = 0; p < val.length; p += CH, i++) cookies[`${ref}.${i}`] = val.slice(p, p + CH);

// ---------- 2. authenticated pages render ----------
const dash = await get("/agency");
ok(dash.status === 200 && /Welcome back/.test(dash.body), "dashboard renders authenticated");
const settings = await get("/agency/settings");
ok(settings.status === 200 && /Agency settings/.test(settings.body), "settings page renders");

// ---------- 3. edge: unauth redirect ----------
const savedJar = { ...cookies };
cookies = {};
const noauth = await get("/agency/payouts");
ok(noauth.status === 307 && /\/login/.test(noauth.loc || ""), "unauth /agency/payouts -> /login");
cookies = savedJar;

console.log(`\n---- session + render checks: ${PASS} pass, ${FAIL} fail ----`);

// ---------- 4. edge cases on public token surface (no cookie needed) ----------
const forged = await get("/p/invitation/forged.token");
ok(/isn't valid|not valid/i.test(forged.body), "forged invitation token rejected");

// Build signed tokens locally to test more edges.
const TOKEN_KEY = env.TOKEN_SIGNING_SECRET ?? "";
function b64url(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function makeToken(payload) {
  const encoded = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", TOKEN_KEY).update(encoded).digest());
  return `${encoded}.${sig}`;
}

if (TOKEN_KEY) {
  // Expired token — exp already passed.
  const expired = makeToken({
    kind: "invitation",
    invitationId: "00000000-0000-0000-0000-000000000000",
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  const expiredRes = await get(`/p/invitation/${encodeURIComponent(expired)}`);
  ok(/expired/i.test(expiredRes.body), "expired invitation token shows expired message");

  // Wrong kind — contract token used on invitation route.
  const wrongKind = makeToken({
    kind: "contract",
    contractId: "00000000-0000-0000-0000-000000000000",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const wrongRes = await get(`/p/invitation/${encodeURIComponent(wrongKind)}`);
  ok(
    /isn't an invitation link|Link not recognised/i.test(wrongRes.body),
    "wrong-kind token rejected on invitation route",
  );

  // Contract-token verifier on contract page with unknown ID → contract not found.
  const missingContract = makeToken({
    kind: "contract",
    contractId: "00000000-0000-0000-0000-000000000000",
    exp: Math.floor(Date.now() / 1000) + 60,
  });
  const missingRes = await get(`/p/contract/${encodeURIComponent(missingContract)}`);
  ok(
    /Contract not found/.test(missingRes.body),
    "valid contract token with unknown id → not found",
  );
} else {
  console.log("  SKIP  token edge tests (TOKEN_SIGNING_SECRET missing)");
}

console.log(`\n==== TOTAL: ${PASS} pass, ${FAIL} fail ====`);
process.exit(FAIL ? 1 : 0);
