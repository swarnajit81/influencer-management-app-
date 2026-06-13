# For PR Agencies

A plain-English overview for agency owners and operations leads. No code.
For the engineering breakdown see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Who this is for

¯
Indian PR agencies that:

- Run influencer campaigns for multiple brands.
- Coordinate over Instagram DMs, Gmail, and spreadsheets today.
- Pay influencers in INR, deal with GST/TDS, and want a paper trail.

If two of those three describe you, keep reading.

---

## The pain (today)

| Where it hurts   | What actually happens                                                                                                | What it costs you                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Briefing**     | Brand brief sits in a Google Doc or PDF emailed to influencers one at a time. Versions drift.                        | Hours per campaign reconciling "which version are we on?"                       |
| **Negotiation**  | Offer amounts, deliverables, and dates negotiated in DMs. No single source of truth.                                 | Disputes when the influencer remembers a different number.                      |
| **Contracts**    | Word docs e-mailed back and forth. Signatures collected on paper or via DocuSign (expensive, weak under Indian law). | Days lost. Brand pushback on terms after the fact.                              |
| **Deliverables** | Influencer DMs a draft reel. Brand approves over email. Final post goes live before anyone has the link saved.       | No record of approvals. Brand asks "did we approve this?" two weeks later.      |
| **Revisions**    | "Can you change the caption?" — buried in chat.                                                                      | Revisions lost; influencer claims they were never asked.                        |
| **Payouts**      | Finance team manually triggers NEFT/UPI transfers. Tracks TDS in Excel.                                              | Late payouts hurt influencer relationships. Reconciliation hell at quarter-end. |
| **Reporting**    | Brand asks for status. Account manager opens 5 chats and a spreadsheet.                                              | An afternoon, every Friday, per campaign.                                       |
| **Audit**        | "Who approved this?" — no answer.                                                                                    | Awkward at best. Legal exposure at worst.                                       |

---

## The fix (this platform)

One workspace for the agency. Brands and influencers touch the platform only through secure links sent to them — no separate app to learn, no login to remember. Every state change is recorded.

| Pain                      | How we solve it                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Briefs drift across email | Brief lives on the campaign. One canonical version. Brand opens a link, sees the same thing the influencer sees.                                               |
| Offers live in DMs        | Agency sends a structured invitation (amount, deliverables, deadlines) via email link. Influencer accepts or declines in one click — no signup.                |
| Contracts take days       | Contract auto-generated from the accepted invitation. Aadhaar e-sign via Leegality — legally stronger than DocuSign under the IT Act, 2000. Minutes, not days. |
| Approval chaos            | Influencer submits a content URL on the invitation page. Agency approves, requests changes, or marks live. Every action timestamped.                           |
| Manual payouts            | Razorpay Route handles payouts in INR. GST/TDS handled natively. Status updates flow back automatically.                                                       |
| No audit trail            | Every state-changing action writes to an audit log: who did what, when, on which record.                                                                       |
| "Where are we?"           | Agency has the full dashboard. Brands get a magic-link status page per campaign. Influencers get a magic-link page per invitation.                              |

### Why this shape

Three full apps (agency + brand + influencer) means three times the surface area, three onboarding flows, and slower time-to-first-paying-customer. The agency is the buyer — that app is rich. Brands and influencers are touchpoints, not users to acquire. Magic-link portals keep their experience friction-free and the build focused.

---

## How it works (end-to-end)

A campaign moves through five stages. Each stage has clear ownership.

```
1. Setup           Agency creates the brand + campaign. Sets budget.
                   ↓
2. Invitation      Agency picks influencers from its roster. Sends an
                   offer (amount, deliverables, deadlines).
                   ↓
3. Contract        Influencer accepts. Contract is generated and sent for
                   Aadhaar e-sign. Brand counter-signs.
                   ↓
4. Delivery        Agency adds deliverables. Influencer submits content
                   URLs. Brand/agency approves or requests changes.
                   Influencer marks each deliverable live.
                   ↓
5. Payout          Razorpay Route pays the influencer in INR. Status
                   updates flow back to the contract and campaign.
```

Every step is recorded in the audit log. No DM screenshots needed.

---

## What changes for each persona

### For the agency (you)

- One pane of glass for every campaign across every brand.
- No more chasing influencers for content links or contracts.
- Payouts are triggered, not typed out.
- Finance and ops both work off the same numbers.

### For the brand

- A magic-link email per campaign — no signup, no password.
- See the brief, deliverables, and current status on one page.
- Approve content with one click; comments go straight to the audit log.
- Spend stays visible without anyone having to "send a status".

### For the influencer

- A magic-link email per invitation — no signup, no password.
- The offer is in plain numbers (amount, deliverables, deadlines) before they accept.
- Contracts signed on their phone via Aadhaar in minutes.
- Submit content by pasting a URL on the same page. Feedback shows up there.
- Payout status updates live on that same page.

---

## Money, tax, and law (the parts agencies care about)

- **Currency:** All amounts stored as paise (1 INR = 100 paise). Zero floating-point drift on rupees.
- **Payouts:** Razorpay Route is built for Indian marketplace payouts. GST and TDS are handled natively — no Excel reconciliation.
- **E-sign:** Leegality's Aadhaar e-sign is enforceable under the IT Act, 2000. Stronger evidentiary value than wet signatures or DocuSign in Indian courts.
- **Bank details:** Influencer bank account verification is built into the onboarding flow before any payout can be initiated.
- **Multi-tenancy:** Row-level security at the database. Agencies cannot see each other's data. Period.

---

## Scope — v1 is agency-only

To ship something real, v1 builds **one app: the agency app.** Brands and influencers interact only through magic-link emails. No separate portals to build, no separate logins, no separate support load.

**v1 (live or in progress)**

- Agency login (magic link, no passwords).
- Campaign creation, influencer roster, structured invitations.
- Auto-generated contracts on invitation acceptance.
- Deliverable tracking: submit → review → approve / request changes → live.
- Full audit log on every state change.
- Leegality e-sign integration.
- Razorpay payout webhook.
- Magic-link pages for brands (approve briefs/content) and influencers (accept invitations, sign, submit deliverables).

**Deferred to v2 (after first paying agency)**

- Standalone brand portal — cross-campaign visibility, brand-side dashboard.
- Standalone influencer portal — cross-invitation history, payout dashboard.
- Multi-user brand teams (right now, brand magic-links are per-recipient).

For a step-by-step demo of the live flows see
[`ARCHITECTURE.md` § 8 — Testing the flow end-to-end](./ARCHITECTURE.md#8-testing-the-flow-end-to-end).

---

## Where to start

1. Sign up as an agency. The platform creates your workspace automatically.
2. Add brands you work with (currently provisioned by support).
3. Build your influencer roster — invite by email.
4. Create your first campaign. Run a real one. Tell us what broke.

The fastest way to validate this is to put one live campaign through it.
Pilot agencies get free white-glove onboarding.
