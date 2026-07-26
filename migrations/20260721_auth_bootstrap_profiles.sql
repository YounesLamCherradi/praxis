-- Bootstrap auth/profile schema for a fresh Supabase project.
-- Scope: login/signup only.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) > 0),
  role text not null check (role in ('student', 'teacher', 'admin')),
  created_at timestamptz not null default now(),
  is_test_account boolean not null default false,
  exclude_from_writing_behavior boolean not null default false
);

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_created_at_idx on public.profiles(created_at desc);

alter table public.profiles enable row level security;

grant select, insert, update, delete on table public.profiles to service_role;
grant select, update on table public.profiles to authenticated;
revoke all on table public.profiles from anon;

-- Users can read only their own profile.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- Users can update only their own name (and only to non-empty values).
drop policy if exists profiles_update_own_name on public.profiles;
create policy profiles_update_own_name
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and char_length(trim(name)) > 0
    and role in ('student', 'teacher', 'admin')
  );

-- Optional: service role bypasses RLS automatically, so backend can insert profiles.
