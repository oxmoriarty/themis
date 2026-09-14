-- Themis core off-chain data model. Contract code and UI are intentionally out of scope.
create extension if not exists pgcrypto;

create type public.service_availability as enum ('ACTIVE', 'PAUSED', 'INACTIVE');
create type public.service_source as enum ('REAL', 'SEED');
create type public.matter_state as enum (
  'DRAFT', 'SERVICE_REQUESTED', 'ACCEPTED', 'EVIDENCE_OPEN', 'IN_PROGRESS',
  'COMPLETION_PENDING', 'COMPLETED', 'DISPUTED', 'UNDER_REVIEW',
  'DECIDED_PENDING_FINALITY', 'FINALIZED', 'CANCELLED'
);
create type public.matter_member_role as enum ('CLIENT', 'PROVIDER');
create type public.chain_transaction_status as enum (
  'PENDING', 'CANCELED', 'PROPOSING', 'COMMITTING', 'REVEALING',
  'ACCEPTED', 'FINALIZED', 'UNDETERMINED'
);
create type public.chain_execution_result as enum (
  'FINISHED_WITH_RETURN', 'FINISHED_WITH_ERROR', 'NOT_VOTED'
);

create table public.wallet_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  address text not null check (address ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create unique index wallet_identities_address_key on public.wallet_identities (lower(address));

create table public.auth_challenges (
  id uuid primary key default gen_random_uuid(),
  wallet_address text not null check (wallet_address ~ '^0x[0-9a-f]{40}$'),
  nonce text not null unique,
  domain text not null,
  statement text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.agent_api_tokens (
  id uuid primary key default gen_random_uuid(),
  wallet_identity_id uuid not null references public.wallet_identities(id) on delete cascade,
  token_prefix text not null check (char_length(token_prefix) between 6 and 16),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null default '{}',
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  onchain_service_id text unique,
  owner_wallet_id uuid not null references public.wallet_identities(id),
  name text not null check (char_length(name) between 2 and 120),
  description text not null check (char_length(description) between 1 and 4000),
  services text[] not null check (cardinality(services) between 1 and 12),
  specialties text[] not null default '{}',
  jurisdictions text[] not null default '{}',
  metadata_uri text,
  metadata_hash text check (metadata_hash is null or metadata_hash ~ '^[0-9a-f]{64}$'),
  availability public.service_availability not null default 'ACTIVE',
  source public.service_source not null default 'REAL',
  completed_matter_count integer not null default 0 check (completed_matter_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matters (
  id uuid primary key default gen_random_uuid(),
  onchain_matter_id text,
  contract_address text check (contract_address is null or contract_address ~ '^0x[0-9a-f]{40}$'),
  title text not null check (char_length(title) between 1 and 160),
  private_description text not null check (char_length(private_description) between 1 and 8000),
  client_wallet_id uuid not null references public.wallet_identities(id),
  provider_wallet_id uuid not null references public.wallet_identities(id),
  service_id uuid not null references public.services(id),
  state public.matter_state not null default 'DRAFT',
  agreement_original_sha256 text check (agreement_original_sha256 is null or agreement_original_sha256 ~ '^[0-9a-f]{64}$'),
  consensus_template_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (client_wallet_id <> provider_wallet_id),
  check ((onchain_matter_id is null) = (contract_address is null))
);
create unique index matters_contract_onchain_matter_key
  on public.matters (lower(contract_address), onchain_matter_id)
  where contract_address is not null;

create table public.matter_members (
  matter_id uuid not null references public.matters(id) on delete cascade,
  wallet_identity_id uuid not null references public.wallet_identities(id) on delete cascade,
  role public.matter_member_role not null,
  joined_at timestamptz not null default now(),
  primary key (matter_id, wallet_identity_id),
  unique (matter_id, role)
);

create table public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  storage_object_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in (
    'text/plain', 'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  )),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by_wallet_id uuid not null references public.wallet_identities(id),
  uploaded_at timestamptz not null default now(),
  extracted_text_sha256 text check (extracted_text_sha256 is null or extracted_text_sha256 ~ '^[0-9a-f]{64}$')
);

create table public.evidence_extractions (
  id uuid primary key default gen_random_uuid(),
  evidence_file_id uuid not null references public.evidence_files(id) on delete cascade,
  extractor_name text not null,
  extractor_version text not null,
  extracted_text text not null,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (evidence_file_id, extractor_name, extractor_version)
);

create table public.consensus_evidence_entries (
  id uuid primary key default gen_random_uuid(),
  matter_id uuid not null references public.matters(id) on delete cascade,
  entry_index integer not null check (entry_index >= 0),
  public_text text not null check (char_length(public_text) between 1 and 12000),
  text_sha256 text not null check (text_sha256 ~ '^[0-9a-f]{64}$'),
  submitted_by_wallet_id uuid not null references public.wallet_identities(id),
  promotion_acknowledged_at timestamptz not null,
  onchain_transaction_hash text check (onchain_transaction_hash is null or onchain_transaction_hash ~ '^0x[0-9a-f]{64}$'),
  unique (matter_id, entry_index)
);

create table public.chain_transactions (
  transaction_hash text primary key check (transaction_hash ~ '^0x[0-9a-f]{64}$'),
  action text not null check (char_length(action) between 1 and 64),
  contract_address text check (contract_address is null or contract_address ~ '^0x[0-9a-f]{40}$'),
  matter_id uuid references public.matters(id) on delete set null,
  status public.chain_transaction_status not null,
  execution_result public.chain_execution_result,
  receipt jsonb,
  submitted_at timestamptz not null default now(),
  observed_at timestamptz not null default now()
);

create table public.reputation_snapshots (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  completed_engagements integer not null check (completed_engagements >= 0),
  finalized_adjudications integer not null check (finalized_adjudications >= 0),
  upheld_disputes integer not null check (upheld_disputes >= 0),
  source_transaction_hashes text[] not null default '{}',
  finalized_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_wallet_id uuid references public.wallet_identities(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  correlation_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger services_set_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger matters_set_updated_at before update on public.matters
for each row execute function public.set_updated_at();

-- SECURITY DEFINER avoids recursive RLS evaluation. It receives no caller input
-- beyond the matter ID and is not executable by anonymous roles.
create function public.current_wallet_identity_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.wallet_identities where user_id = auth.uid() limit 1;
$$;

create function public.is_matter_member(target_matter_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.matter_members
    where matter_id = target_matter_id
      and wallet_identity_id = public.current_wallet_identity_id()
  );
$$;

revoke all on function public.current_wallet_identity_id() from public;
revoke all on function public.is_matter_member(uuid) from public;
grant execute on function public.current_wallet_identity_id() to authenticated;
grant execute on function public.is_matter_member(uuid) to authenticated;

alter table public.wallet_identities enable row level security;
alter table public.auth_challenges enable row level security;
alter table public.agent_api_tokens enable row level security;
alter table public.services enable row level security;
alter table public.matters enable row level security;
alter table public.matter_members enable row level security;
alter table public.evidence_files enable row level security;
alter table public.evidence_extractions enable row level security;
alter table public.consensus_evidence_entries enable row level security;
alter table public.chain_transactions enable row level security;
alter table public.reputation_snapshots enable row level security;
alter table public.audit_events enable row level security;

-- All mutation is routed through validated server handlers using the service role.
-- Browser/database clients receive only the read policies below.
create policy "wallet owner can read identity"
on public.wallet_identities for select to authenticated
using (id = public.current_wallet_identity_id());

create policy "active services are publicly discoverable"
on public.services for select
using (availability = 'ACTIVE');

create policy "matter members can read their matters"
on public.matters for select to authenticated
using (public.is_matter_member(id));

create policy "matter members can read membership"
on public.matter_members for select to authenticated
using (public.is_matter_member(matter_id));

create policy "matter members can read evidence metadata"
on public.evidence_files for select to authenticated
using (public.is_matter_member(matter_id));

create policy "matter members can read evidence extractions"
on public.evidence_extractions for select to authenticated
using (exists (
  select 1 from public.evidence_files
  where evidence_files.id = evidence_extractions.evidence_file_id
    and public.is_matter_member(evidence_files.matter_id)
));

create policy "matter members can read promoted evidence"
on public.consensus_evidence_entries for select to authenticated
using (public.is_matter_member(matter_id));

create policy "matter members can read their transaction index"
on public.chain_transactions for select to authenticated
using (matter_id is not null and public.is_matter_member(matter_id));

create policy "public reputation snapshots are readable"
on public.reputation_snapshots for select
using (true);

-- Original evidence objects are private and are accessed only through validated
-- server handlers. No storage.objects policy is created for browser access.
insert into storage.buckets (id, name, public)
values ('evidence-private', 'evidence-private', false)
on conflict (id) do update set public = false;

