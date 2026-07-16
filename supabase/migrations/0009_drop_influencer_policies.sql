-- Follow-up to 0008: drop policies + helpers left behind that reference the
-- removed campaign_invitations table. is_invited_influencer() blows up on
-- any SELECT against campaigns because RLS calls it eagerly.

drop policy if exists campaigns_influencer_select on campaigns;
drop function if exists is_invited_influencer(uuid);
drop function if exists is_influencer(uuid);
