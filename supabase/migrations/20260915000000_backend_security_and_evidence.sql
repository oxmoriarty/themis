-- Backend security hardening for the Themis Supabase Free-tier deployment.
-- Browser clients have read-only, least-privilege access; all writes and every
-- private Storage operation are performed by validated server routes.

alter table public.auth_challenges
  add column auth_user_id uuid references auth.users(id) on delete cascade,
  add column issued_at timestamptz not null default now(),
  add column signature_sha256 text check (signature_sha256 is null or signature_sha256 ~ '^[0-9a-f]{64}$');

-- Existing challenge rows predate the authenticated API and cannot prove a
-- relationship to an auth user. They are deliberately unusable for verification.
update public.auth_challenges
set consumed_at = coalesce(consumed_at, now())
where auth_user_id is null;

alter table public.auth_challenges
  alter column auth_user_id set not null;

alter table public.evidence_files
  add column detected_mime_type text check (detected_mime_type in (
    'text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  )),
  add column processing_status text not null default 'PENDING_REVIEW'
    check (processing_status in ('PENDING_REVIEW', 'REJECTED', 'READY')),
  add column provenance jsonb not null default '{}'::jsonb,
  add constraint evidence_files_free_tier_size_cap check (byte_size <= 5242880);

update public.evidence_files
set detected_mime_type = mime_type
where detected_mime_type is null;

alter table public.evidence_files
  alter column detected_mime_type set not null;

alter table public.consensus_evidence_entries
  add column idempotency_key uuid;

create unique index consensus_evidence_entries_idempotency_key
  on public.consensus_evidence_entries (matter_id, submitted_by_wallet_id, idempotency_key)
  where idempotency_key is not null;

create index auth_challenges_active_lookup
  on public.auth_challenges (auth_user_id, wallet_address, expires_at)
  where consumed_at is null;
create index matter_members_wallet_lookup
  on public.matter_members (wallet_identity_id, matter_id);
create index evidence_files_matter_uploaded_at
  on public.evidence_files (matter_id, uploaded_at desc);
create index consensus_evidence_entries_matter_entry_index
  on public.consensus_evidence_entries (matter_id, entry_index);

-- These helpers are intentionally service-role only. Server routes authenticate
-- the caller, look up matter membership, and then make the atomic transition.
create function public.consume_wallet_challenge(
  p_challenge_id uuid,
  p_auth_user_id uuid,
  p_wallet_address text,
  p_signature_sha256 text
)
returns public.auth_challenges
language plpgsql
security definer
set search_path = public
as $$
declare
  consumed public.auth_challenges;
begin
  update public.auth_challenges
  set consumed_at = now(), signature_sha256 = p_signature_sha256
  where id = p_challenge_id
    and auth_user_id = p_auth_user_id
    and wallet_address = lower(p_wallet_address)
    and consumed_at is null
    and expires_at > now()
  returning * into consumed;

  if consumed.id is null then
    raise exception 'challenge is expired, consumed, or does not belong to this user'
      using errcode = 'P0001';
  end if;

  return consumed;
end;
$$;

create function public.create_consensus_evidence_entry(
  p_matter_id uuid,
  p_public_text text,
  p_text_sha256 text,
  p_wallet_identity_id uuid,
  p_idempotency_key uuid
)
returns public.consensus_evidence_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_entry public.consensus_evidence_entries;
  created_entry public.consensus_evidence_entries;
  next_entry_index integer;
begin
  select * into existing_entry
  from public.consensus_evidence_entries
  where matter_id = p_matter_id
    and submitted_by_wallet_id = p_wallet_identity_id
    and idempotency_key = p_idempotency_key;

  if existing_entry.id is not null then
    return existing_entry;
  end if;

  -- Serialize numbering and the twelve-entry bound per matter.
  perform 1 from public.matters where id = p_matter_id for update;
  if not found then
    raise exception 'matter does not exist' using errcode = 'P0001';
  end if;

  select coalesce(max(entry_index) + 1, 0) into next_entry_index
  from public.consensus_evidence_entries
  where matter_id = p_matter_id;

  if next_entry_index >= 12 then
    raise exception 'consensus evidence entry limit reached' using errcode = 'P0001';
  end if;

  insert into public.consensus_evidence_entries (
    matter_id, entry_index, public_text, text_sha256,
    submitted_by_wallet_id, promotion_acknowledged_at, idempotency_key
  ) values (
    p_matter_id, next_entry_index, p_public_text, p_text_sha256,
    p_wallet_identity_id, now(), p_idempotency_key
  ) returning * into created_entry;

  return created_entry;
end;
$$;

create function public.create_matter_draft(
  p_client_wallet_identity_id uuid,
  p_provider_wallet_address text,
  p_service_id uuid,
  p_title text,
  p_private_description text
)
returns public.matters
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_identity_id uuid;
  created_matter public.matters;
begin
  select id into provider_identity_id
  from public.wallet_identities
  where address = lower(p_provider_wallet_address);

  if provider_identity_id is null or provider_identity_id = p_client_wallet_identity_id then
    raise exception 'provider wallet is invalid' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.services
    where id = p_service_id
      and owner_wallet_id = provider_identity_id
      and availability = 'ACTIVE'
      and source = 'REAL'
  ) then
    raise exception 'service is not an active real service owned by the provider' using errcode = 'P0001';
  end if;

  insert into public.matters (
    title, private_description, client_wallet_id, provider_wallet_id, service_id
  ) values (
    p_title, p_private_description, p_client_wallet_identity_id, provider_identity_id, p_service_id
  ) returning * into created_matter;

  insert into public.matter_members (matter_id, wallet_identity_id, role) values
    (created_matter.id, p_client_wallet_identity_id, 'CLIENT'),
    (created_matter.id, provider_identity_id, 'PROVIDER');

  return created_matter;
end;
$$;

revoke all on function public.consume_wallet_challenge(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_consensus_evidence_entry(uuid, text, text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.create_matter_draft(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_wallet_challenge(uuid, uuid, text, text) to service_role;
grant execute on function public.create_consensus_evidence_entry(uuid, text, text, uuid, uuid) to service_role;
grant execute on function public.create_matter_draft(uuid, text, uuid, text, text) to service_role;

-- RLS is only one half of the control. Explicit grants ensure that adding a
-- policy never leaves a default browser write grant in place.
revoke all on table
  public.wallet_identities,
  public.auth_challenges,
  public.agent_api_tokens,
  public.services,
  public.matters,
  public.matter_members,
  public.evidence_files,
  public.evidence_extractions,
  public.consensus_evidence_entries,
  public.chain_transactions,
  public.reputation_snapshots,
  public.audit_events
from anon, authenticated;

grant select on table public.services, public.reputation_snapshots to anon, authenticated;
grant select on table
  public.wallet_identities,
  public.matters,
  public.matter_members,
  public.evidence_files,
  public.evidence_extractions,
  public.consensus_evidence_entries,
  public.chain_transactions
to authenticated;

-- Storage has no direct browser path. Signed URLs are issued only by server
-- code after the same membership check used for metadata. Service role bypasses
-- RLS and therefore is never shipped to the browser.
revoke all on table storage.objects from anon, authenticated;

alter table public.wallet_identities force row level security;
alter table public.auth_challenges force row level security;
alter table public.agent_api_tokens force row level security;
alter table public.services force row level security;
alter table public.matters force row level security;
alter table public.matter_members force row level security;
alter table public.evidence_files force row level security;
alter table public.evidence_extractions force row level security;
alter table public.consensus_evidence_entries force row level security;
alter table public.chain_transactions force row level security;
alter table public.reputation_snapshots force row level security;
alter table public.audit_events force row level security;
