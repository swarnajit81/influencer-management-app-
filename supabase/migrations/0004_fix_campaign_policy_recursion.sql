-- campaigns_influencer_select queried campaign_invitations inline, and
-- invitations_agency_all queries campaigns back — Postgres aborts with
-- "infinite recursion detected in policy for relation campaigns".
-- A security definer helper (like is_agency_member & co.) evaluates the
-- invitation lookup without re-entering RLS, breaking the cycle.

create or replace function is_invited_influencer(_campaign_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from campaign_invitations ci
    join influencers i on i.id = ci.influencer_id
    where ci.campaign_id = _campaign_id
      and i.profile_id = auth.uid()
  );
$$;

drop policy if exists campaigns_influencer_select on campaigns;
create policy campaigns_influencer_select on campaigns
  for select using (is_invited_influencer(id));
