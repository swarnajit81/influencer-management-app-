-- =====================================================
-- 0001_initial_schema.sql
-- Influencer Management Platform - Initial schema
--
-- Conventions:
--   * All money columns are bigint paise (1 INR = 100 paise) to avoid float drift.
--   * Multi-tenancy is enforced through Row Level Security; do not bypass.
--   * Every state-changing action should also write to audit_log for transparency.
-- =====================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- -------------------------------------------------
-- Enums
-- -------------------------------------------------
create type user_role as enum ('agency_member', 'brand_member', 'influencer');
create type agency_member_role as enum ('owner', 'admin', 'manager');
create type campaign_status as enum ('draft', 'active', 'completed', 'cancelled');
create type invitation_status as enum ('pending', 'accepted', 'declined', 'withdrawn', 'expired');
create type contract_status as enum (
  'draft', 'sent', 'signed_by_influencer', 'signed_by_brand', 'fully_signed', 'cancelled'
);
create type deliverable_type as enum (
  'instagram_post', 'instagram_reel', 'instagram_story',
  'youtube_video', 'youtube_short',
  'twitter_post', 'blog_post', 'other'
);
create type deliverable_status as enum (
  'pending', 'submitted', 'changes_requested', 'approved', 'rejected', 'live'
);
create type payout_status as enum (
  'pending', 'queued', 'processing', 'paid', 'failed', 'reversed'
);

-- -------------------------------------------------
-- profiles - one row per auth.users entry
-- -------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null unique,
  phone text,
  avatar_url text,
  primary_role user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------
-- agencies (top-level tenant)
-- -------------------------------------------------
create table agencies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  gstin text,
  pan text,
  address text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table agency_members (
  agency_id uuid not null references agencies(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role agency_member_role not null default 'manager',
  created_at timestamptz not null default now(),
  primary key (agency_id, profile_id)
);

-- -------------------------------------------------
-- brands (always owned by an agency in v1)
-- -------------------------------------------------
create table brands (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete restrict,
  name text not null,
  contact_email text not null,
  contact_phone text,
  gstin text,
  pan text,
  billing_address text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agency_id, name)
);

create table brand_members (
  brand_id uuid not null references brands(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (brand_id, profile_id)
);

-- -------------------------------------------------
-- influencers
-- -------------------------------------------------
create table influencers (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references profiles(id) on delete cascade,
  display_name text not null,
  bio text,
  primary_platform text,
  instagram_handle text,
  youtube_handle text,
  twitter_handle text,
  follower_count_total bigint default 0,
  niches text[] default '{}',
  city text,
  state text,
  pan text,
  gstin text,
  bank_account_number text,
  bank_ifsc text,
  bank_account_holder_name text,
  razorpay_contact_id text,
  razorpay_fund_account_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index influencers_niches_idx on influencers using gin (niches);

-- An agency's private roster of influencers they work with.
create table agency_influencer_roster (
  agency_id uuid not null references agencies(id) on delete cascade,
  influencer_id uuid not null references influencers(id) on delete cascade,
  added_by uuid references profiles(id),
  notes text,
  created_at timestamptz not null default now(),
  primary key (agency_id, influencer_id)
);

-- -------------------------------------------------
-- campaigns
-- -------------------------------------------------
create table campaigns (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references agencies(id) on delete restrict,
  brand_id uuid not null references brands(id) on delete restrict,
  name text not null,
  brief text,
  total_budget_inr_paise bigint not null default 0,
  start_date date,
  end_date date,
  status campaign_status not null default 'draft',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaigns_agency_idx on campaigns (agency_id);
create index campaigns_brand_idx on campaigns (brand_id);
create index campaigns_status_idx on campaigns (status);

-- -------------------------------------------------
-- campaign_invitations - agency offers a slot to an influencer
-- -------------------------------------------------
create table campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  influencer_id uuid not null references influencers(id) on delete restrict,
  offer_amount_inr_paise bigint not null,
  offer_message text,
  deliverables_summary text,
  status invitation_status not null default 'pending',
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, influencer_id)
);

create index campaign_invitations_campaign_idx on campaign_invitations (campaign_id);
create index campaign_invitations_influencer_idx on campaign_invitations (influencer_id);

-- -------------------------------------------------
-- contracts (created when an invitation is accepted)
-- -------------------------------------------------
create table contracts (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null unique references campaign_invitations(id) on delete restrict,
  campaign_id uuid not null references campaigns(id) on delete restrict,
  influencer_id uuid not null references influencers(id) on delete restrict,
  total_amount_inr_paise bigint not null,
  payment_terms text not null default 'on_completion',
  contract_html text,
  signed_pdf_url text,
  digio_document_id text,
  status contract_status not null default 'draft',
  influencer_signed_at timestamptz,
  brand_signed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- -------------------------------------------------
-- deliverables (what the influencer must produce)
-- -------------------------------------------------
create table deliverables (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  type deliverable_type not null,
  description text,
  due_date date,
  amount_inr_paise bigint not null default 0,
  status deliverable_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index deliverables_contract_idx on deliverables (contract_id);

create table deliverable_submissions (
  id uuid primary key default gen_random_uuid(),
  deliverable_id uuid not null references deliverables(id) on delete cascade,
  submitted_by uuid not null references profiles(id),
  content_url text,
  file_url text,
  caption text,
  notes text,
  reviewer_feedback text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------
-- payouts (Razorpay-backed)
-- -------------------------------------------------
create table payouts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete restrict,
  deliverable_id uuid references deliverables(id) on delete restrict,
  influencer_id uuid not null references influencers(id) on delete restrict,
  amount_inr_paise bigint not null,
  status payout_status not null default 'pending',
  razorpay_payout_id text,
  razorpay_transfer_id text,
  failure_reason text,
  initiated_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payouts_contract_idx on payouts (contract_id);
create index payouts_status_idx on payouts (status);

-- -------------------------------------------------
-- audit_log (transparency layer - every state change goes here)
-- -------------------------------------------------
create table audit_log (
  id bigserial primary key,
  actor_profile_id uuid references profiles(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);

-- -------------------------------------------------
-- updated_at trigger applied to every table that has the column
-- -------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where column_name = 'updated_at' and table_schema = 'public'
  loop
    execute format('drop trigger if exists set_updated_at on %I', t);
    execute format(
      'create trigger set_updated_at before update on %I for each row execute procedure set_updated_at()',
      t
    );
  end loop;
end $$;

-- =====================================================
-- Row Level Security
-- =====================================================
alter table profiles                  enable row level security;
alter table agencies                  enable row level security;
alter table agency_members            enable row level security;
alter table brands                    enable row level security;
alter table brand_members             enable row level security;
alter table influencers               enable row level security;
alter table agency_influencer_roster  enable row level security;
alter table campaigns                 enable row level security;
alter table campaign_invitations      enable row level security;
alter table contracts                 enable row level security;
alter table deliverables              enable row level security;
alter table deliverable_submissions   enable row level security;
alter table payouts                   enable row level security;
alter table audit_log                 enable row level security;

create or replace function is_agency_member(_agency_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from agency_members
    where agency_id = _agency_id and profile_id = auth.uid()
  );
$$;

create or replace function is_brand_member(_brand_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from brand_members
    where brand_id = _brand_id and profile_id = auth.uid()
  );
$$;

create or replace function is_influencer(_influencer_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from influencers
    where id = _influencer_id and profile_id = auth.uid()
  );
$$;

-- profiles
create policy profiles_self_select on profiles for select using (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid());

-- agencies
create policy agencies_member_select on agencies for select using (is_agency_member(id));
create policy agencies_owner_update on agencies for update using (
  exists (
    select 1 from agency_members
    where agency_id = agencies.id and profile_id = auth.uid() and role = 'owner'
  )
);

-- agency_members
create policy agency_members_select on agency_members for select using (is_agency_member(agency_id));

-- brands
create policy brands_select on brands for select using (
  is_agency_member(agency_id) or is_brand_member(id)
);
create policy brands_agency_write on brands for all
  using (is_agency_member(agency_id))
  with check (is_agency_member(agency_id));

-- brand_members
create policy brand_members_select on brand_members for select using (
  is_brand_member(brand_id)
  or exists (select 1 from brands b where b.id = brand_id and is_agency_member(b.agency_id))
);

-- influencers
create policy influencers_self_select on influencers for select using (profile_id = auth.uid());
create policy influencers_self_update on influencers for update using (profile_id = auth.uid());
create policy influencers_roster_select on influencers for select using (
  exists (
    select 1 from agency_influencer_roster r
    where r.influencer_id = influencers.id and is_agency_member(r.agency_id)
  )
);

-- roster
create policy roster_agency_all on agency_influencer_roster for all
  using (is_agency_member(agency_id))
  with check (is_agency_member(agency_id));

-- campaigns
create policy campaigns_agency_all on campaigns for all
  using (is_agency_member(agency_id))
  with check (is_agency_member(agency_id));
create policy campaigns_brand_select on campaigns for select using (is_brand_member(brand_id));
create policy campaigns_influencer_select on campaigns for select using (
  exists (
    select 1 from campaign_invitations ci
    where ci.campaign_id = campaigns.id and is_influencer(ci.influencer_id)
  )
);

-- invitations
create policy invitations_agency_all on campaign_invitations for all using (
  exists (select 1 from campaigns c where c.id = campaign_id and is_agency_member(c.agency_id))
) with check (
  exists (select 1 from campaigns c where c.id = campaign_id and is_agency_member(c.agency_id))
);
create policy invitations_influencer_select on campaign_invitations for select
  using (is_influencer(influencer_id));
create policy invitations_influencer_update on campaign_invitations for update
  using (is_influencer(influencer_id));

-- contracts
create policy contracts_agency_all on contracts for all using (
  exists (select 1 from campaigns c where c.id = campaign_id and is_agency_member(c.agency_id))
);
create policy contracts_brand_select on contracts for select using (
  exists (select 1 from campaigns c where c.id = campaign_id and is_brand_member(c.brand_id))
);
create policy contracts_influencer_select on contracts for select using (is_influencer(influencer_id));
create policy contracts_influencer_update on contracts for update using (is_influencer(influencer_id));

-- deliverables
create policy deliverables_select on deliverables for select using (
  exists (
    select 1 from contracts ct join campaigns c on c.id = ct.campaign_id
    where ct.id = contract_id and (
      is_agency_member(c.agency_id) or is_brand_member(c.brand_id) or is_influencer(ct.influencer_id)
    )
  )
);
create policy deliverables_agency_write on deliverables for all using (
  exists (
    select 1 from contracts ct join campaigns c on c.id = ct.campaign_id
    where ct.id = contract_id and is_agency_member(c.agency_id)
  )
);

-- submissions
create policy submissions_select on deliverable_submissions for select using (
  exists (
    select 1 from deliverables d
      join contracts ct on ct.id = d.contract_id
      join campaigns c on c.id = ct.campaign_id
    where d.id = deliverable_id and (
      is_agency_member(c.agency_id) or is_brand_member(c.brand_id) or is_influencer(ct.influencer_id)
    )
  )
);
create policy submissions_influencer_insert on deliverable_submissions for insert with check (
  exists (
    select 1 from deliverables d join contracts ct on ct.id = d.contract_id
    where d.id = deliverable_id and is_influencer(ct.influencer_id)
  )
);

-- payouts
create policy payouts_select on payouts for select using (
  exists (
    select 1 from contracts ct join campaigns c on c.id = ct.campaign_id
    where ct.id = contract_id and (
      is_agency_member(c.agency_id) or is_brand_member(c.brand_id) or is_influencer(ct.influencer_id)
    )
  )
);
create policy payouts_agency_write on payouts for all using (
  exists (
    select 1 from contracts ct join campaigns c on c.id = ct.campaign_id
    where ct.id = contract_id and is_agency_member(c.agency_id)
  )
);

-- audit_log (read-only from app; visible to actor + agency members of related entity)
create policy audit_log_actor_select on audit_log for select using (actor_profile_id = auth.uid());
