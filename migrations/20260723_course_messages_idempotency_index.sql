begin;

-- A regular unique index is required for PostgREST/Supabase
-- `onConflict: teacher_id,provider_request_id` inference. PostgreSQL still
-- allows multiple rows whose provider_request_id is NULL.
drop index if exists public.course_messages_provider_request_unique;

create unique index course_messages_provider_request_unique
  on public.course_messages(teacher_id, provider_request_id);

commit;
