-- =====================================================
-- 0003_contract_digio_fields.sql
-- Per-party signing URL + expiry from Digio sign request.
-- digio_document_id already exists on contracts.
-- =====================================================

alter table contracts
  add column if not exists influencer_signing_url text,
  add column if not exists brand_signing_url text,
  add column if not exists signing_expires_at timestamptz,
  add column if not exists declined_at timestamptz,
  add column if not exists declined_reason text;

create index if not exists contracts_digio_doc_idx on contracts (digio_document_id);
create index if not exists contracts_invitation_idx on contracts (invitation_id);
