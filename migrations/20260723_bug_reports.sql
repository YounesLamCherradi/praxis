begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'bug-report-attachments',
  'bug-report-attachments',
  false,
  3145728,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.current_user_is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create table if not exists public.bug_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_role text not null check (reporter_role in ('student', 'teacher', 'admin')),
  reporter_name text not null,
  reporter_email text,
  description text not null check (char_length(btrim(description)) between 10 and 5000),
  attachment_path text,
  attachment_name text,
  attachment_mime_type text
    check (attachment_mime_type is null or attachment_mime_type in ('image/png', 'image/jpeg', 'image/webp')),
  attachment_size integer
    check (attachment_size is null or attachment_size between 1 and 3145728),
  route text,
  context jsonb not null default '{}'::jsonb,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Keep the migration safe to rerun if an earlier draft of bug_reports exists.
alter table public.bug_reports
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size integer;

create index if not exists bug_reports_status_created_idx
  on public.bug_reports (status, created_at desc);
create index if not exists bug_reports_reporter_idx
  on public.bug_reports (reporter_id, created_at desc);

drop trigger if exists set_bug_reports_updated_at on public.bug_reports;
create trigger set_bug_reports_updated_at
before update on public.bug_reports
for each row execute function public.set_updated_at();

alter table public.bug_reports enable row level security;

drop policy if exists bug_reports_insert_own on public.bug_reports;
create policy bug_reports_insert_own on public.bug_reports
for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists bug_reports_select_own_or_admin on public.bug_reports;
create policy bug_reports_select_own_or_admin on public.bug_reports
for select to authenticated
using (reporter_id = auth.uid() or public.current_user_is_admin());

drop policy if exists bug_reports_admin_update on public.bug_reports;
create policy bug_reports_admin_update on public.bug_reports
for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

grant select, insert, update on public.bug_reports
  to authenticated, service_role;

commit;
