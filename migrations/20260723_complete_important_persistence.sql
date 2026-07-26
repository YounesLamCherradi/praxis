begin;

-- Reusable teacher rubrics.
create table if not exists public.rubric_library (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  rubric_schema jsonb not null default '{}'::jsonb,
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Crash-safe assignment-builder state. The published/draft assignment itself
-- remains in public.assignments; this table stores incomplete wizard input
-- before enough fields exist to create an assignment row.
create table if not exists public.assignment_builder_drafts (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  draft_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

-- Durable teacher message records and drafts.
create table if not exists public.course_messages (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  recipient_mode text not null check (recipient_mode in ('all', 'individual')),
  recipient_student_id uuid references public.profiles(id) on delete set null,
  recipient_emails jsonb not null default '[]'::jsonb,
  subject text not null default '',
  body text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'partially_sent', 'failed')),
  delivered_count integer not null default 0 check (delivered_count >= 0),
  failed_count integer not null default 0 check (failed_count >= 0),
  provider_request_id text,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists rubric_library_owner_updated_idx
  on public.rubric_library(owner_id, updated_at desc);
create index if not exists course_messages_teacher_created_idx
  on public.course_messages(teacher_id, created_at desc);
-- PostgreSQL permits multiple NULL values in a unique index. Keeping this
-- non-partial lets PostgREST infer the conflict target used by API upserts.
drop index if exists public.course_messages_provider_request_unique;
create unique index course_messages_provider_request_unique
  on public.course_messages(teacher_id, provider_request_id);

alter table public.rubric_library enable row level security;
alter table public.assignment_builder_drafts enable row level security;
alter table public.course_messages enable row level security;

drop policy if exists rubric_library_owner_all on public.rubric_library;
create policy rubric_library_owner_all on public.rubric_library
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists assignment_builder_drafts_owner_all on public.assignment_builder_drafts;
create policy assignment_builder_drafts_owner_all on public.assignment_builder_drafts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists course_messages_teacher_all on public.course_messages;
create policy course_messages_teacher_all on public.course_messages
  for all to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid()
    and exists (
      select 1 from public.classes
      where classes.id = course_messages.class_id
        and classes.teacher_id = auth.uid()
    )
  );

grant select, insert, update, delete
  on public.rubric_library, public.assignment_builder_drafts, public.course_messages
  to authenticated, service_role;

commit;
