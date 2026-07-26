begin;

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

create index if not exists rubric_library_owner_updated_idx
  on public.rubric_library (owner_id, updated_at desc);

drop trigger if exists set_rubric_library_updated_at on public.rubric_library;
create trigger set_rubric_library_updated_at
before update on public.rubric_library
for each row execute function public.set_updated_at();

alter table public.rubric_library enable row level security;

drop policy if exists rubric_library_owner_select on public.rubric_library;
create policy rubric_library_owner_select on public.rubric_library
for select to authenticated using (owner_id = auth.uid());

drop policy if exists rubric_library_owner_insert on public.rubric_library;
create policy rubric_library_owner_insert on public.rubric_library
for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists rubric_library_owner_update on public.rubric_library;
create policy rubric_library_owner_update on public.rubric_library
for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists rubric_library_owner_delete on public.rubric_library;
create policy rubric_library_owner_delete on public.rubric_library
for delete to authenticated using (owner_id = auth.uid());

grant select, insert, update, delete on public.rubric_library
  to authenticated, service_role;

commit;
