# For PR Agencies

A plain-English overview for agency owners and operations leads. No code.
For the engineering breakdown see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Who this is for

Indian PR agencies that:

- Run influencer campaigns for multiple brands.
- Pitch creator shortlists to brands over WhatsApp screenshots, PDFs, and email threads.
- Spend Friday afternoons assembling status reports nobody can verify.

If two of those three describe you, keep reading.

---

## The pain (today)

| Where it hurts     | What actually happens                                                                                                        | What it costs you                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Pitching**       | Shortlist lives in a Google Sheet. You screenshot creator profiles, paste prices, email the deck. Brand pings back on WhatsApp. | Half a day per pitch. Half a day per revision.               |
| **Version drift**  | Brand replies "approve Riya, drop Aditya, negotiate on Meera" on a v2 deck you can't find. Now v3 has stale prices.          | Nobody knows which price is committed on which creator.      |
| **Approvals**      | "Did the brand say yes to the reel + 2 stories bundle, or just the reel?" — buried in a thread.                              | Awkward calls. Sometimes the wrong creator gets confirmed.   |
| **Status asks**    | Brand asks "where are we?" Account manager opens 5 chats and a spreadsheet.                                                  | An afternoon, every Friday, per campaign.                    |
| **Audit**          | "Who approved this price?" — no answer.                                                                                       | Awkward at best. Legal exposure at worst.                    |

---

## The fix (this platform)

One workspace for the agency. Brands touch the platform only through a signed link per campaign — no signup, no password, no app to learn. Every state change is recorded.

**The two things it fixes on day one:**

1. **The brand stops asking "where are we?"** Every campaign gets a live package link the brand can open any time — creators, prices, deliverables, per-creator approve/reject state, and a message thread with the agency. No signup for them, no Friday deck for you.
2. **Every decision has a receipt.** Who sent which version, who viewed it, who approved which creator at which price with what comment — all timestamped in an event log. Disputes end with a link, not a screenshot hunt.

| Pain                     | How we solve it                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Where are we?"          | Agency has the full dashboard. Brand gets one live package link per campaign — always current.                                                     |
| No audit trail           | Every brand view, decision, revision, and message writes to a `package_events` log with actor, timestamp, and metadata.                            |
| Shortlists drift in decks | Shortlist lives on the campaign — one canonical version. Sending to the brand freezes a numbered snapshot the brand always sees.                  |
| Prices renegotiated in DMs | Proposed cost (what you pay the creator) and brand price (what you quote the brand) live on the same row. Margin is calculable, not hand-waved.  |
| Approval chaos           | Brand approves, rejects, or requests revision per creator, on the package link. Every action timestamped and visible on the agency dashboard.     |
| Back-and-forth in chats  | Per-campaign message thread on the same package link — no separate WhatsApp thread to reconcile.                                                   |

### Why this shape

Two full apps (agency + brand) means twice the surface area, two onboarding flows, and slower time-to-first-paying-customer. The agency is the buyer — that app is rich. Brands are touchpoints, not users to acquire. A signed package link keeps their experience friction-free and the build focused.

---

## How it works (end-to-end)

A campaign moves through four stages. Each stage has clear ownership.

```
1. Setup       Agency creates the brand + campaign. Sets budget + brief.
               ↓
2. Shortlist   Agency picks creators from its roster. Sets proposed cost
               (to creator) and brand price (to brand) + deliverables.
               ↓
3. Package     Agency sends the shortlist to the brand as a signed link.
               A numbered snapshot is frozen; the brand always sees v_n.
               ↓
4. Decisions   Brand approves / rejects / requests revision per creator on
               the same link. Agency + brand chat inline on the campaign.
```

Every brand view, decision, and message writes to the event log. No screenshot needed.

---

## What changes for each persona

### For the agency (you)

- One pane of glass for every campaign across every brand.
- Reusable creator roster with rate cards, niches, follower/engagement snapshots, sample content.
- Per-creator margin visible before you send.
- Unread badge on the inbox — you see brand action the moment they take it.
- Full event log for any dispute.

### For the brand

- One live package link per campaign — no signup, no password.
- See brief, creator lineup, prices, deliverables, timeline on one page.
- Approve, reject, or request revision per creator with a click and an optional note.
- Message the agency on the same page — no separate thread.

---

## Money, tax, and law (the parts agencies care about)

- **Currency:** All amounts stored as paise (1 INR = 100 paise). Zero floating-point drift on rupees.
- **Event log:** Every brand-side action (viewed, decision, revision request, message) is logged with actor, timestamp, and metadata. Your record outlives any chat thread.
- **Multi-tenancy:** Row-level security at the database. Agencies cannot see each other's data. Period.
- **What we don't do (yet):** Contracts, e-sign, deliverable submissions, payouts, TDS — those stay in your existing workflow. The platform ends at brand approval. That's a deliberate scope call, not a shortfall.

---

## Scope — v1 is the pitch loop

v1 builds **one app: the agency app**, with a brand-facing package portal reached only by signed link. Everything that comes after brand approval — contract, e-sign, content submission, payout — is out of scope for v1.

**v1 (live)**

- Agency login (magic link, no passwords).
- Brand roster + auto-provisioned brand profiles.
- Creator roster with rate cards, sample content, socials.
- Multi-select roster picker for building a campaign shortlist.
- Campaign shortlist with proposed cost, brand price, deliverables mix, rationale.
- Send shortlist to brand as a signed package link — numbered, snapshotted.
- Brand approve / reject / request revision per creator on that link.
- Per-campaign message thread (agency ↔ brand) on the package link.
- Event log for every brand action.
- Agency inbox with per-member unread state — brand actions ping the badge.

**Not on the roadmap right now**

- Contracts, deliverable submission, payouts, Razorpay, Aadhaar e-sign. If your pipeline needs those, keep using what you have — the platform hands off cleanly at brand approval.
- Standalone influencer login. Creators sit in your roster; there's no influencer-facing app.
- Multi-user brand teams. Brand link is per-campaign, not per-user.

**Might come after first paying agencies**

- Multi-user agency invites (right now the founding member is the sole account).
- Post-live reporting — capture the final content URLs + reach so the campaign has a close-out row, not just an open-ended approval.

For a step-by-step demo of the live flows see
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Where to start

1. Sign up as an agency. The platform creates your workspace automatically.
2. Add the brands you work with.
3. Build your creator roster — rate card, socials, niches, sample links.
4. Create your first campaign, shortlist creators, send the package to the brand.
5. Run a real one. Tell us what broke.

The fastest way to validate this is to put one live pitch through it.
Pilot agencies get white-glove onboarding.
