-- Product pivot: drop the influencer-facing execution surface.
-- We no longer track influencer invitations, contracts, deliverables, or
-- payouts inside the app. The product now ends at "brand approves the
-- shortlist"; outreach + payment happen off-platform.

drop table if exists payouts cascade;
drop table if exists deliverable_submissions cascade;
drop table if exists deliverables cascade;
drop table if exists contracts cascade;
drop table if exists campaign_invitations cascade;

-- Enums that only these tables used.
drop type if exists payout_status;
drop type if exists contract_status;
drop type if exists deliverable_status;
drop type if exists invitation_status;
drop type if exists payment_terms;

-- Bank / KYC fields on influencers only mattered for payouts.
alter table influencers
  drop column if exists bank_account_number,
  drop column if exists bank_ifsc,
  drop column if exists bank_account_holder_name,
  drop column if exists pan,
  drop column if exists gstin,
  drop column if exists razorpay_contact_id,
  drop column if exists razorpay_fund_account_id;

-- deliverable_type enum is still used by influencer_rate_card and by the
-- deliverables JSON on campaign_shortlist_items — keep it.
