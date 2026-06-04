-- =====================================================
-- 0002_auth_trigger.sql
-- Bootstrap profile + role-specific row whenever a new
-- auth.users entry is created.
--
-- The trigger reads `raw_user_meta_data` set during
-- signInWithOtp({ data: { full_name, role, agency_name? } }).
-- =====================================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _role        user_role;
  _full_name   text;
  _agency_name text;
  _agency_slug text;
  _agency_id   uuid;
begin
  -- Default role to influencer if not set (e.g. social-login flows).
  _role := coalesce((new.raw_user_meta_data->>'role')::user_role, 'influencer');
  _full_name := coalesce(
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1)
  );

  insert into profiles (id, full_name, email, primary_role)
  values (new.id, _full_name, new.email, _role);

  if _role = 'agency_member' then
    _agency_name := coalesce(
      new.raw_user_meta_data->>'agency_name',
      _full_name || '''s agency'
    );
    _agency_slug := lower(
      regexp_replace(_agency_name, '[^a-zA-Z0-9]+', '-', 'g')
    ) || '-' || substr(new.id::text, 1, 6);

    insert into agencies (name, slug)
    values (_agency_name, _agency_slug)
    returning id into _agency_id;

    insert into agency_members (agency_id, profile_id, role)
    values (_agency_id, new.id, 'owner');

  elsif _role = 'influencer' then
    insert into influencers (profile_id, display_name)
    values (new.id, _full_name);

  end if;
  -- brand_member rows are created on invitation, not on self-signup.

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
