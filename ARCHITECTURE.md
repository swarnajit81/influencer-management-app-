# Architecture

Onboarding doc for developers. Covers business model, system design, tech stack, status, and how to test end-to-end.

> **Heads-up for AI agents / new devs:** This project uses **Next.js 16** with the App Router. APIs and conventions differ from older Next.js versions. When in doubt, read the relevant guide in `node_modules/next/dist/docs/` before writing code.

---

## 1. Business model

PR agencies in India currently run influencer campaigns over Instagram DMs and Gmail. There is no system of record for briefs, contracts, deliverables, or payouts. This app replaces that workflow.

### Scope decision: agency-first

**v1 ships one app: the agency app.** Brands and influencers are touchpoints, not users — they interact via tokenised magic-link pages emailed to them per campaign / invitation. No signup, no login, no separate dashboard.

The earlier `/influencer/*` and `/brand/*` route trees were **deleted** in the scope cut. Their replacement is the public `/p/*` magic-link surface (not yet built).

### Personas

| Role | What they do | How they reach the app (v1) |
|---|---|---|
| **Agency member** | Creates campaigns, invites influencers, approves deliverables, triggers payouts. Pays the platform. | Self-signup with magic-link OTP. Trigger auto-creates `agencies` + `agency_members(role=owner)`. |
| **Brand contact** | Approves briefs and content submissions. Sees campaign status and spend. | Tokenised magic-link emailed per campaign. No `auth.users` row, no `brand_members` row required in v1. Token resolves to a `brands` row scoped to the campaign. |
| **Influencer** | Accepts/declines invitation. Signs contract. Submits deliverables. Receives payout. | Tokenised magic-link emailed per invitation. `influencers` row created on token first-use (no full auth signup needed). |

### Money flow

- All amounts stored as `bigint paise` (1 INR = 100 paise) — avoids float drift.
- Agency funds Razorpay virtual account → Razorpay Route payout to influencer's verified fund account.
- Razorpay handles GST/TDS natively for Indian payouts.

### Why the integrations exist

- **Razorpay Route** — marketplace payouts in INR. Per-influencer Razorpay Contact + Fund Account created at onboarding.
- **Leegality** (formerly Digio) — Aadhaar e-sign for contracts. Legally enforceable in India (stronger than DocuSign here).
- **Resend** — transactional email (invitations, signing reminders, payout confirmations).

---

## 2. Tech stack

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.4 |
| Runtime | React / React DOM | 19.2.4 |
| Language | TypeScript | ^5 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | ^4 |
| Auth + DB | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | 2.103.3 / 0.10.2 |
| Forms | react-hook-form + Zod | 7.72.1 / 4.3.6 |
| Payments | Razorpay SDK | 2.9.6 |
| Email | Resend (installed, not wired) | 6.12.0 |
| E-sign | Leegality (custom HTTP client) | — |
| Lint | ESLint + eslint-config-next | 9 / 16.2.4 |

### Key architectural choices

- **App Router** with route groups: `(auth)`, `agency/`, `brand/`, `influencer/`, `api/`.
- **Server Actions** for all mutations (in `src/app/(auth)/actions.ts`).
- **Three Supabase clients**:
  - `browser` (anon key, cookie session) — `src/lib/supabase/client.ts`
  - `server` (anon key + cookie sync, RLS enforced) — `src/lib/supabase/server.ts`
  - `admin` (service-role, RLS bypassed — webhooks + trusted server flows only) — `src/lib/supabase/admin.ts`
- **RLS-first**: every table has policies. Helper SQL functions `is_agency_member()`, `is_brand_member()`, `is_influencer()` keep policies readable.
- **Magic-link OTP** only — no passwords. Role + agency name passed via `raw_user_meta_data` and consumed by the `handle_new_user` trigger.

---

## 3. Repo layout

```
src/
├── app/
│   ├── (auth)/                       # route group, no shell
│   │   ├── login/  signup/  check-email/
│   │   └── actions.ts                # ALL server actions live here
│   ├── auth/callback/route.ts        # OTP exchange → /agency (non-agency
│   │                                 #   accounts get signed out + bounced)
│   ├── agency/                       # ONLY persona-bound UI in v1
│   │   ├── campaigns/{list, new, [campaignId]}
│   │   ├── contracts/[contractId]
│   │   ├── brands/  influencers/  payouts/
│   ├── p/                            # public magic-link surface (planned —
│   │                                 #   /p/invitation/[token], /p/campaign/[token])
│   └── api/webhooks/
│       ├── razorpay/route.ts         # signature verified, parse TODO
│       └── leegality/route.ts        # full implementation
├── components/PersonaShell.tsx       # sidebar + user menu (agency-only in v1)
├── lib/
│   ├── auth/getCurrentUser.ts        # getCurrentUser, requireUser, requireAgencyMember
│   ├── supabase/{client,server,admin,middleware}.ts
│   ├── razorpay/client.ts            # SDK singleton
│   ├── leegality/client.ts           # createInvitation, fetchSignedPdfUrl
│   ├── contracts/generate.ts         # HTML + plain text + PDF base64
│   ├── email/{resend, templates/invitation}.ts  # transactional email
│   └── money.ts                      # paise ↔ INR
└── proxy.ts                          # Next.js middleware → updateSession on every req

supabase/migrations/
├── 0001_initial_schema.sql           # tables, enums, RLS policies
├── 0002_auth_trigger.sql             # handle_new_user trigger
└── 0003_contract_digio_fields.sql    # Leegality signing URLs + expiry
```

`/brand/*` and `/influencer/*` route trees were removed during the v1 scope cut. Their replacement is the magic-link surface under `/p/*` — not yet built.

---

## 4. Data model

### Enums

`user_role` · `agency_member_role` · `campaign_status` · `invitation_status` · `contract_status` · `deliverable_type` · `deliverable_status` · `payout_status` — see `0001_initial_schema.sql` for values.

### Tables

| Table | Purpose | Key fields |
|---|---|---|
| `profiles` | 1:1 with `auth.users` | `id`, `email`, `full_name`, `primary_role` |
| `agencies` | Top-level tenant | `name`, `slug` (unique), `gstin`, `pan` |
| `agency_members` | Agency ↔ profile join | `(agency_id, profile_id)`, `role` |
| `brands` | Per-agency brand | `agency_id`, `name`, `contact_email`, `gstin` |
| `brand_members` | Brand ↔ profile join | `(brand_id, profile_id)`, `is_owner` |
| `influencers` | Creator profile | `profile_id` (unique), handles, `follower_count_total`, bank fields, `razorpay_contact_id`, `razorpay_fund_account_id` |
| `agency_influencer_roster` | Agency's private roster | `(agency_id, influencer_id)`, `added_by`, `notes` |
| `campaigns` | Campaign container | `agency_id`, `brand_id`, `total_budget_inr_paise`, `status` |
| `campaign_invitations` | Agency → influencer offer | `offer_amount_inr_paise`, `status`, `expires_at` |
| `contracts` | Created when invitation accepted | `invitation_id` (unique), `total_amount_inr_paise`, `status`, `influencer_signing_url`, `brand_signing_url`, `signed_pdf_url`, `digio_document_id` |
| `deliverables` | What the influencer must produce | `contract_id`, `type`, `due_date`, `amount_inr_paise`, `status` |
| `deliverable_submissions` | Submission + review record | `content_url`, `caption`, `reviewer_feedback`, `reviewed_by` |
| `payouts` | Razorpay-backed payment | `razorpay_payout_id`, `razorpay_transfer_id`, `status` |
| `audit_log` | All state changes | `actor_profile_id`, `entity_type`, `entity_id`, `action`, `metadata` (jsonb) |

### RLS in one sentence

Agency members see everything inside their agency; brand members see the campaigns/contracts attached to their brand; influencers see only their own rows. All policies route through three `SECURITY DEFINER` helper functions.

### Auth bootstrap trigger

`handle_new_user()` (in `0002_auth_trigger.sql`) fires on `auth.users` insert:

1. Reads `raw_user_meta_data` set by `signInWithOtp({ data: { full_name, role, agency_name? } })`.
2. Always creates a `profiles` row.
3. If role is `agency_member`: creates `agencies` + `agency_members(role='owner')`.
4. If role is `influencer`: creates `influencers`.
5. `brand_member` rows are NOT auto-created — those come from invitations.

---

## 5. Auth flow

```
signup form                                callback                   destination
─────────────                              ────────                   ───────────
signInWithOtp({                            exchangeCodeForSession    /agency
  email,                                   ↓
  data: { full_name,         email link →  read profile.primary_role
          role: agency_member,             ↓
          agency_name }                    agency_member?
})                                          ├── yes → /agency
   ↓                                        └── no  → sign out, redirect
DB trigger handle_new_user                              /login?error=agency_only
   creates profile + agency_members        cookies set via @supabase/ssr
                                           middleware refreshes on every request
```

`signUpAction` hard-locks `role` to `agency_member` and requires `agency_name`. The UI offers no other role.

Helpers (`src/lib/auth/getCurrentUser.ts`):
- `getCurrentUser()` — joins `profiles` with `agency_members`. Returns `agencyId`.
- `requireUser()` — redirects to `/login` if no session.
- `requireAgencyMember()` — narrows return type to `{ agencyId: string }`. Used by every `/agency/*` page.

Brand and influencer touchpoints in v1 will not go through this auth flow at all — they hit the public `/p/*` magic-link routes with tokens (planned).

---

## 6. Status — what's done / what's left

### Done

- Auth: agency-only signup, magic-link login, callback (non-agency accounts are signed out + bounced), logout.
- Agency: campaigns list, create campaign, campaign detail with invite-influencer form.
- Agency: influencer roster — add by email.
- Agency: contract detail — add deliverable, review submission (approve / request changes / mark live).
- Invitation email via Resend (sent from `inviteInfluencerAction`, audit-logged on success and failure).
- HMAC-signed magic-link tokens (`src/lib/tokens/`) with 30-day TTL. Token kinds: `invitation`, `contract`.
- Public invitation page `/p/invitation/[token]` — view offer, accept (auto-creates contract, click-to-sign), or decline. No login required.
- Public contract page `/p/contract/[token]` — view contract terms + deliverable list, submit / resubmit each deliverable. Issued at accept-time and threaded into the accept confirmation screen.
- Audit log writes on every state-changing action.
- Leegality webhook: HMAC verified, parses all signed_status events, updates contract status, fetches signed PDF URL.
- Razorpay webhook endpoint exists with signature verification.

### Partially done

- **Razorpay webhook** (`src/app/api/webhooks/razorpay/route.ts`) — signature verified, **event parsing + payout status update TODO**.
- **Agency / brands page** — read-only list. "New brand" button disabled. Brand creation must be done via SQL.
- **Contract-link email follow-up** — after accept, the contract link only appears on the in-browser confirmation screen. No email is sent yet, so influencers who close the tab need to ask the agency for a new link. Resend wiring on accept is the next small follow-up.

### Not started (v1)

- Agency dashboard (`/agency`) — stub.
- Agency payouts queue (`/agency/payouts`).
- Public **brand campaign page** (`/p/campaign/[token]`) — brand-side approvals + spend view.
- Leegality e-sign integration inside the accept flow (currently click-to-sign with `esign_skipped: true` audit metadata).
- Razorpay Contact + Fund Account creation on influencer onboarding.

### Deferred to v2 (out of v1 scope)

- Standalone brand portal app — `/brand/*` route tree was removed in the scope cut.
- Standalone influencer portal app — `/influencer/*` route tree was removed in the scope cut.
- `brand_members` invitation flow — v1 uses per-campaign magic links instead, no `brand_members` row needed.
- Multi-user brand teams.

### Routes at a glance

| Route | State |
|---|---|
| `/`, `/signup`, `/login`, `/check-email`, `/auth/callback` | Built (agency-only) |
| `/agency` | Stub |
| `/agency/campaigns`, `/agency/campaigns/new`, `/agency/campaigns/[id]` | Built |
| `/agency/contracts/[id]` | Built |
| `/agency/influencers` | Built |
| `/agency/brands` | Read-only stub |
| `/agency/payouts` | Stub |
| `/p/invitation/[token]` | Built (accept/decline) |
| `/p/contract/[token]` | Built (deliverable submit / resubmit) |
| `/p/campaign/[token]` | Missing (v1 next) |
| `POST /api/webhooks/razorpay` | Partial (signature only) |
| `POST /api/webhooks/leegality` | Built |

---

## 7. Environment

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL          # used for OTP redirect

RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET

LEEGALITY_API_KEY
LEEGALITY_BASE_URL           # optional; defaults to preprod
LEEGALITY_WEBHOOK_SECRET

RESEND_API_KEY               # used by invitation email
EMAIL_FROM                   # e.g. "PR Platform <noreply@yourdomain.in>"

TOKEN_SIGNING_SECRET         # HMAC secret for /p/* magic-link tokens
                             # generate: openssl rand -hex 32
```

---

## 8. Testing the flow end-to-end

v1 covers only the agency-side flow. Influencer and brand interactions land via Resend email + the magic-link surface — and that surface isn't built yet, so the influencer half of the loop is **not testable through the UI right now**. Verify it via the audit log and database state.

### 8.1 Setup

```bash
npm install
npm run dev   # http://localhost:3000
```

Apply migrations to your Supabase project (SQL editor, in order):

```
supabase/migrations/0001_initial_schema.sql
supabase/migrations/0002_auth_trigger.sql
supabase/migrations/0003_contract_digio_fields.sql
```

### 8.2 Create the agency account

Sign up at `/signup` with your name, work email, and agency name. The app hard-locks the role to `agency_member`. Click the magic link in your inbox.

You also need an `influencers` row to invite — either sign up a second account with `role=influencer` via direct `signInWithOtp` from a script, or insert one manually in the SQL editor (then attach a `profiles` row). The signup UI no longer offers an influencer option.

### 8.3 Seed a brand (UI not built yet — run in Supabase SQL editor)

```sql
with a as (
  select am.agency_id
  from agency_members am
  join profiles p on p.id = am.profile_id
  where p.email = 'you+agency@gmail.com'
  limit 1
)
insert into brands (agency_id, name, slug, contact_email)
select a.agency_id,
       'TestBrand',
       'testbrand-' || substr(gen_random_uuid()::text, 1, 6),
       'you+brand@gmail.com'
from a
returning id;
```

### 8.4 End-to-end happy path

| # | Action | Expected |
|---|---|---|
| 1 | Agency: `/agency/influencers` → add influencer by email | Roster row appears |
| 2 | Agency: `/agency/campaigns/new` → pick TestBrand, set budget | Redirect to campaign detail |
| 3 | Agency: campaign detail → invite influencer (offer + message) | Pending invitation row; Resend email fires |
| 4 | Influencer inbox | Email arrives; "Review invitation" link contains a signed token |
| 5 | Click link | `/p/invitation/[token]` renders the offer with Accept and Decline buttons |
| 6 | Click **Accept &amp; sign** | Page shows "You accepted the invitation" plus a "Continue → review & submit deliverables" button. Contract row created with `status=signed_by_influencer`. Audit row `invitation_accepted_click_to_sign_via_token` |
| 7 | Agency: refresh `/agency/contracts/[id]` → add deliverable | Deliverable status `pending` |
| 8 | Influencer: click **Continue → review & submit deliverables** | `/p/contract/[token]` renders with the deliverable card and a submit form |
| 9 | Submit content URL + caption | Banner "Submission received". Deliverable flips to `submitted`. `deliverable_submissions` row inserted. Audit row `submitted_via_token` |
| 10 | Agency: refresh contract page → **Request changes** + feedback | Deliverable flips to `changes_requested` |
| 11 | Influencer: refresh contract page → form re-appears with **Resubmit** | New `deliverable_submissions` row, status back to `submitted` |
| 12 | Agency: **Approve** → **Mark live** | Deliverable status reaches `live` |

### 8.5 Verify in Supabase SQL editor

```sql
select id, type, status, due_date, amount_inr_paise
from deliverables order by created_at desc;

select action, entity_type, metadata, created_at
from audit_log order by created_at desc limit 20;
```

### 8.6 Webhook smoke test (optional)

Leegality webhook is the only fully wired one. To exercise it locally:

```bash
ngrok http 3000
# point Leegality preprod webhook to https://<ngrok>/api/webhooks/leegality
# send a test event from the Leegality dashboard
```

Razorpay webhook does signature verification but does not act on events yet.

### 8.7 Common gotchas

- **OTP doesn't arrive** — check spam, or use Supabase Auth → Users → "Generate magic link" as a fallback.
- **Login bounces to `/login?error=agency_only`** — by design. Only `agency_member` accounts can use the app. Other roles are reserved for the magic-link surface.
- **Invitation email doesn't send** — check `RESEND_API_KEY` + `EMAIL_FROM` in `.env.local`. Failures are logged to `audit_log` with `action=invitation_email_failed`.
- **Email link says "Server misconfiguration"** — `TOKEN_SIGNING_SECRET` is not set. Generate with `openssl rand -hex 32` and add to `.env.local`.
- **Email link says "This invitation link has expired"** — token TTL is 30 days. Re-invite from the agency UI to issue a fresh link.

---

## 9. Where to start contributing

v1 is **agency app + magic-link touchpoints for brand and influencer**. The `/brand/*` and `/influencer/*` route trees are gone; do not bring them back.

Smallest useful PRs in rough priority order:

1. Send the **contract link by email** on accept and again on `changes_requested`. Small follow-up — template + Resend call, similar shape to the invitation email.
2. Build the **agency dashboard** at `/agency` — read straight from `campaigns`, `campaign_invitations`, `payouts`.
3. Build the **brand creation** UI for agency members (replace the disabled button on `/agency/brands`).
4. Build the public **brand campaign page** (`/p/campaign/[token]`) — brand-facing read-only view + approve/reject content.
5. Finish the **Razorpay webhook** handler — parse `payout.processed` / `payout.failed`, update `payouts.status`, write to `audit_log`.
6. Wire real **Leegality e-sign** into the accept flow (replace the click-to-sign shortcut).
