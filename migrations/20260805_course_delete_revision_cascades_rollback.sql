begin;

alter table public.assignment_revisions
  drop constraint if exists assignment_revisions_assignment_id_fkey,
  add constraint assignment_revisions_assignment_id_fkey
    foreign key (assignment_id)
    references public.assignments(id)
    on delete restrict;

alter table public.submission_revisions
  drop constraint if exists submission_revisions_submission_id_fkey,
  add constraint submission_revisions_submission_id_fkey
    foreign key (submission_id)
    references public.submissions(id)
    on delete restrict;

commit;
