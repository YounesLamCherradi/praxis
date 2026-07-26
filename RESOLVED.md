# Praxis — Resolved Work History

This document records work completed since development of Praxis began.

It combines verified fixes from the current React/Supabase application with
completed work preserved in the archived legacy roadmap. It is a historical
record, not an active task list. Current priorities remain in `TODO.md`.

Items that were only proposed, deferred, partially investigated, or still
require manual verification are intentionally excluded.

---

## Current React/Supabase application — July 2026

### Reliability and synchronization

- Fixed the student workspace race that exposed partial course, assignment, or
  submission snapshots during refresh.
- Courses, assignments, and submissions now commit as one atomic backend
  snapshot.
- Only one student-workspace synchronization job can run at a time.
- Focus and reconnect refreshes request current backend data instead of merely
  repainting stale local state.
- Student, course, and submission matching now uses the stable account UUID
  before considering email.
- Added a clear workspace loading state instead of temporarily presenting an
  empty dashboard.
- Added a non-destructive refresh error state that preserves the last confirmed
  workspace during a temporary outage.
- Centralized ordinary authenticated GET behavior with a 20-second timeout,
  bounded retries for temporary network/429/502/503/504 failures, and one shared
  401 session refresh.
- Reduced review-status fallback polling from every 2 seconds to every
  15 seconds while keeping focus and reconnect refreshes immediate.

### Student identity and ownership

- Fixed real submissions appearing under the fake fallback identity
  `student@aui.ma`.
- Teacher submission responses now include the real profile email.
- The roster and submission views now combine the authenticated student profile
  and submission under one UUID-backed identity.
- Verified through a read-only Supabase audit that the reported learner retained
  approved membership in KOK3880 and ENG6911.
- Verified that the reported ENG6911 final submission was successfully stored;
  the apparent loss was a frontend synchronization issue, not database loss.

### Final submission and autosave

- Replaced ref-only submission loading with reactive UI state.
- Added a synchronous duplicate-click guard.
- Added a bounded wait for pending autosave before final submission.
- Added a 30-second final-submission request timeout.
- Ensured success and failure both release the `Submitting` state.
- Preserved editable local work and avoided false success when final submission
  fails.
- Prevented final submission from remaining indefinitely blocked behind a
  stalled autosave request.

### AI reliability

- Added bounded server-side retries for transient Anthropic connection resets,
  including `ECONNRESET`.
- Added retry handling for temporary Anthropic 429 and 5xx responses.
- Return a clear retryable service error after retry exhaustion instead of
  exposing raw transport failures.
- Applied the shared protection to assignment generation, Coach, student draft
  feedback, and teacher AI grading.
- Kept the AI concurrency gate ahead of velocity accounting so classroom
  congestion does not count as student misuse.
- Added decay to AI velocity escalation so a legitimate student is not
  effectively locked out for a day after temporary congestion.

### Rubrics and grading

- Fixed “Reuse previous” omitting rubrics embedded in existing assignments.
- Combined durable rubric-library entries and assignment-embedded rubric schemas.
- Removed duplicate rubric choices and displayed their source assignment.
- Preserved rubric support for assignments created before the standalone rubric
  library existed.
- Fixed rubric mismatch handling so a 3-criterion / 15-point rubric does not
  block submission merely because a different total was declared elsewhere.
- Preserved teacher final-score overrides, including an override of zero.
- Added editable final-score behavior for teacher grading.
- Hid automatic-total labels after a teacher applies a manual override.
- Fixed final-score flicker during save.
- Added 0.5-point rubric score adjustments.
- Consolidated duplicate AI feedback/justification fields into one student
  comment used consistently by the grading workflow.

### Reopen and attempt history

- Fixed the teacher interface checking an asynchronous reopen operation before it
  completed.
- Reopen now validates that the attempt is current, eligible, and contains real
  submitted text before updating backend state.
- Reopening clears stale active grade/review fields from the editable attempt.
- Prevented locally cached graded state from overriding the server’s reopened
  state.
- Defined and implemented the attempt-history rule: reopen edits the current
  attempt in place; a new attempt is created only when the learner resubmits.
- Preserved the previous graded review as attempt history.

### Student AI feedback interface

- Removed redundant numbered 1–4 feedback navigation.
- Removed previous/next note controls.
- Displayed the complete highlighted paragraph in one bounded, smooth scroll
  area.
- Made highlighted phrases directly clickable and hoverable for their details.
- Removed the conflicting nested-scroll behavior that made notes difficult to
  locate.

### Notifications and status UI

- Removed the visually incompatible small scrollbar from the student
  notification panel.
- Added student-facing graded-work status and direct access to returned feedback.
- Prevented the teacher rail from displaying `Graded` before the grade was
  actually published.
- Cleared stale “submitted successfully” messages when switching assignments.
- Added clear confirmation after a teacher successfully submits a grade.
- Disabled teacher grade submission while the save is in progress.

### Performance

- Added route-level lazy loading for student, teacher, admin, landing, and
  authentication screens.
- Split the former approximately 1.05 MB React application bundle into a shared
  entry and role-specific chunks.
- Reduced student startup JavaScript to approximately 508 KB uncompressed,
  roughly a 52% reduction.
- Prevented student devices from downloading and parsing teacher and admin
  dashboards.
- Reduced background review polling traffic from approximately 30 requests per
  minute to 4 requests per minute.

### Verification

- All 11 current Node unit-test suites pass.
- The current Vite production build succeeds.
- Diff/whitespace validation passes for the current change set.
- The focused student tab/focus refresh browser regression passes.
- Failed-submit and draft-refresh regression coverage exists in the student
  workflow browser suite.

---

## Security and authentication

- Fixed stored XSS in the grade-sheet export by escaping the student-controlled
  display name.
- Restricted profile reads to authenticated users instead of a broad public
  policy.
- Fixed RLS recursion behavior.
- Separated Supabase admin and ordinary user clients/sessions.
- Hardened signup flows with clearer failure messages.
- Added an optional teacher signup code gate.
- Fixed invite links opening under an existing teacher session by signing out
  incompatible roles before showing the student join flow.
- Corrected submission authorization failures to return 403 instead of leaking
  internal 500-class behavior.
- Stopped raw internal submission error messages from being returned to clients
  in the hardened endpoints.
- Fixed the password-reset route so reset callbacks open the application reset
  form rather than the marketing page.
- Corrected the Supabase production Site URL and allowed reset redirect domain.
- Prevented new accounts from receiving an inappropriate legacy
  password-strength upgrade prompt.
- Added pending enrollment approval so a teacher must accept a student joining
  through a class link.

---

## Teacher assignment and grading workflow

- Added a dedicated save path for manual assignment creation.
- Kept manual setup and AI-assisted setup as independent workflows.
- Added teacher access to in-progress student drafts with a clear
  not-yet-submitted warning.
- Made paste-flag indicators actionable from the assignment tray.
- Renamed the export action to “Copy grade and feedback” and clarified what it
  copies.
- Preserved teacher notes when changing rubric selections.
- Persisted AI-suggested comments into the real teacher-review state.
- Fixed rubric scoring interactions jumping the page or rubric pane to the top.
- Preserved rubric-pane scroll position while changing scores.
- Fixed new teacher annotations appearing at the top rather than their validated
  inline source-text location.
- Made teacher roster refresh retrieve current class members as well as
  submission statuses.
- Added an amber banner when a teacher grades work that is still an in-progress
  draft.
- Added understandable writing-behavior help explaining each process label.
- Added a green “Good” annotation/highlight option.
- Renamed “Teacher notes” to “Feedback for student.”
- Renamed AI grading actions for clearer teacher intent.
- Added the ability for teachers to override the final score.
- Added a grade-submission confirmation visible in the grading panel.

---

## Student writing workflow

- Made the transition from Coach to drafting available without requiring a
  second chat message.
- Added a gentle readiness confirmation when a learner advances early.
- Added an optional teacher-controlled automatic outline generated from Coach
  conversation.
- Kept the generated outline editable and stored it with the submission.
- Added “Rebuild from chat” for the editable outline.
- Clarified that the outline field is for short planning notes rather than a full
  draft.
- Rendered Coach bold Markdown and line breaks correctly instead of displaying
  literal asterisks.
- Prevented AI feedback and Coach send actions from being double-triggered while
  already running.
- Added an optional reflection field to self-assessment without blocking final
  submission.
- Added graded-work notifications and a direct “View feedback” route.
- Added rubric self-assessment coverage for the full student submission flow.
- Fixed paste highlights failing after the first or multiline paste by
  normalizing clipboard line endings consistently.

---

## Course membership and communication

- Added pending/approved course membership behavior.
- Added teacher Approve and Decline controls for new learners.
- Added a student waiting state while approval is pending.
- Added automatic visible-tab membership refresh so approved learners enter the
  course without manually restarting the application.
- Made teacher roster entries navigate into the selected learner’s grading view.
- Fixed teacher refresh so it refreshes the roster as well as assignment status.

---

## Data preservation and analytics

- Added `submission_archive` for preserving submissions before a class or
  assignment is deleted.
- Preserved writing events and keystroke logs in the archive.
- Made deletion abort if archival fails, avoiding silent research-data loss.
- Updated deletion confirmation language to explain archival accurately.
- Fixed the admin dashboard counting deleted assignments until a refresh.
- Added refresh behavior after admin-initiated assignment deletion.
- Added test-account and per-submission exclusion support for writing-behavior
  analytics.
- Deleted identified test assignments/submission data that skewed real
  keystroke analytics.
- Added scale indicators for the current writing-fluency metrics.
- Added understandable process-status labels and explanatory help.

---

## Testing and quality improvements

- Added Playwright coverage for authentication, teacher, student, and cross-role
  workflows.
- Added a full student submission path using a 3-criterion rubric.
- Added regression coverage for rubric total mismatch.
- Added failed-submit protection coverage.
- Added draft/focus refresh continuity coverage, including later typing and paste.
- Verified pilot-scale AI concurrency/rate-limit handling.
- Added unit coverage for submission sanitation, review reset behavior,
  notification behavior, authentication refresh, persistence services, replay
  timelines, and teacher-review payloads.

---

## Branding and interface cleanup

- Removed user-facing “AUIZero” branding.
- Renamed teacher-facing labels to consistent Praxis terminology.
- Improved assignment, submission, grading, and feedback status messaging.
- Clarified the manual assignment workflow and student outline workflow.
- Improved direct access to grades, feedback, paste evidence, and annotations.

---

## Related documents

- Active roadmap: `TODO.md`
- Archived legacy roadmap: `docs/TODO-legacy.md`
- Backend/Supabase setup: `docs/backend-supabase-setup.md`

When a new item is completed, update both its checkbox in `TODO.md` and the
appropriate historical section in this file.
