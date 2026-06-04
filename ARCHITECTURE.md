# Architecture

Onboarding doc for developers. Covers business model, system design, tech stack, status, and how to test end-to-end.

> **Heads-up for AI agents / new devs:** This project uses **Next.js 16** with the App Router. APIs and conventions differ from older Next.js versions. When in doubt, read the relevant guide in `node_modules/next/dist/docs/` before writing code.

---

## 1. Business model

PR agencies in India currently run influencer campaigns over Instagram DMs and Gmail. There is no system of record for briefs, contracts, deliverables, or payouts. This app replaces that workflow.

### Three personas

| Role | What they do | How they sign up |
|---|---|---|
| **Agency member** | Creates campaigns, invites influencers, approves deliverables, triggers payouts. Pays the platform. | Self-signup. Trigger auto-creates an `agencies` row + `agency_members` row with `role=owner`. |
| **Brand member** | Approves briefs and content submissions. Read-only view of spend and status. | Invitation-only. Created on brand_member invite (UI for this not built yet). |
| **Influencer** | Accepts/declines invitations. Signs contracts via Aadhaar e-sign. Submits deliverables. Receives payouts to verified bank account. | Self-signup. Trigger auto-creates an `influencers` row. |

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
│   ├── auth/callback/route.ts        # OTP code exchange → role-based redirect
│   ├── agency/                       # persona shell
│   │   ├── campaigns/{list, new, [campaignId]}
│   │   ├── contracts/[contractId]
│   │   ├── brands/  influencers/  payouts/
│   ├── brand/                        # persona shell (mostly stubs)
│   ├── influencer/
│   │   ├── invitations/
│   │   ├── contracts/{list, [contractId]}
│   └── api/webhooks/
│       ├── razorpay/route.ts         # signature verified, parse TODO
│       └── leegality/route.ts        # full implementation
├── components/PersonaShell.tsx       # sidebar + user menu
├── lib/
│   ├── auth/getCurrentUser.ts        # requireUser, requireRole, dashboardPathFor
│   ├── supabase/{client,server,admin,middleware}.ts
│   ├── razorpay/client.ts            # SDK singleton
│   ├── leegality/client.ts           # createInvitation, fetchSignedPdfUrl
│   ├── contracts/generate.ts         # HTML + plain text + PDF base64
│   └── money.ts                      # paise ↔ INR
└── proxy.ts                          # Next.js middleware → updateSession on every req

supabase/migrations/
├── 0001_initial_schema.sql           # tables, enums, RLS policies
├── 0002_auth_trigger.sql             # handle_new_user trigger
└── 0003_contract_digio_fields.sql    # Leegality signing URLs + expiry
```

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
signup form                                      callback                   dashboard
─────────────                                    ────────                   ─────────
signInWithOtp({                                  exchangeCodeForSession    /agency
  email,                                         ↓                         /brand
  data: { full_name,           email link →     read profile.primary_role  /influencer
          role,                                  ↓
          agency_name? }                         dashboardPathFor(role)
})
   ↓
DB trigger handle_new_user                       cookies set via @supabase/ssr
   creates profile + role row                    middleware (src/proxy.ts) refreshes
                                                 session on every request
```

Helpers (`src/lib/auth/getCurrentUser.ts`):
- `getCurrentUser()` — joins `profiles` with `agency_members` / `brand_members` / `influencers`. Returns `agencyId`, `brandId`, `influencerId`.
- `requireUser()` — redirects to `/login` if no session.
- `requireRole(role)` — redirects to the correct dashboard on role mismatch.

---

## 6. Status — what's done / what's left

### Done

- Auth: signup, magic-link login, callback, role-based redirect, logout.
- Agency: campaigns list, create campaign, campaign detail with invite-influencer form.
- Agency: influencer roster — add by email.
- Agency: contract detail — add deliverable, review submission (approve / request changes / mark live).
- Influencer: invitations list, accept (creates contract, e-sign skipped for MVP), decline.
- Influencer: contracts list grouped by status.
- Influencer: contract detail — submit / resubmit deliverable.
- Audit log writes on every state-changing action.
- Leegality webhook: HMAC verified, parses all signed_status events, updates contract status, fetches signed PDF URL.
- Razorpay webhook endpoint exists with signature verification.

### Partially done

- **Razorpay webhook** (`src/app/api/webhooks/razorpay/route.ts`) — signature verified, **event parsing + payout status update TODO**.
- **Agency / brands page** — read-only list. "New brand" button disabled. Brand creation must be done via SQL.
- **Leegality e-sign** — client + webhook are built but **not called from the invitation acceptance flow**. Acceptance currently writes `status=signed_by_influencer` directly with `esign_skipped: true` in audit metadata.

### Not started

- All dashboards (`/agency`, `/brand`, `/influencer`) — stub pages with TODO comments.
- Agency payouts queue (`/agency/payouts`).
- Brand portal: `/brand/campaigns/[campaignId]`, `/brand/approvals` (nav links exist, pages missing).
- Influencer payouts history (`/influencer/payouts`).
- Brand member invitation flow (creates `brand_members` row).
- Razorpay Contact + Fund Account creation on influencer onboarding.
- Resend integration — no emails sent anywhere despite the package being installed.

### Routes at a glance

| Route | State |
|---|---|
| `/`, `/signup`, `/login`, `/check-email`, `/auth/callback` | Built |
| `/agency` | Stub |
| `/agency/campaigns`, `/agency/campaigns/new`, `/agency/campaigns/[id]` | Built |
| `/agency/contracts/[id]` | Built |
| `/agency/influencers` | Built |
| `/agency/brands` | Read-only stub |
| `/agency/payouts` | Stub |
| `/brand`, `/brand/campaigns/[id]`, `/brand/approvals` | Stub / missing |
| `/influencer` | Stub |
| `/influencer/invitations` | Built |
| `/influencer/contracts`, `/influencer/contracts/[id]` | Built |
| `/influencer/payouts` | Missing |
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

RESEND_API_KEY               # not yet consumed
```

---

## 8. Testing the flow end-to-end

You need **three sessions** (three browsers or three Chrome profiles) — one per role. Use Gmail aliases (`you+agency@gmail.com`, `you+inf@gmail.com`, `you+brand@gmail.com`) so all OTPs land in one inbox.

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

### 8.2 Create the three accounts

| Browser | Signup form |
|---|---|
| A — agency | `role=agency_member`, `agency_name=AcmeAgency` |
| B — influencer | `role=influencer` |
| C — brand member | `role=brand_member` (profile is created but no `brand_members` row — see next step) |

Click the magic link in each Gmail message.

### 8.3 Seed a brand (UI not built yet — run in Supabase SQL editor)

```sql
-- create brand owned by the agency
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

-- attach the brand_member to the brand
with bid as (select id from brands where name = 'TestBrand' limit 1),
     pid as (select id from profiles where email = 'you+brand@gmail.com')
insert into brand_members (brand_id, profile_id, is_owner)
select bid.id, pid.id, true from bid, pid;
```

### 8.4 Happy path

| # | Browser | Action | Expected |
|---|---|---|---|
| 1 | A | `/agency/influencers` → add influencer by email | Roster row appears |
| 2 | A | `/agency/campaigns/new` → pick TestBrand, set budget | Redirect to campaign detail |
| 3 | A | Campaign detail → invite influencer (offer + message) | Pending invitation row |
| 4 | B | `/influencer/invitations` → Accept | Redirects with `?contract=<id>`. Contract status = `signed_by_influencer`, `influencer_signed_at` set |
| 5 | A | `/agency/contracts/<id>` → add deliverable (type, due, amount) | Deliverable status `pending` |
| 6 | B | `/influencer/contracts/<id>` → submit (URL + caption) | Status → `submitted` |
| 7 | A | Refresh contract → **Request changes** + feedback | Status → `changes_requested` |
| 8 | B | Refresh → **Resubmit** with new URL | Status → `submitted` |
| 9 | A | Refresh → **Approve** | Status → `approved`, "Mark live" appears |
| 10 | A | **Mark live** | Status → `live` |

### 8.5 Decline path

Repeat the invite with a second influencer (add to roster first). Click **Decline** in browser B. The invitation moves to `declined`, no contract is created.

### 8.6 Verify in Supabase SQL editor

```sql
select id, status, influencer_signed_at, brand_signed_at
from contracts order by created_at desc limit 5;

select id, type, status, due_date, amount_inr_paise
from deliverables order by created_at desc;

select action, entity_type, metadata, created_at
from audit_log order by created_at desc limit 20;
```

### 8.7 Webhook smoke test (optional)

Leegality webhook is the only fully wired one. To exercise it locally:

```bash
# expose dev server
ngrok http 3000
# point Leegality preprod webhook to https://<ngrok>/api/webhooks/leegality
# send a test event from the Leegality dashboard
```

Razorpay webhook does signature verification but does not act on events yet.

### 8.8 Common gotchas

- **OTP doesn't arrive** — check spam, or use Supabase Auth → Users → "Generate magic link" as a fallback.
- **Agency can't see a contract** — RLS working as designed; check the contract's campaign is owned by that agency.
- **"invalid_status" submitting** — deliverable already in review or approved.
- **Brand portal looks empty** — expected. `/brand/*` is mostly stubs.

---

## 9. Where to start contributing

Smallest useful PRs in rough priority order:

1. Wire **Resend** into `inviteInfluencerAction` so influencers get an email when invited.
2. Build the **brand creation** UI for agency members (replace the disabled button on `/agency/brands`).
3. Finish the **Razorpay webhook** handler — parse `payout.processed` / `payout.failed`, update `payouts.status`, write to `audit_log`.
4. Build the **agency dashboard** at `/agency` — read straight from `campaigns`, `campaign_invitations`, `payouts`.
5. Replace MVP "click-to-sign" with the real **Leegality flow** inside `acceptInvitationAction` — `createInvitation` + persist signing URLs.
