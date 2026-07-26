-- Fresh-project bootstrap for a new Supabase instance.
-- Run this once in the Supabase SQL editor before the incremental migrations.
-- Scope: auth-critical and dashboard-critical core tables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text not null,
  role text not null check (role in ('student', 'teacher', 'admin')),
  is_test_account boolean not null default false,
  exclude_from_writing_behavior boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8)),
  description text,
  semester text,
  is_published boolean not null default true,
  archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.class_members (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'approved' check (status in ('pending', 'approved')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (class_id, student_id)
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null,
  description text,
  due_date timestamptz,
  status text not null default 'draft',
  rubric jsonb not null default '{}'::jsonb,
  language_level text,
  assignment_type_id uuid,
  auto_outline_from_chat boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'not_started',
  draft_text text,
  final_text text,
  writing_events jsonb not null default '[]'::jsonb,
  keystroke_log jsonb not null default '[]'::jsonb,
  reflections jsonb not null default '{}'::jsonb,
  self_assessment jsonb not null default '{}'::jsonb,
  outline jsonb not null default '{}'::jsonb,
  teacher_review jsonb not null default '{}'::jsonb,
  feedback_history jsonb not null default '[]'::jsonb,
  submission_snapshot jsonb not null default '{}'::jsonb,
  fluency_summary jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (assignment_id, student_id)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_assignments_updated_at on public.assignments;
create trigger set_assignments_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

drop trigger if exists set_submissions_updated_at on public.submissions;
create trigger set_submissions_updated_at
before update on public.submissions
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.class_members enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Teachers can select own classes" on public.classes;
create policy "Teachers can select own classes"
on public.classes
for select
to authenticated
using (teacher_id = auth.uid());

drop policy if exists "Teachers can insert classes" on public.classes;
create policy "Teachers can insert classes"
on public.classes
for insert
to authenticated
with check (teacher_id = auth.uid());

drop policy if exists "Teachers can update own classes" on public.classes;
create policy "Teachers can update own classes"
on public.classes
for update
to authenticated
using (teacher_id = auth.uid())
with check (teacher_id = auth.uid());

drop policy if exists "Teachers can delete own classes" on public.classes;
create policy "Teachers can delete own classes"
on public.classes
for delete
to authenticated
using (teacher_id = auth.uid());

drop policy if exists "Students can view own memberships" on public.class_members;
create policy "Students can view own memberships"
on public.class_members
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own memberships" on public.class_members;
create policy "Students can insert own memberships"
on public.class_members
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Teachers can select class members" on public.class_members;
create policy "Teachers can select class members"
on public.class_members
for select
to authenticated
using (
  exists (
    select 1
    from public.classes
    where classes.id = class_members.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can insert class members" on public.class_members;
create policy "Teachers can insert class members"
on public.class_members
for insert
to authenticated
with check (
  exists (
    select 1
    from public.classes
    where classes.id = class_members.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can delete class members" on public.class_members;
create policy "Teachers can delete class members"
on public.class_members
for delete
to authenticated
using (
  exists (
    select 1
    from public.classes
    where classes.id = class_members.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Students can view published assignments in their classes" on public.assignments;
create policy "Students can view published assignments in their classes"
on public.assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.class_members
    where class_members.class_id = assignments.class_id
      and class_members.student_id = auth.uid()
      and class_members.status = 'approved'
  )
);

drop policy if exists "Teachers can manage own assignments" on public.assignments;
create policy "Teachers can manage own assignments"
on public.assignments
for all
to authenticated
using (
  exists (
    select 1
    from public.classes
    where classes.id = assignments.class_id
      and classes.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.classes
    where classes.id = assignments.class_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Students can view own submissions" on public.submissions;
create policy "Students can view own submissions"
on public.submissions
for select
to authenticated
using (student_id = auth.uid());

drop policy if exists "Students can insert own submissions" on public.submissions;
create policy "Students can insert own submissions"
on public.submissions
for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Students can update own submissions" on public.submissions;
create policy "Students can update own submissions"
on public.submissions
for update
to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

drop policy if exists "Teachers can view submissions in their assignments" on public.submissions;
create policy "Teachers can view submissions in their assignments"
on public.submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.assignments
    join public.classes on classes.id = assignments.class_id
    where assignments.id = submissions.assignment_id
      and classes.teacher_id = auth.uid()
  )
);

drop policy if exists "Teachers can update submissions in their assignments" on public.submissions;
create policy "Teachers can update submissions in their assignments"
on public.submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.assignments
    join public.classes on classes.id = assignments.class_id
    where assignments.id = submissions.assignment_id
      and classes.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.assignments
    join public.classes on classes.id = assignments.class_id
    where assignments.id = submissions.assignment_id
      and classes.teacher_id = auth.uid()
  )
);

grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.classes to authenticated;
grant select, insert, update, delete on public.class_members to authenticated;
grant select, insert, update, delete on public.assignments to authenticated;
grant select, insert, update, delete on public.submissions to authenticated;
