drop index if exists public.class_members_student_status_idx;
drop index if exists public.classes_invite_code_unique_idx;

alter table public.classes
  drop column if exists archived,
  drop column if exists is_published,
  drop column if exists semester,
  drop column if exists description;

-- invite_code may predate this migration, so it is intentionally preserved.

