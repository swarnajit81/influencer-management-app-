-- Sprint 5: per-member last_inbox_seen_at for /agency/inbox unread state.
-- Default epoch so any pre-existing event counts as unread on first login.

alter table agency_members
  add column last_inbox_seen_at timestamptz not null default 'epoch';
