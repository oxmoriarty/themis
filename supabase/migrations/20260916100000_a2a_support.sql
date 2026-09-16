-- A2A agent-card pointers are public, developer-published metadata. Themis
-- does not fetch these URLs from the server or send credentials to them.
alter table public.services
  add column a2a_agent_card_url text;

alter table public.services
  add constraint services_a2a_agent_card_url_shape check (
    a2a_agent_card_url is null or a2a_agent_card_url ~ '^https://'
  );

-- A2A task records are private to the authenticated A2A caller. The service
-- role accesses them only after server-side Supabase Auth verification.
create table public.a2a_tasks (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null,
  context_id uuid,
  status text not null check (status in (
    'TASK_STATE_SUBMITTED', 'TASK_STATE_WORKING', 'TASK_STATE_COMPLETED',
    'TASK_STATE_FAILED', 'TASK_STATE_CANCELED', 'TASK_STATE_REJECTED',
    'TASK_STATE_INPUT_REQUIRED', 'TASK_STATE_AUTH_REQUIRED'
  )),
  task jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_id)
);

create index a2a_tasks_user_updated_at_idx on public.a2a_tasks (user_id, updated_at desc);
create index a2a_tasks_user_context_updated_at_idx on public.a2a_tasks (user_id, context_id, updated_at desc);

create trigger a2a_tasks_set_updated_at before update on public.a2a_tasks
for each row execute function public.set_updated_at();

alter table public.a2a_tasks enable row level security;
-- No browser policy is granted: task history can contain caller-authored
-- private draft data and is exposed only by the authorized A2A server route.
