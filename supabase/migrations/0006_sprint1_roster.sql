-- Sprint 1: agency-owned roster overhaul + rate card
-- Agencies manage influencer records directly (no self-signup required).
-- profile_id stays nullable; when set, links to a real creator account.

alter table influencers
  add column if not exists engagement_rate numeric(5,2),
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists portfolio_urls text[] default '{}',
  add column if not exists notes text;

create index if not exists influencers_contact_email_idx on influencers (contact_email);
create index if not exists influencers_instagram_handle_idx on influencers (instagram_handle);

-- Rate card: agency's baseline price per deliverable type per influencer.
-- cost_paise = what influencer earns. Agency margin lives on campaign shortlist row.
create table if not exists influencer_rate_card (
  influencer_id uuid not null references influencers(id) on delete cascade,
  deliverable_type deliverable_type not null,
  cost_inr_paise bigint not null check (cost_inr_paise >= 0),
  updated_at timestamptz not null default now(),
  primary key (influencer_id, deliverable_type)
);

alter table influencer_rate_card enable row level security;

create policy rate_card_agency_read on influencer_rate_card for select using (
  exists (
    select 1 from agency_influencer_roster r
    where r.influencer_id = influencer_rate_card.influencer_id
      and is_agency_member(r.agency_id)
  )
);

create policy rate_card_agency_write on influencer_rate_card for all using (
  exists (
    select 1 from agency_influencer_roster r
    where r.influencer_id = influencer_rate_card.influencer_id
      and is_agency_member(r.agency_id)
  )
) with check (
  exists (
    select 1 from agency_influencer_roster r
    where r.influencer_id = influencer_rate_card.influencer_id
      and is_agency_member(r.agency_id)
  )
);

-- Agencies can insert new influencer records (agency-owned creators).
-- We don't tie the influencer to a specific agency at row level because
-- influencers.profile_id is still meaningful when the creator signs up
-- later. Access control comes via the roster join (existing policy).
create policy influencers_agency_insert on influencers for insert
  with check (auth.uid() is not null);

-- Allow agencies to update influencer records that are on their roster.
create policy influencers_agency_update on influencers for update using (
  exists (
    select 1 from agency_influencer_roster r
    where r.influencer_id = influencers.id and is_agency_member(r.agency_id)
  )
) with check (
  exists (
    select 1 from agency_influencer_roster r
    where r.influencer_id = influencers.id and is_agency_member(r.agency_id)
  )
);
