# PR Platform

A workspace for Indian PR agencies to run influencer-brand campaigns end-to-end:
**briefs → contracts → deliverables → payouts** — all in INR, all in one place.

Built to replace the current Instagram-DM + Gmail workflow that leaves brands and
influencers without visibility into campaign status, contract state, or when
they'll get paid.

---

## Personas

| Persona        | Pays?  | Primary jobs                                                      |
|----------------|--------|-------------------------------------------------------------------|
| **Agency**     | Yes    | Create campaigns, invite influencers, manage contracts & payouts  |
| **Brand**      | No     | Approve briefs and content, view spend                            |
| **Influencer** | No     | Accept invitations, sign contracts, submit deliverables, get paid |

## Tech stack

| Concern        | Choice                                                |
|----------------|-------------------------------------------------------|
| Framework      | Next.js 16 (App Router) + TypeScript                  |
| Styling        | Tailwind v4                                           |
| Database/Auth  | Supabase (Postgres + Auth + Storage with RLS)         |
| Payments       | **Razorpay Route** (marketplace payouts in INR)       |
| E-signature    | **Digio** (Aadhaar e-sign — legally strong in India)  |
| Email          | Resend                                                |
| Hosting        | Vercel                                                |

## Project layout

```
src/
  app/
    (auth)/                  login + signup
    agency/                  agency persona dashboard
    brand/                   brand persona dashboard
    influencer/              influencer persona dashboard
    api/webhooks/
      razorpay/              payout status updates
      digio/                 contract sign status updates
  components/                shared UI (PersonaShell, etc.)
  lib/
    supabase/                browser, server, and middleware clients
    razorpay/                Razorpay SDK wrapper
    money.ts                 paise <-> INR helpers
  middleware.ts              refreshes Supabase session on every request
supabase/
  migrations/
    0001_initial_schema.sql  full multi-tenant schema + RLS policies
```

## Data model (high-level)

```
agencies ──< agency_members
   │
   ├──< brands ──< brand_members
   │
   ├──< agency_influencer_roster >── influencers ──< (profiles)
   │
   └──< campaigns ──< campaign_invitations ──< contracts ──< deliverables
                                                  │              │
                                                  │              └──< deliverable_submissions
                                                  │
                                                  └──< payouts
```

All money is stored as **bigint paise** (1 INR = 100 paise) to avoid float drift.
Every state-changing action should also write to `audit_log` for transparency.

## Local setup

1. Install deps:
   ```bash
   npm install
   ```

2. Copy env template and fill in values:
   ```bash
   cp .env.example .env.local
   ```

3. Create a Supabase project (free tier) and run the migration:
   ```bash
   # Via Supabase dashboard SQL editor, paste the contents of:
   #   supabase/migrations/0001_initial_schema.sql
   ```

4. Run the dev server:
   ```bash
   npm run dev
   ```

## What's stubbed vs. built

**Built:**
- Project scaffolding, routing structure for all 3 personas
- Full Postgres schema with RLS policies
- Supabase client setup (browser + server + middleware)
- Razorpay client wrapper
- Webhook receivers for Razorpay and Digio (signature verification only)

**TODO (next iteration):**
- Auth flow (signup with role selection, magic-link login)
- Agency: campaign create → invite influencer → approve content → trigger payout
- Influencer: invitation accept → Digio e-sign redirect → submit content
- Brand: read-only campaign view + content approval
- Razorpay Contact + Fund Account creation on influencer onboarding
- Email notifications (invitation sent, contract ready to sign, payout completed)
- Audit log writes on all state changes

## Why these choices

- **Supabase over a hand-rolled API:** RLS gives us per-row tenant isolation
  for free, which matters when one DB serves agencies, brands, and influencers.
- **Razorpay over Stripe:** Stripe Connect has limited India payout support;
  Razorpay Route is the de-facto standard for INR marketplace payouts and
  handles GST/TDS natively.
- **Digio over DocuSign:** Aadhaar e-sign is cheaper, faster, and legally
  stronger in India under the IT Act, 2000.
