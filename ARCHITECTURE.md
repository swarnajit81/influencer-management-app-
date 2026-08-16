# Architecture

Onboarding doc for developers. Covers business model, system design, tech stack, current schema, and how to test end-to-end.

> **Heads-up for AI agents / new devs:** This project uses **Next.js 16** with the App Router. APIs and conventions differ from older Next.js versions. When in doubt, read the relevant guide in `node_modules/next/dist/docs/` before writing code.

---

## 1. Business model

PR agencies in India currently pitch influencer shortlists to brands over WhatsApp screenshots, PDFs, and long email threads. There is no system of record for who saw which version, at which price, and who approved which creator. This app replaces that pitch loop.

### Scope decision: agency-first, pitch-only

**v1 ships one app: the agency app**, plus a public brand-facing package portal reached only through a signed link. Everything downstream of brand approval — contracts, e-sign, content submission, payouts — is **out of scope** and stays in the agency's existing tooling.

The earlier `/influencer/*` and `/brand/*` route trees, along with the whole contracts / deliverables / payouts stack (invitations, contracts, deliverables, deliverable submissions, payouts + their enums + Razorpay wiring), were **deleted** in the pivot (see `supabase/migrations/0008_drop_delivery_stack.sql`). Do not bring them back without a product decision to re-enter that scope.

### Personas

| Role | What they do | How they reach the app |
|---|---|---|
| **Agency member** | Manages creator roster, builds campaign shortlists, sends packages to brands, chats with brand. | Self-signup with magic-link OTP. Trigger auto-creates `agencies` + `agency_members(role=owner)`. |
| **Brand contact** | Views the frozen package snapshot, approves / rejects / requests revision per creator, messages the agency. | HMAC-signed package link per campaign. No `auth.users` row, no login. A `brands` row is auto-provisioned lazily on first brand action. |

### Money

- All amounts stored as `bigint paise` (1 INR = 100 paise) — avoids float drift.
- Two numbers per shortlist row: `proposed_cost_inr_paise` (what the creator earns, agency-only view) and `brand_price_inr_paise` (what the brand pays). Margin is calculable, not hand-waved.
- No payments flow through the platform in v1.

### Third-party integrations

- **Supabase** — auth + Postgres + RLS. Two stacks (local CLI, hosted). See `memory/local-supabase-dev-setup.md` for keys, seeds, and the cookie-session mint trick.
- **Resend** — transactional email for brand-action notifications to the agency (`src/lib/email/agencyNotify.ts`). No influencer or brand emails go out from the app.

There is no Razorpay, no Aadhaar / Leegality / Digio, no SMS provider. Do not add them without a scope change.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Fork with breaking changes — read `node_modules/next/dist/docs/`. |
| Runtime | React 19 | Server Components + Server Actions everywhere. |
| Language | TypeScript | Strict. |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | Utility-first, no CSS modules. |
| Auth + DB | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | ES256 JWT — `getClaims()` verifies locally. |
| Forms | react-hook-form + Zod | Client validation; server actions re-parse. |
| Email | Resend | Agency-notify only. |
| Deploy | Vercel (Fluid Compute) | Functions pinned to `icn1` (Seoul) to co-locate with Supabase. |

### Key architectural choices

- **App Router** with one route group: `(auth)` (login / signup / check-email — no persona shell).
- **Server Actions** for all mutations. Agency-side actions in `src/app/(auth)/actions.ts`. Brand-side actions in `src/app/p/package/[token]/actions.ts`.
- **Three Supabase clients**:
  - `browser` (anon key, cookie session) — `src/lib/supabase/client.ts`
  - `server` (anon key + cookie sync, RLS enforced) — `src/lib/supabase/server.ts`
  - `admin` (service-role, RLS bypassed — brand token-gated writes and server-only reads) — `src/lib/supabase/admin.ts`
- **RLS-first**: every agency table has policies. Two `SECURITY DEFINER` helpers survive: `is_agency_member(uuid)` and `is_brand_member(uuid)`. `is_influencer()` and `is_invited_influencer()` were dropped in migration `0009`.
- **Magic-link OTP** only — no passwords. Role + agency name passed via `raw_user_meta_data` and consumed by the `handle_new_user` trigger.
- **HMAC-signed tokens** for the brand package portal only — one kind: `package` (see `src/lib/tokens/index.ts`). 30-day TTL.
- **Perf**: `getCurrentUser()` wrapped in React `cache()` + uses `getClaims()` (no round-trip). Middleware uses `getClaims()`. Single joined query for profile + agency membership. Vercel region pinned to Seoul. See memory `local-supabase-dev-setup.md` for the diagnosis.

---

## 3. Repo layout

```
src/
├── app/
│   ├── (auth)/                        # route group, no persona shell
│   │   ├── login/  signup/  check-email/
│   │   └── actions.ts                 # ALL agency-side server actions live here
│   ├── (legal)/                       # marketing / legal pages
│   ├── auth/callback/route.ts         # OTP exchange → /agency
│   ├── agency/                        # persona-bound UI (agency-only)
│   │   ├── layout.tsx                 # PersonaShell + inbox badge
│   │   ├── page.tsx                   # dashboard
│   │   ├── inbox/page.tsx             # unread brand actions + messages
│   │   ├── campaigns/{list, new, [campaignId]{page, edit}}
│   │   ├── brands/                    # brand roster
│   │   ├── influencers/               # creator roster + rate cards
│   │   └── settings/
│   ├── p/package/[token]/             # public brand package portal
│   │   ├── page.tsx                   # snapshot view + per-item decisions + chat
│   │   └── actions.ts                 # brand-side server actions (token-gated)
│   └── api/campaigns/[campaignId]/messages/route.ts   # SSE for message thread
├── components/
│   ├── PersonaShell.tsx               # sidebar + user menu + nav badges
│   ├── MessageThread.tsx              # shared agency + brand chat widget
│   ├── ImportInfluencersWizard.tsx    # CSV / paste roster import
│   └── SubmitButton.tsx
├── lib/
│   ├── auth/getCurrentUser.ts         # getCurrentUser, requireUser, requireAgencyMember (cache()-wrapped)
│   ├── supabase/{client,server,admin,middleware}.ts
│   ├── brand/ensureBrandProfile.ts    # auto-provision brands row on first brand action
│   ├── email/{resend, agencyNotify}.ts # brand-action → agency inbox email
│   ├── tokens/index.ts                # HMAC sign / verify for package links
│   ├── inbox.ts                       # unread count + markSeen (Sprint 5)
│   ├── log.ts                         # structured JSON logging
│   └── money.ts                       # paise ↔ INR
└── proxy.ts                            # Next.js middleware → updateSession on every req

supabase/migrations/
├── 0001_initial_schema.sql
├── 0002_auth_trigger.sql
├── 0003_contract_digio_fields.sql     # columns exist but the tables were dropped in 0008
├── 0004_fix_campaign_policy_recursion.sql
├── 0005_grants.sql                    # API-role table grants (needed for local stack)
├── 0006_sprint1_roster.sql            # rate card + agency-owned influencer records
├── 0007_sprint2_shortlist.sql         # campaign_shortlist_items + package_versions
├── 0008_drop_delivery_stack.sql       # ★ PIVOT: dropped invitations/contracts/deliverables/payouts
├── 0009_drop_influencer_policies.sql  # dropped is_influencer / is_invited_influencer helpers
├── 0010_package_events.sql            # package_events (brand action audit)
├── 0011_campaign_messages.sql         # per-campaign message thread
└── 0012_inbox_seen.sql                # agency_members.last_inbox_seen_at
```

---

## 4. Data model

### Live enums

`user_role` · `agency_member_role` · `campaign_status` (draft, pitching, brand_approved, …) · `brand_decision` (pending, approved, rejected) · `deliverable_type` · `package_actor_kind` (agency, brand) · `package_event_type` · `message_sender_kind` (agency, brand)

Dropped in `0008`: `invitation_status`, `contract_status`, `deliverable_status`, `payout_status`, `payment_terms`.

### Live tables

| Table | Purpose | Key fields |
|---|---|---|
| `profiles` | 1:1 with `auth.users` | `id`, `email`, `full_name`, `primary_role` |
| `agencies` | Top-level tenant | `name`, `slug` (unique), `gstin`, `pan` |
| `agency_members` | Agency ↔ profile join | `(agency_id, profile_id)`, `role`, `last_inbox_seen_at` |
| `brands` | Per-agency brand roster | `agency_id`, `name`, `contact_email`, `gstin` |
| `brand_members` | Brand ↔ profile join (unused in v1) | Kept for future; not written by any flow. |
| `influencers` | Creator profile (agency-managed) | `profile_id` (nullable), handles, `follower_count_total`, `engagement_rate`, `contact_email`, `notes`. No bank fields (dropped in 0008). |
| `agency_influencer_roster` | Agency's private roster | `(agency_id, influencer_id)`, `added_by`, `notes` |
| `influencer_rate_card` | Per-influencer per-deliverable base price | `(influencer_id, deliverable_type)`, `cost_inr_paise` |
| `campaigns` | Campaign container | `agency_id`, `brand_id`, `total_budget_inr_paise`, `status`, `start_date`, `end_date`, `brief` |
| `campaign_shortlist_items` | Agency pitch row | `(campaign_id, influencer_id)`, `proposed_cost_inr_paise`, `brand_price_inr_paise`, `deliverables jsonb`, `sample_urls[]`, `rationale`, `brand_decision`, `brand_comment`, `decided_at` |
| `package_versions` | Frozen snapshot per send | `(campaign_id, version_number)`, `snapshot jsonb`, `sent_at`, `sent_to_email` |
| `package_events` | Brand-action audit trail | `campaign_id`, `package_version_id?`, `shortlist_item_id?`, `actor_kind`, `event_type`, `metadata`, `occurred_at` |
| `campaign_messages` | Agency ↔ brand thread | `campaign_id`, `shortlist_item_id?` (null = campaign-level), `sender_kind`, `body`, `created_at` |
| `audit_log` | Legacy state-change log | Still written by some agency actions. |

### RLS in one sentence

Agency members see everything inside their agency; brand writes come through the admin client, gated by an HMAC package token. There is no influencer-facing RLS surface any more.

### Auth bootstrap trigger

`handle_new_user()` (in `0002_auth_trigger.sql`) fires on `auth.users` insert:

1. Reads `raw_user_meta_data` set by `signInWithOtp({ data: { full_name, role, agency_name? } })`.
2. Always creates a `profiles` row.
3. Role is hard-locked to `agency_member` at the UI — the trigger creates `agencies` + `agency_members(role='owner')`.

---

## 5. Auth flow

```
signup form                                  callback                    destination
─────────────                                ────────                    ───────────
signInWithOtp({                              exchangeCodeForSession      /agency
  email,                                     ↓
  data: { full_name,           email link →  read profile + agency_members
          role: agency_member,               ↓
          agency_name }                      agency_member?
})                                            ├── yes → /agency
   ↓                                          └── no  → sign out, redirect
DB trigger handle_new_user                                /login?error=agency_only
   creates profile + agency_members          cookies set via @supabase/ssr
                                             middleware refreshes on every request
```

`signUpAction` hard-locks `role` to `agency_member` and requires `agency_name`. The UI offers no other role.

Helpers (`src/lib/auth/getCurrentUser.ts`, all wrapped in React `cache()`):
- `getCurrentUser()` — one joined query (`profiles` embed `agency_members`). Returns `agencyId`.
- `requireUser()` — redirects to `/login` if no session.
- `requireAgencyMember()` — narrows return type to `{ agencyId: string, id: string, fullName: string, email: string }`. Used by every `/agency/*` page.

The brand package portal (`/p/package/[token]`) does not touch this helper — it verifies the HMAC token directly and uses the admin client.

---

## 6. The pitch loop (product surface)

```
1. Setup       Agency creates the brand + campaign. Sets budget + brief.
               ↓
2. Shortlist   Agency picks creators from its roster (multi-select).
               Sets proposed cost + brand price + deliverables mix per row.
               ↓
3. Package     Agency clicks Send to brand. A numbered snapshot is written
               to package_versions.snapshot (brief + shortlist frozen), a
               package_events row logs `package_sent`, and a signed link
               (kind=package, versionId, campaignId) is generated.
               ↓
4. Brand view  Brand opens /p/package/[token]. HMAC verified; snapshot
               loaded (frozen). Live decisions loaded from shortlist rows
               (so brand always sees their own latest state). package_events
               logs `package_viewed` (throttled 15 min per version).
               ↓
5. Decisions   Brand approves / rejects / requests revision per creator
               with an optional comment. Each writes:
                 - campaign_shortlist_items.brand_decision + brand_comment
                 - package_events row (item_approved / item_rejected /
                   revision_requested)
                 - agencyNotify email (Resend) to campaign owner
               ↓
6. Chat        Brand and agency exchange messages on the same page. Writes
               land in campaign_messages (shortlist_item_id nullable, so
               per-item threads are a future extension without a migration).
               ↓
7. Inbox       Agency's /agency/inbox merges package_events + campaign_messages
               (brand-authored) newer than agency_members.last_inbox_seen_at.
               PersonaShell nav shows the unread count as a badge. Visiting
               /agency/inbox calls markInboxSeen → badge clears.
```

Every meaningful brand action shows up in the agency inbox within one request. Nothing runs on a schedule.

---

## 7. Status — what's live

Sprint 1–5 shipped and are deployed to prod (`https://influencer-management-app-five.vercel.app`).

- **Sprint 1** — agency-owned creator roster + rate cards + CSV import.
- **Sprint 2** — campaign shortlist + multi-select roster picker + package send + brand portal (approve/reject/comment per creator) + `package_versions` snapshot.
- **Sprint 3a** — `package_events` for every meaningful brand action; agency dashboard activity feed reads from it.
- **Sprint 3b** — auto-provision `brands` row on first brand action; email agency on brand decisions (Resend).
- **Sprint 4** — per-campaign message thread on the package link + agency campaign detail.
- **Sprint 5** — agency inbox at `/agency/inbox` with per-member unread state (`agency_members.last_inbox_seen_at`) and a nav badge.

### Routes at a glance

| Route | State |
|---|---|
| `/`, `/signup`, `/login`, `/check-email`, `/auth/callback` | Built |
| `/agency` | Built (dashboard) |
| `/agency/inbox` | Built (unread state) |
| `/agency/campaigns`, `/agency/campaigns/new`, `/agency/campaigns/[id]`, `/agency/campaigns/[id]/edit` | Built |
| `/agency/brands` | Built |
| `/agency/influencers` (list + detail + rate card + import) | Built |
| `/agency/settings` | Built (owner-only edit) |
| `/p/package/[token]` | Built (brand package portal) |
| `POST /api/campaigns/[id]/messages` | Built (SSE for live chat) |

### Sprint 6 candidates (not started)

- **Post-live reporting** — capture final content URLs + reach so a campaign has a close-out row, not just an open-ended approval.
- **Brand lock-in on approval** — once a shortlist has any `approved` row, freeze price fields on that row.
- **Multi-user agency invites** — right now the founding member is the sole account.

---

## 8. Environment

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # sb_publishable_... (new-style keys, 2026-07-10 rotation)
SUPABASE_SERVICE_ROLE_KEY       # sb_secret_...
NEXT_PUBLIC_APP_URL             # base URL used to build package links

RESEND_API_KEY                  # brand-action → agency inbox notification
EMAIL_FROM                      # e.g. "PR Platform <noreply@yourdomain.in>"

TOKEN_SIGNING_SECRET            # HMAC secret for /p/package/* tokens
                                # generate: openssl rand -hex 32
```

No Razorpay, no SMS provider, no e-sign vendor.

---

## 9. Testing the flow end-to-end

The full pitch loop is testable in the UI: agency app + the public `/p/package/[token]` page.

### 9.1 Setup

Two Supabase stacks are supported. See `memory/local-supabase-dev-setup.md` for the switching trick.

```bash
npm install
supabase start   # local stack (Docker); applies supabase/migrations/
npm run dev      # http://localhost:3000
```

Point `.env.local` at the local stack (`NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` + the anon/service keys `supabase start` prints). Local auth emails land in Mailpit at http://127.0.0.1:54324.

### 9.2 Create the agency account

Sign up at `/signup` with your name, work email, and agency name. The app hard-locks the role to `agency_member`. Click the magic link.

For QA against the local stack there's `qa-agency@example.com` — mint a browser session without hitting the inbox using `scripts/qa-mint-session.mjs`.

### 9.3 End-to-end happy path

| # | Action | Expected |
|---|---|---|
| 1 | Agency: `/agency/brands` → add TestBrand (name + contact_email) | Brand row appears |
| 2 | Agency: `/agency/influencers` → add creator (or import CSV) + set rate card | Roster row + rate card visible |
| 3 | Agency: `/agency/campaigns/new` → pick TestBrand, set budget + brief | Redirect to campaign detail |
| 4 | Agency: campaign detail → multi-select shortlist picker → add creators | Shortlist rows with pending brand_decision |
| 5 | Agency: set proposed cost + brand price + deliverables per row | Row updates; margin visible on hover |
| 6 | Agency: click **Send to brand** | `package_versions` row (version_number bumped), `package_events.package_sent`, signed URL returned in banner |
| 7 | Brand: open `/p/package/[token]` in another browser | Snapshot renders; `package_events.package_viewed` logged (throttled 15 min) |
| 8 | Brand: **Approve** on one creator, **Reject** on another, **Request revision** on a third with a comment | Shortlist rows update, three `package_events` rows written, three `agencyNotify` emails fire (visible in Resend dashboard or Mailpit for local Resend stub) |
| 9 | Brand: send a message in the chat | `campaign_messages` row (sender_kind=brand) |
| 10 | Agency: reload `/agency` | Nav badge shows unread=4 |
| 11 | Agency: click **Inbox** | 4 items highlighted; on load `last_inbox_seen_at` bumps; badge clears |
| 12 | Agency: open campaign detail | Per-item decisions visible; chat thread live |

### 9.4 Verify in SQL

```sql
select id, version_number, sent_at from package_versions order by sent_at desc;
select actor_kind, event_type, occurred_at from package_events order by occurred_at desc limit 20;
select sender_kind, body, created_at from campaign_messages order by created_at desc limit 20;
```

### 9.5 Smoke scripts

- `scripts/qa-e2e.mjs` — full pitch loop against local DB (service-role).
- `scripts/qa-sprint2.mjs` — shortlist + package send.
- `scripts/qa-sprint5.mjs` — inbox unread accounting.
- `scripts/qa-cross-tenant.mjs` — RLS leak check.
- `scripts/qa-rls-probe.mjs` — per-table policy sanity.
- `scripts/qa-mint-session.mjs` — mint a browser session cookie jar for the QA agency without an email inbox.

### 9.6 Common gotchas

- **OTP doesn't arrive** — check spam or use Supabase Auth → Users → "Generate magic link" as a fallback. Local: check Mailpit at http://127.0.0.1:54324.
- **Login bounces to `/login?error=agency_only`** — by design. Only `agency_member` accounts can use the app.
- **Package link says "Server misconfiguration"** — `TOKEN_SIGNING_SECRET` is not set. Generate with `openssl rand -hex 32` and add to `.env.local`.
- **Package link says "This link has expired"** — token TTL is 30 days. Re-send from the campaign detail page to issue a fresh version + link.
- **`agencyNotify` email doesn't send** — `RESEND_API_KEY` / `EMAIL_FROM` unset, or the recipient domain isn't verified in Resend. The action does not fail if email fails; log shows `agency_notify_email_failed`.

---

## 10. Where to start contributing

v1 is **agency app + brand package portal**. The `/brand/*` and `/influencer/*` route trees are gone; the invitations / contracts / deliverables / payouts stack is gone. Do not re-introduce any of them without an explicit product decision to re-enter that scope.

Immediate priorities:

1. **Sprint 6** — pick from the candidates in §7.
2. **Docs / marketing polish** — landing page (`(legal)` group) still references the old scope in places.
3. **Multi-user agency support** — invite/accept flow, so a second team member can join an existing agency.
