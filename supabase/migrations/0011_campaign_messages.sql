-- Sprint 4: per-campaign message thread between agency and brand.
-- shortlist_item_id is nullable now so we can add per-item threads later
-- without a schema change.

create type message_sender_kind as enum ('agency', 'brand');

create table campaign_messages (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  shortlist_item_id uuid references campaign_shortlist_items(id) on delete set null,
  sender_kind message_sender_kind not null,
  sender_profile_id uuid references profiles(id),
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index campaign_messages_campaign_idx on campaign_messages (campaign_id, created_at);
create index campaign_messages_item_idx on campaign_messages (shortlist_item_id, created_at)
  where shortlist_item_id is not null;

alter table campaign_messages enable row level security;

-- Agency members read + write on their own campaigns. Brand writes go
-- through the admin client from server actions gated by the package token.
create policy campaign_messages_agency_all on campaign_messages for all using (
  exists (
    select 1 from campaigns c
    where c.id = campaign_messages.campaign_id
      and is_agency_member(c.agency_id)
  )
) with check (
  exists (
    select 1 from campaigns c
    where c.id = campaign_messages.campaign_id
      and is_agency_member(c.agency_id)
  )
);
