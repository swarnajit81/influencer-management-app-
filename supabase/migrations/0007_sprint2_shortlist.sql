-- Sprint 2: campaign shortlist (agency's pitch to brand) + package versions

-- Extend campaign_status. Postgres enum ALTER TYPE ADD VALUE cannot run
-- inside a transaction with other DDL, so isolate it.
alter type campaign_status add value if not exists 'pitching';
alter type campaign_status add value if not exists 'brand_approved';

create type brand_decision as enum ('pending', 'approved', 'rejected');

-- One row per (campaign, influencer) that the agency is pitching to the brand.
create table campaign_shortlist_items (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  influencer_id uuid not null references influencers(id) on delete restrict,
  rationale text,
  -- Agency's cost (what creator earns) and brand price (what brand pays).
  proposed_cost_inr_paise bigint not null default 0 check (proposed_cost_inr_paise >= 0),
  brand_price_inr_paise bigint not null default 0 check (brand_price_inr_paise >= 0),
  -- Free-form deliverable spec so agencies can bundle multiple items per creator.
  -- Shape: [{ type: deliverable_type, count: number, notes?: string }, ...]
  deliverables jsonb not null default '[]'::jsonb,
  sample_urls text[] not null default '{}',
  brand_decision brand_decision not null default 'pending',
  brand_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, influencer_id)
);

create index campaign_shortlist_campaign_idx on campaign_shortlist_items (campaign_id);
create index campaign_shortlist_decision_idx on campaign_shortlist_items (campaign_id, brand_decision);

alter table campaign_shortlist_items enable row level security;

create policy shortlist_agency_all on campaign_shortlist_items for all using (
  exists (
    select 1 from campaigns c
    where c.id = campaign_shortlist_items.campaign_id
      and is_agency_member(c.agency_id)
  )
) with check (
  exists (
    select 1 from campaigns c
    where c.id = campaign_shortlist_items.campaign_id
      and is_agency_member(c.agency_id)
  )
);

-- Frozen snapshot of the shortlist at the moment the agency sends it to the brand.
-- Brand always views a specific version so prices can't shift under them.
create table package_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  version_number integer not null,
  sent_at timestamptz not null default now(),
  sent_to_email text,
  sent_by_profile_id uuid references profiles(id),
  -- Immutable capture: campaign brief + shortlist rows at send time.
  snapshot jsonb not null,
  unique (campaign_id, version_number)
);

create index package_versions_campaign_idx on package_versions (campaign_id, version_number desc);

alter table package_versions enable row level security;

create policy package_versions_agency_all on package_versions for all using (
  exists (
    select 1 from campaigns c
    where c.id = package_versions.campaign_id
      and is_agency_member(c.agency_id)
  )
) with check (
  exists (
    select 1 from campaigns c
    where c.id = package_versions.campaign_id
      and is_agency_member(c.agency_id)
  )
);
