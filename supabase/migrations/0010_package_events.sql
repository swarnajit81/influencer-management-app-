-- Sprint 3: package events. One row per meaningful action on a campaign's
-- package flow so the agency dashboard can show "Brand viewed 2h ago,
-- approved 3/5" without scraping audit_log.

create type package_actor_kind as enum ('agency', 'brand');

create type package_event_type as enum (
  'package_sent',
  'package_viewed',
  'item_approved',
  'item_rejected',
  'item_commented',
  'revision_requested'
);

create table package_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  package_version_id uuid references package_versions(id) on delete set null,
  shortlist_item_id uuid references campaign_shortlist_items(id) on delete set null,
  actor_kind package_actor_kind not null,
  actor_profile_id uuid references profiles(id),
  event_type package_event_type not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index package_events_campaign_idx on package_events (campaign_id, occurred_at desc);
create index package_events_type_idx on package_events (event_type, occurred_at desc);

alter table package_events enable row level security;

-- Agency members read events for campaigns they own. Writes go through the
-- admin client (server actions) so no INSERT policy for authenticated users
-- is needed here.
create policy package_events_agency_read on package_events for select using (
  exists (
    select 1 from campaigns c
    where c.id = package_events.campaign_id
      and is_agency_member(c.agency_id)
  )
);
