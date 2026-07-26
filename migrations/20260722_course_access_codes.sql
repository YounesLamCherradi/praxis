-- Persist course access codes and course visibility in Supabase so students
-- can join from a different browser or device.

alter table public.classes
  add column if not exists invite_code text,
  add column if not exists description text,
  add column if not exists semester text,
  add column if not exists is_published boolean not null default true,
  add column if not exists archived boolean not null default false;

update public.classes
set invite_code = upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8))
where invite_code is null or btrim(invite_code) = '';

alter table public.classes
  alter column invite_code set not null;

create unique index if not exists classes_invite_code_unique_idx
  on public.classes (upper(invite_code));

create index if not exists class_members_student_status_idx
  on public.class_members (student_id, status);

