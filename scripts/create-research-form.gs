/**
 * Google Apps Script — builds the PR Agency User Research form.
 *
 * One-time setup (5 min):
 * 1. Go to https://script.google.com and click "New project".
 * 2. Replace the default Code.gs contents with this file.
 * 3. Save (Cmd/Ctrl + S), then click "Run" with `createResearchForm`
 *    selected in the function dropdown.
 * 4. Approve the "Forms access" scope when prompted.
 * 5. Open View → Logs (or the Execution log) — the editor URL and the
 *    public response URL are printed there.
 *
 * Re-running creates a NEW form each time (the previous one stays put).
 */

function createResearchForm() {
  const form = FormApp.create('PR Agency User Research — Influencer Campaign Workflow');

  form.setDescription(
    "A 5–7 minute survey to understand how Indian PR agencies run influencer " +
    "campaigns today, what hurts most, and what a better system would look like. " +
    "We'll only use these answers to design the product — nothing is shared with " +
    "brands or other agencies. Pilot agencies get free white-glove onboarding."
  );
  form.setCollectEmail(false);
  form.setProgressBar(true);
  form.setShowLinkToRespondAgain(false);

  // ===== Section 1 — About your agency =====
  form.addPageBreakItem()
    .setTitle('About your agency')
    .setHelpText('Quick context — 90 seconds.');

  form.addTextItem()
    .setTitle('Agency name')
    .setHelpText('Optional')
    .setRequired(false);

  const q2 = form.addMultipleChoiceItem().setTitle('Your role').setRequired(true);
  q2.setChoices([
    q2.createChoice('Founder / owner'),
    q2.createChoice('Account director / lead'),
    q2.createChoice('Account manager / executive'),
    q2.createChoice('Operations / finance'),
  ]).showOtherOption(true);

  const q3 = form.addMultipleChoiceItem().setTitle('Where are you based?').setRequired(false);
  q3.setChoices([
    q3.createChoice('Mumbai'),
    q3.createChoice('Bangalore'),
    q3.createChoice('Delhi NCR'),
    q3.createChoice('Hyderabad'),
    q3.createChoice('Chennai'),
    q3.createChoice('Pune'),
  ]).showOtherOption(true);

  const q4 = form.addMultipleChoiceItem().setTitle('How big is your team?').setRequired(true);
  q4.setChoices([
    q4.createChoice('1–3 people'),
    q4.createChoice('4–10'),
    q4.createChoice('11–25'),
    q4.createChoice('26–50'),
    q4.createChoice('50+'),
  ]);

  const q5 = form.addMultipleChoiceItem()
    .setTitle('How many influencer campaigns do you run in a typical month?')
    .setRequired(true);
  q5.setChoices([
    q5.createChoice('0–2'),
    q5.createChoice('3–5'),
    q5.createChoice('6–10'),
    q5.createChoice('11–25'),
    q5.createChoice('25+'),
  ]);

  form.addTextItem()
    .setTitle('Roughly how many distinct influencers / creators have you worked with in the last 12 months?')
    .setRequired(false);

  const q7 = form.addMultipleChoiceItem()
    .setTitle("What's your typical campaign size?")
    .setRequired(false);
  q7.setChoices([
    q7.createChoice('Under ₹1 lakh'),
    q7.createChoice('₹1 lakh – ₹5 lakh'),
    q7.createChoice('₹5 lakh – ₹25 lakh'),
    q7.createChoice('₹25 lakh – ₹1 crore'),
    q7.createChoice('₹1 crore+'),
  ]);

  const q8 = form.addCheckboxItem()
    .setTitle('Which brand categories do you work with most?')
    .setHelpText('Pick all that apply.')
    .setRequired(false);
  q8.setChoices([
    q8.createChoice('Beauty / personal care'),
    q8.createChoice('Fashion'),
    q8.createChoice('F&B'),
    q8.createChoice('Tech / D2C'),
    q8.createChoice('Fintech'),
    q8.createChoice('Health & wellness'),
    q8.createChoice('Auto'),
    q8.createChoice('Travel'),
    q8.createChoice('Education'),
    q8.createChoice('Gaming'),
  ]).showOtherOption(true);

  // ===== Section 2 — How you work today =====
  form.addPageBreakItem()
    .setTitle('How you work today')
    .setHelpText('Tools, time, and where things live. ~2 minutes.');

  const TOOLS = [
    'Instagram DMs',
    'WhatsApp / WhatsApp Business',
    'Gmail / Outlook',
    'Google Sheets / Excel',
    'Notion',
    'Airtable',
    'Trello / Asana / ClickUp / Monday',
    'Slack',
    'DocuSign / similar e-sign',
    'Tally / Zoho / SAP for finance',
    'Custom internal tool',
  ];

  const q9 = form.addCheckboxItem()
    .setTitle('Which tools do you use to run a campaign end-to-end?')
    .setRequired(true);
  q9.setChoices(TOOLS.map(t => q9.createChoice(t))).showOtherOption(true);

  const q10 = form.addMultipleChoiceItem()
    .setTitle('Which one tool do you live in the most during a campaign?')
    .setRequired(true);
  q10.setChoices(TOOLS.map(t => q10.createChoice(t))).showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle('Walk us through a typical campaign from brief to live post. What are the steps?')
    .setHelpText('A few bullets is fine — we just want the real shape of the workflow.')
    .setRequired(false);

  const q12 = form.addMultipleChoiceItem()
    .setTitle('How much time does your team spend on a single campaign, end-to-end?')
    .setRequired(false);
  q12.setChoices([
    q12.createChoice('Under 5 hours'),
    q12.createChoice('5–15 hours'),
    q12.createChoice('15–40 hours'),
    q12.createChoice('40+ hours'),
  ]);

  const q13 = form.addMultipleChoiceItem()
    .setTitle('What % of that time is spent chasing people for status, content links, or signatures?')
    .setRequired(false);
  q13.setChoices([
    q13.createChoice('Under 10%'),
    q13.createChoice('10–25%'),
    q13.createChoice('25–50%'),
    q13.createChoice('50%+'),
  ]);

  const q14 = form.addCheckboxItem()
    .setTitle('Where are briefs, offers, and approvals stored today?')
    .setRequired(false);
  q14.setChoices([
    q14.createChoice('In email threads'),
    q14.createChoice('In DMs / WhatsApp'),
    q14.createChoice('In a Google Doc per campaign'),
    q14.createChoice('In a master Sheet'),
    q14.createChoice('In a project tool (Notion / Airtable / etc.)'),
    q14.createChoice('Nowhere consistent'),
  ]).showOtherOption(true);

  // ===== Section 3 — Pain points =====
  form.addPageBreakItem()
    .setTitle('Pain points')
    .setHelpText("Where it hurts. Be honest — vague answers don't help us design the fix.");

  const q15 = form.addCheckboxItem()
    .setTitle('Of the steps below, which 3 hurt the most today?')
    .setHelpText('Pick up to 3.')
    .setRequired(true);
  q15.setChoices([
    q15.createChoice('Writing & versioning the brand brief'),
    q15.createChoice('Negotiating offers with influencers'),
    q15.createChoice('Sending and signing contracts'),
    q15.createChoice('Tracking content drafts and approvals'),
    q15.createChoice('Handling revision requests'),
    q15.createChoice('Coordinating publishing / "go live" dates'),
    q15.createChoice('Triggering payouts in INR'),
    q15.createChoice('Handling GST / TDS / invoicing'),
    q15.createChoice('Reporting campaign status to the brand'),
    q15.createChoice('Reconciliation at month-end / quarter-end'),
    q15.createChoice('Keeping an audit trail of "who approved what"'),
  ]).showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle('For the single most painful step, describe what actually goes wrong and what it costs you.')
    .setRequired(false);

  const q17 = form.addMultipleChoiceItem()
    .setTitle('Have you ever had a dispute with an influencer or brand because of missing records (DMs, screenshots, lost emails)?')
    .setRequired(false);
  q17.setChoices([
    q17.createChoice('Yes, multiple times'),
    q17.createChoice('Yes, once'),
    q17.createChoice("No, but it's a risk we're aware of"),
    q17.createChoice('No'),
  ]);

  const q18 = form.addCheckboxItem()
    .setTitle('What goes wrong most often around payouts?')
    .setRequired(false);
  q18.setChoices([
    q18.createChoice('Late payment'),
    q18.createChoice('Wrong amount paid'),
    q18.createChoice('GST / TDS confusion'),
    q18.createChoice('Bank-detail mistakes'),
    q18.createChoice('Reconciliation pain at month-end'),
    q18.createChoice('Disputes over what was agreed'),
    q18.createChoice('Nothing — payouts are fine'),
  ]).showOtherOption(true);

  // ===== Section 4 — Contracts, legal, money =====
  form.addPageBreakItem()
    .setTitle('Contracts, legal, money')
    .setHelpText('60 seconds. The boring-but-load-bearing stuff.');

  const q19 = form.addMultipleChoiceItem()
    .setTitle('How do you sign contracts with influencers today?')
    .setRequired(false);
  q19.setChoices([
    q19.createChoice('Aadhaar e-sign (Leegality / NSDL / similar)'),
    q19.createChoice('DocuSign / Adobe Sign / similar foreign tool'),
    q19.createChoice('Wet-ink signatures on PDFs'),
    q19.createChoice('No formal contract, just DMs / emails'),
    q19.createChoice('Mix of the above'),
  ]).showOtherOption(true);

  const q20 = form.addMultipleChoiceItem()
    .setTitle('Have your contracts ever been challenged or felt weak in a dispute?')
    .setRequired(false);
  q20.setChoices([
    q20.createChoice('Yes'),
    q20.createChoice('No'),
    q20.createChoice('Not sure'),
  ]);

  const q21 = form.addCheckboxItem()
    .setTitle('How do you currently pay influencers?')
    .setRequired(true);
  q21.setChoices([
    q21.createChoice('NEFT / IMPS from agency bank'),
    q21.createChoice('UPI from agency account'),
    q21.createChoice('Razorpay / similar payment gateway'),
    q21.createChoice('Cash'),
    q21.createChoice('Cheque'),
    q21.createChoice("Through the brand directly (you don't handle money)"),
  ]).showOtherOption(true);

  const q22 = form.addMultipleChoiceItem()
    .setTitle('Who handles GST / TDS for influencer payouts?')
    .setRequired(false);
  q22.setChoices([
    q22.createChoice('Our in-house finance team'),
    q22.createChoice('External CA'),
    q22.createChoice('The brand handles it'),
    q22.createChoice("We don't deduct TDS today"),
    q22.createChoice('Not sure'),
  ]);

  form.addTextItem()
    .setTitle('Estimated INR value of influencer payouts you handle in a typical month?')
    .setHelpText('A rough range is fine — e.g. "₹2-5 lakh".')
    .setRequired(false);

  // ===== Section 5 — What "fixed" looks like =====
  form.addPageBreakItem()
    .setTitle('What "fixed" looks like')
    .setHelpText("Your ideal world. 90 seconds.");

  const q24 = form.addMultipleChoiceItem()
    .setTitle('If a tool could fix ONE thing tomorrow, what would you pick?')
    .setRequired(true);
  q24.setChoices([
    q24.createChoice('One canonical source of truth for briefs, offers, and approvals'),
    q24.createChoice('Aadhaar e-sign for contracts in minutes'),
    q24.createChoice('Automated INR payouts with GST/TDS handled'),
    q24.createChoice('One status page the brand can see without asking'),
    q24.createChoice('Full audit log for every decision'),
    q24.createChoice('Automated influencer outreach + reminders'),
  ]).showOtherOption(true);

  const q25 = form.addMultipleChoiceItem()
    .setTitle("Would you trust a structured invitation link (sent to the influencer's email) over a DM negotiation?")
    .setRequired(false);
  q25.setChoices([
    q25.createChoice('Yes, immediately'),
    q25.createChoice('Yes, after seeing it work once'),
    q25.createChoice("Not sure — depends on the influencer's response"),
    q25.createChoice('No, our influencers prefer DMs'),
  ]);

  const q26 = form.addMultipleChoiceItem()
    .setTitle('For the brand-facing view (briefs, approvals, spend), would you want…')
    .setRequired(false);
  q26.setChoices([
    q26.createChoice('A read-only link per campaign (no signup for the brand)'),
    q26.createChoice('A full login / dashboard for the brand'),
    q26.createChoice('Both'),
    q26.createChoice('Neither — we prefer to keep the brand off the tool'),
  ]);

  const q27 = form.addMultipleChoiceItem()
    .setTitle('Would your influencers tolerate a magic-link page (no signup) for accepting offers and submitting content?')
    .setRequired(false);
  q27.setChoices([
    q27.createChoice("Yes, this is exactly what they'd want"),
    q27.createChoice('Probably — depends on how clean it looks'),
    q27.createChoice('No — they want a full app / login'),
    q27.createChoice('Not sure'),
  ]);

  const q28 = form.addMultipleChoiceItem()
    .setTitle("What's a fair monthly price for a tool that handles briefs, contracts, deliverables, and payouts for your agency?")
    .setRequired(false);
  q28.setChoices([
    q28.createChoice('Under ₹2,000 / month'),
    q28.createChoice('₹2,000 – ₹5,000'),
    q28.createChoice('₹5,000 – ₹15,000'),
    q28.createChoice('₹15,000 – ₹40,000'),
    q28.createChoice('₹40,000+'),
    q28.createChoice('Per-campaign pricing would work better'),
  ]).showOtherOption(true);

  form.addParagraphTextItem()
    .setTitle('Anything else we should know about your workflow or your pain?')
    .setRequired(false);

  // ===== Section 6 — Pilot interest =====
  const pilotPage = form.addPageBreakItem()
    .setTitle('Pilot interest')
    .setHelpText('30 seconds. Last page.');

  const q30 = form.addMultipleChoiceItem()
    .setTitle('Would you be open to a 30-day pilot with free white-glove onboarding?')
    .setRequired(true);

  // Conditional logic: if "Not right now" → submit; else continue to contact info.
  const contactPage = form.addPageBreakItem()
    .setTitle('Contact details')
    .setHelpText("We'll only use this to reach out about the pilot.");

  form.addTextItem()
    .setTitle('Best way to reach you')
    .setHelpText('Email / phone / WhatsApp / LinkedIn — whichever you check most.')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('Anything we should know before reaching out?')
    .setRequired(false);

  q30.setChoices([
    q30.createChoice('Yes — please contact me', contactPage),
    q30.createChoice('Maybe — share more details first', contactPage),
    q30.createChoice('Not right now', FormApp.PageNavigationType.SUBMIT),
  ]);

  // Suppress reference variable lint warnings — these are required for setup
  // even though we don't read them after configuration.
  void [pilotPage];

  const formUrl = form.getEditUrl();
  const publicUrl = form.getPublishedUrl();
  const shortUrl = form.shortenFormUrl(publicUrl);

  Logger.log('Form created.');
  Logger.log('Editor URL  : ' + formUrl);
  Logger.log('Respond URL : ' + publicUrl);
  Logger.log('Short URL   : ' + shortUrl);

  return { editorUrl: formUrl, publicUrl: publicUrl, shortUrl: shortUrl };
}
