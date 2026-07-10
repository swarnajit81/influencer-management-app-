# For PR Agencies

A plain-English overview for agency owners and operations leads. No code.
For the engineering breakdown see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Who this is for

Indian PR agencies that:

- Run influencer campaigns for multiple brands.
- Coordinate over Instagram DMs, Gmail, and spreadsheets today.
- Spend Friday afternoons assembling status reports nobody can verify.

If two of those three describe you, keep reading.

---

## The pain (today)

| Where it hurts   | What actually happens                                                                                                | What it costs you                                                               |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Reporting**    | Brand asks for status. Account manager opens 5 chats and a spreadsheet.                                              | An afternoon, every Friday, per campaign.                                       |
| **Audit**        | "Who approved this?" — no answer.                                                                                    | Awkward at best. Legal exposure at worst.                                       |
| **Briefing**     | Brand brief sits in a Google Doc or PDF emailed to influencers one at a time. Versions drift.                        | Hours per campaign reconciling "which version are we on?"                       |
| **Negotiation**  | Offer amounts, deliverables, and dates negotiated in DMs. No single source of truth.                                 | Disputes when the influencer remembers a different number.                      |
| **Deliverables** | Influencer DMs a draft reel. Brand approves over email. Final post goes live before anyone has the link saved.       | No record of approvals. Brand asks "did we approve this?" two weeks later.      |
| **Revisions**    | "Can you change the caption?" — buried in chat.                                                                      | Revisions lost; influencer claims they were never asked.                        |
| **Contracts**    | Word docs e-mailed back and forth. Terms disputed after the fact.                                                    | Days lost. No record of what was agreed.                                        |
| **Payouts**      | Finance team manually triggers NEFT/UPI transfers. Tracks TDS in Excel.                                              | Late payouts hurt influencer relationships. Reconciliation hell at quarter-end. |

---

## The fix (this platform)

One workspace for the agency. Brands and influencers touch the platform only through secure links sent to them — no separate app to learn, no login to remember. Every state change is recorded.

**The two things it fixes on day one:**

1. **The brand stops asking "where are we?"** Every campaign gets a live status link the brand can open any time — brief, invitations, deliverables, approvals, spend. No signup for them, no Friday report for you.
2. **Every decision has a receipt.** Who invited whom, who approved what, when, with what feedback — all timestamped in an audit log. Disputes end with a link, not a screenshot hunt.

| Pain                      | How we solve it                                                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Where are we?"           | Agency has the full dashboard. Brands get a live status link per campaign. Influencers get a link per invitation.                                              |
| No audit trail            | Every state-changing action writes to an audit log: who did what, when, on which record.                                                                       |
| Briefs drift across email | Brief lives on the campaign. One canonical version. Brand opens a link, sees the same thing the influencer sees.                                               |
| Offers live in DMs        | Agency sends a structured invitation (amount, deliverables, deadlines) via email link. Influencer accepts or declines in one click — no signup.                |
| Approval chaos            | Influencer submits a content URL on their link. Agency or brand approves, requests changes, or marks live. Every action timestamped.                           |
| Contracts take days       | Contract auto-generated from the accepted invitation, accepted in one click, stored on the record. Aadhaar e-sign integration is on the roadmap.               |
| Manual payouts            | *(Roadmap)* Razorpay-powered INR payouts triggered from approved deliverables, with payout status tracked on the same record.                                  |

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
3. Contract        Influencer accepts in one click. Contract is generated
                   from the offer and stored on the record.
                   ↓
4. Delivery        Agency adds deliverables. Influencer submits content
                   URLs. Brand/agency approves or requests changes.
                   ↓
5. Payout          Track payout status per deliverable. (Automated
                   Razorpay payouts are on the roadmap.)
```

Every step is recorded in the audit log. No DM screenshots needed.

---

## What changes for each persona

### For the agency (you)

- One pane of glass for every campaign across every brand.
- No more chasing influencers for content links or contracts.
- No more Friday status decks — the brand link is always current.
- Finance and ops both work off the same numbers.

### For the brand

- A live status link per campaign — no signup, no password.
- See the brief, deliverables, and current status on one page.
- Approve content with one click; comments go straight to the audit log.
- Spend stays visible without anyone having to "send a status".

### For the influencer

- A link per invitation — no signup, no password.
- The offer is in plain numbers (amount, deliverables, deadlines) before they accept.
- Submit content by pasting a URL on the same page. Feedback shows up there.

---

## Money, tax, and law (the parts agencies care about)

- **Currency:** All amounts stored as paise (1 INR = 100 paise). Zero floating-point drift on rupees.
- **Audit trail:** Every state change is logged with actor, timestamp, and metadata. Your records outlive any chat thread.
- **Multi-tenancy:** Row-level security at the database. Agencies cannot see each other's data. Period.
- **Roadmap — payouts:** Razorpay-powered INR payouts from approved deliverables. (Note: GST/TDS computation stays with your finance team or CA; the platform gives them clean per-payout records to work from.)
- **Roadmap — e-sign:** Aadhaar e-sign for contracts (enforceable under the IT Act, 2000). v1 uses one-click acceptance with a full audit trail.

---

## Scope — v1 is agency-only

To ship something real, v1 builds **one app: the agency app.** Brands and influencers interact only through magic-link emails. No separate portals to build, no separate logins, no separate support load.

**v1 (live)**

- Agency login (magic link, no passwords).
- Campaign creation, influencer roster, structured invitations.
- Auto-generated contracts on invitation acceptance (one-click accept).
- Deliverable tracking: submit → review → approve / request changes → live.
- Full audit log on every state change.
- Live status links for brands (approve content) and influencers (accept invitations, submit deliverables).
- Payout queue with per-deliverable status tracking.

**Roadmap (after first paying agencies)**

- Automated Razorpay payouts in INR.
- Aadhaar e-sign for contracts.
- Standalone brand portal — cross-campaign visibility, brand-side dashboard.
- Standalone influencer portal — cross-invitation history, payout dashboard.
- Multi-user brand teams (right now, brand magic-links are per-recipient).

For a step-by-step demo of the live flows see
[`ARCHITECTURE.md` § 8 — Testing the flow end-to-end](./ARCHITECTURE.md#8-testing-the-flow-end-to-end).

---

## Where to start

1. Sign up as an agency. The platform creates your workspace automatically.
2. Add the brands you work with.
3. Build your influencer roster — add by email.
4. Create your first campaign. Run a real one. Tell us what broke.

The fastest way to validate this is to put one live campaign through it.
Pilot agencies get white-glove onboarding.
