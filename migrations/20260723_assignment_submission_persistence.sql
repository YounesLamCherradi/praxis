-- Durable assignment/submission persistence foundation.
-- Applied to the production Supabase project on 2026-07-23.

begin;

alter table public.assignments
  add column if not exists prompt text,
  add column if not exists brief text,
  add column if not exists focus text,
  add column if not exists assignment_type text,
  add column if not exists word_count_min integer,
  add column if not exists word_count_max integer,
  add column if not exists idea_request_limit integer not null default 0,
  add column if not exists feedback_request_limit integer not null default 0,
  add column if not exists chat_time_limit integer not null default 0,
  add column if not exists student_focus jsonb not null default '{}'::jsonb,
  add column if not exists deadline timestamptz,
  add column if not exists uploaded_rubric_text text,
  add column if not exists published_at timestamptz,
  add column if not exists version bigint not null default 1,
  add column if not exists deleted_at timestamptz;

update public.assignments set deadline = due_date
where deadline is null and due_date is not null;

alter table public.assignments
  drop constraint if exists assignments_word_count_check,
  add constraint assignments_word_count_check check (
    word_count_min is null or word_count_max is null or word_count_min <= word_count_max
  ),
  drop constraint if exists assignments_request_limits_check,
  add constraint assignments_request_limits_check check (
    idea_request_limit >= 0 and feedback_request_limit >= 0 and chat_time_limit >= 0
  );

create index if not exists assignments_class_status_idx
  on public.assignments (class_id, status) where deleted_at is null;
create index if not exists assignments_class_updated_idx
  on public.assignments (class_id, updated_at desc) where deleted_at is null;

alter table public.submissions
  add column if not exists idea_responses jsonb not null default '[]'::jsonb,
  add column if not exists chat_history jsonb not null default '[]'::jsonb,
  add column if not exists focus_annotations jsonb not null default '[]'::jsonb,
  add column if not exists chat_started_at timestamptz,
  add column if not exists chat_skipped_at timestamptz,
  add column if not exists chat_expired_at timestamptz,
  add column if not exists chat_elapsed_ms integer not null default 0,
  add column if not exists started_at timestamptz,
  add column if not exists final_unlocked boolean not null default false,
  add column if not exists version bigint not null default 1,
  add column if not exists deleted_at timestamptz;

alter table public.submissions alter column status set default 'draft';
alter table public.submissions
  drop constraint if exists submissions_chat_elapsed_check,
  add constraint submissions_chat_elapsed_check check (chat_elapsed_ms >= 0);

create index if not exists submissions_assignment_idx
  on public.submissions (assignment_id) where deleted_at is null;
create index if not exists submissions_student_idx
  on public.submissions (student_id) where deleted_at is null;
create index if not exists submissions_assignment_status_idx
  on public.submissions (assignment_id, status) where deleted_at is null;

-- Table privileges and RLS are separate in Postgres. The authenticated role
-- still needs these grants before the policies can authorize individual rows;
-- the backend service role needs them for verified server-side operations.
grant select, insert, update, delete on public.assignments
  to authenticated, service_role;
grant select, insert, update, delete on public.submissions
  to authenticated, service_role;

create table if not exists public.assignment_revisions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete restrict,
  revision_number bigint not null,
  snapshot jsonb not null,
  change_type text not null default 'autosave',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, revision_number)
);
create index if not exists assignment_revisions_lookup_idx
  on public.assignment_revisions (assignment_id, revision_number desc);

create table if not exists public.submission_revisions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete restrict,
  revision_number bigint not null,
  snapshot jsonb not null,
  change_type text not null default 'autosave',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (submission_id, revision_number)
);
create index if not exists submission_revisions_lookup_idx
  on public.submission_revisions (submission_id, revision_number desc);

create table if not exists public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  idempotency_key text not null unique,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'delivered', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists notification_outbox_pending_idx
  on public.notification_outbox (status, available_at)
  where status in ('pending', 'failed');

create table if not exists public.api_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text,
  resource_type text,
  resource_id uuid,
  response_status integer,
  response_body jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null default (timezone('utc', now()) + interval '7 days'),
  unique (user_id, operation, idempotency_key)
);
create index if not exists api_idempotency_expiry_idx
  on public.api_idempotency_keys (expires_at);

alter table public.assignment_revisions enable row level security;
alter table public.submission_revisions enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.api_idempotency_keys enable row level security;

revoke all on public.assignment_revisions from anon, authenticated;
revoke all on public.submission_revisions from anon, authenticated;
revoke all on public.notification_outbox from anon, authenticated;
revoke all on public.api_idempotency_keys from anon, authenticated;
grant select, insert, update, delete on public.assignment_revisions to service_role;
grant select, insert, update, delete on public.submission_revisions to service_role;
grant select, insert, update, delete on public.notification_outbox to service_role;
grant select, insert, update, delete on public.api_idempotency_keys to service_role;

commit;
