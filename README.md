# PR Platform

A workspace for Indian PR agencies to run influencer–brand campaigns end-to-end:
**briefs → contracts → deliverables → payouts** — all in INR, all in one place.

Built to replace the Instagram-DM + Gmail workflow that leaves brands and
influencers without visibility into campaign status, contract state, or when
they'll get paid.

> Full system design, build status, and an end-to-end test plan live in
> [`ARCHITECTURE.md`](./ARCHITECTURE.md). Start there if you're contributing.

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
| Payments       | **Razorpay Route** — marketplace payouts in INR       |
| E-signature    | **Leegality** — Aadhaar e-sign, legally strong in India |
| Email          | Resend                                                |
| Hosting        | Vercel                                                |

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
Every state-changing server action also writes to `audit_log` for transparency.

## Local setup

1. Install deps:
   ```bash
   npm install
   ```

2. Copy env template and fill in values (Supabase, Razorpay, Leegality, Resend):
   ```bash
   cp .env.example .env.local
   ```

3. Create a Supabase project and apply the migrations in order via the SQL editor:
   ```
   supabase/migrations/0001_initial_schema.sql
   supabase/migrations/0002_auth_trigger.sql
   supabase/migrations/0003_contract_digio_fields.sql
   ```

4. Run the dev server:
   ```bash
   npm run dev
   ```

## Status at a glance

**Built**
- Magic-link auth with role-based dashboard routing
- Agency: campaigns (list / create / detail), influencer roster, contract detail with deliverable management and review
- Influencer: invitation accept/decline, contract list and detail, deliverable submission and resubmission
- Supabase schema, RLS policies, and the `handle_new_user` bootstrap trigger
- Leegality e-sign client + webhook
- Razorpay webhook with signature verification
- Audit log writes across the flows

**Partial / not yet built**
- Razorpay webhook event handling and payout initiation
- Brand portal pages beyond scaffolding
- Persona dashboards (`/agency`, `/brand`, `/influencer`) are still stubs
- Brand creation UI for agencies (currently SQL-only)
- Resend integration (no emails sent yet)

See [`ARCHITECTURE.md`](./ARCHITECTURE.md#6-status--whats-done--whats-left)
for the full breakdown and a step-by-step test plan.

## Why these choices

- **Supabase over a hand-rolled API** — RLS gives per-row tenant isolation for
  free, which matters when one DB serves agencies, brands, and influencers.
- **Razorpay over Stripe** — Stripe Connect has limited India payout support;
  Razorpay Route is the de-facto standard for INR marketplace payouts and
  handles GST/TDS natively.
- **Leegality over DocuSign** — Aadhaar e-sign is cheaper, faster, and legally
  stronger in India under the IT Act, 2000.
