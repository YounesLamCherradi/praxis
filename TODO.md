# Praxis — Current React/Supabase Roadmap

This is the only active TODO list for the current application.

The previous `public/` frontend checklist is archived in
`docs/TODO-legacy.md`. It is irrelevant to current implementation planning.

---

## Fixed and verified — 2026-07-24

- [x] **Transient first-attempt AI failures** — the shared
  `POST /api/generate` endpoint retries temporary Anthropic connection resets
  and retryable 429/5xx responses with bounded backoff. This protects Coach,
  assignment generation, student draft feedback, and teacher AI grading.
- [x] **Previous rubrics missing from “Reuse previous”** — the assignment
  builder combines the reusable rubric library with rubric schemas embedded in
  existing assignments and removes duplicates.
- [x] **Real submissions displayed as `student@aui.ma`** — teacher submission
  data now includes the real profile email, and student/course/submission
  identity matching uses the stable account UUID first.
- [x] **Reopen displayed a false failure** — the teacher interface awaits the
  asynchronous reopen operation and validates the current attempt before
  changing backend state.
- [x] **Broken AI-feedback scrolling and redundant numbered navigation** — the
  complete highlighted paragraph uses one stable smooth scroll area. Students
  click or hover directly on highlighted phrases; the 1–4 and previous/next
  controls were removed.
- [x] **Notification panel nested scrollbar** — removed the small fixed-height
  notification scroller so the panel follows the dashboard layout.
- [x] **Submission stuck on “Submitting” or appeared to require two clicks** —
  submission uses reactive loading state, duplicate-click protection, a bounded
  autosave wait, and a 30-second final-request timeout.
- [x] **Courses or submissions appeared only after repeated refreshes** — the
  student workspace now performs one synchronization at a time and commits
  courses, assignments, and submissions as one complete UUID-scoped backend
  snapshot.
- [x] **Misleading empty dashboard during startup or an outage** — added a
  loading screen and non-destructive refresh error message. Failed refreshes
  preserve the last confirmed workspace.
- [x] **Inconsistent ordinary API network behavior** — authenticated GET
  requests share a 20-second timeout, bounded retry behavior for temporary
  failures, and one shared 401 session refresh.
- [x] **Excessive review polling** — reduced fallback polling from every
  2 seconds to every 15 seconds. Focus and reconnect refreshes remain immediate.
- [x] **Every role loaded one large JavaScript bundle** — React routes now use
  lazy loading for student, teacher, admin, landing, and authentication screens.
  Student startup JavaScript dropped from about 1.05 MB to about 508 KB
  uncompressed.
- [x] **Attempt-history behavior decided** — reopening edits the current attempt
  in place; a new attempt is created only when the student resubmits. The
  previous graded review remains available as history.
- [x] **Current verification** — all 11 Node unit-test suites pass, the Vite
  production build succeeds, and the focused tab/focus refresh browser
  regression passes.

---

## P0 — Required before a larger production rollout

- [ ] **Make browser E2E tests a reliable deployment gate**
  - Replace the remaining fixtures that seed `localStorage` as the database.
  - Mock the current backend course, assignment, and submission endpoints.
  - Cover teacher create/publish → student write/autosave/submit → teacher
    grade/reopen → student revise/resubmit.
  - Cover refresh while writing, refresh during submission, one-click submit,
    identity correctness, grade visibility, and rubric reuse.
  - Repeat timing-sensitive tests to catch race conditions.

- [ ] **Create a separate staging environment**
  - Separate deployment URL and Supabase project.
  - Separate test accounts.
  - Separate Anthropic key or strict staging budget.
  - Separate email and monitoring configuration.
  - Never test destructive workflows or migrations on production student data.

- [ ] **Finish the draft-recovery boundary**
  - Supabase remains authoritative for courses, memberships, assignments,
    submission status, grades, and teacher reviews.
  - Store only unsynchronized draft and writing-replay recovery in IndexedDB.
  - Key recovery by student UUID and assignment UUID.
  - Show `Saving`, `Saved`, `Offline`, and `Sync failed`.
  - Test browser crash, offline/reconnect, session expiry, multiple tabs, and
    conflict resolution.
  - Ensure final submission always takes priority over autosave.

- [ ] **Add a security and RLS regression suite**
  - Students can read and update only their own draft/submission.
  - Students cannot change grades or teacher reviews.
  - Teachers can access only their own classes and students.
  - Non-admin users cannot use admin endpoints.
  - Archived and deleted resources are inaccessible.
  - Authentication cookies and refresh behavior are verified in production mode.

- [ ] **Verify database integrity constraints and indexes**
  - Index `class_members(student_id)` and `class_members(class_id)`.
  - Index `assignments(class_id)`.
  - Index `submissions(student_id)`, `submissions(assignment_id)`, and the
    combined student/assignment lookup.
  - Enforce valid statuses, foreign keys, and unique course invite codes.
  - Enforce the chosen invariant for one current submission per
    student/assignment.

---

## P1 — Reliability, monitoring, and scalability

- [ ] **Add privacy-safe Sentry monitoring**
  - Create separate React and Express Sentry projects.
  - Configure source maps, release tags, and staging/production environments.
  - Monitor submission, autosave, authentication, workspace synchronization,
    backend, and exhausted AI retry failures.
  - Send only internal UUIDs and operational metadata.
  - Never send essays, drafts, chats, feedback, grades, names, emails, cookies,
    tokens, or request bodies.

- [ ] **Run realistic load and failure tests**
  - Simulate 20–50 students autosaving simultaneously.
  - Simulate concurrent final submissions and AI-feedback requests.
  - Test slow Supabase responses and temporary Anthropic outages.
  - Test lost internet, reconnect, session expiry, duplicate clicks, and refresh
    during submission.
  - Confirm rate limits and queues fail safely without losing student writing.

- [ ] **Split large React workspace contexts by state boundary**
  - Extract focused course, assignment, draft/autosave, submission, feedback,
    rubric, and grading hooks/providers.
  - Prevent draft typing from rerendering unrelated course and notification UI.
  - Measure improvements with React Profiler.
  - Moving lines into smaller files alone does not count; context subscriptions
    and rerender boundaries must actually improve.

- [ ] **Replace review polling with realtime events**
  - Use Supabase Realtime or a controlled server event channel for assignment
    publication, submission, grading, reopening, and notifications.
  - Keep the 15-second poll only as a fallback recovery path.

- [ ] **Create automated deployment safeguards**
  - Lint.
  - Unit tests.
  - Production build.
  - Migration validation.
  - Critical browser workflows.
  - Staging deployment and smoke test.
  - Explicit production approval.
  - Documented rollback and backup restoration.

- [ ] **Document operations**
  - Required environment variables.
  - Local and staging setup.
  - Deployment and rollback.
  - Database migrations and backup restoration.
  - Anthropic, email, and Sentry configuration.
  - Student-data privacy rules.
  - Common incident troubleshooting.

---

## P2 — Accessibility and further optimization

- [ ] **Complete an accessibility pass**
  - Keyboard-only navigation.
  - Dialog focus trapping and focus restoration.
  - Screen-reader labels and live error announcements.
  - Color contrast.
  - Reduced-motion support.
  - Feedback access that does not depend only on hover.

- [ ] **Measure real production performance**
  - Largest Contentful Paint.
  - Interaction to Next Paint.
  - Student dashboard synchronization time.
  - Autosave and final-submit latency.
  - API error and retry rates.
  - AI response latency and retry exhaustion.

- [ ] **Continue code splitting only where measurements justify it**
  - Assignment builder.
  - Teacher grading workspace.
  - Writing replay.
  - Admin analytics.
  - Heavy feedback and rubric tools.

- [ ] **Optimize large lists**
  - Add pagination or virtualization for large class rosters, submission lists,
    notification histories, and replay timelines.
  - Lazy-load heavy writing-event and keystroke data only when a teacher opens a
    specific submission.

---

## Current release checklist

- [ ] Unit tests pass.
- [ ] Production frontend build passes.
- [ ] Critical browser workflows pass.
- [ ] Database migrations are applied and verified in staging.
- [ ] Staging smoke test passes for student and teacher accounts.
- [ ] No unresolved P0 regression is included in the release.
- [ ] Production monitoring and rollback procedures are ready.
