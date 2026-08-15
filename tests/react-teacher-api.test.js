const test = require("node:test");
const assert = require("node:assert/strict");

async function loadTeacherApi() {
  return import("../frontend/src/services/teacherApi.js");
}

test("React autosave payload sends only changed fields and append-only event tails", async () => {
  const { buildIncrementalSubmissionPayload } = await loadTeacherApi();
  const baseline = {
    id: "submission-1",
    draftText: "First draft",
    finalText: "",
    writingEvents: [{ id: "event-1", type: "insert" }],
    keystrokeLog: [{ at: 1, gap: 0 }],
    updatedAt: "2026-08-09T10:00:00.000Z",
  };
  const current = {
    ...baseline,
    draftText: "First draft revised",
    writingEvents: [
      ...baseline.writingEvents,
      { id: "event-2", type: "insert" },
    ],
  };

  const payload = buildIncrementalSubmissionPayload(current, baseline);

  assert.equal(payload.draft_text, "First draft revised");
  assert.equal(payload.final_text, undefined);
  assert.equal(payload.writing_events, undefined);
  assert.deepEqual(payload.writing_events_append, [
    { id: "event-2", type: "insert" },
  ]);
  assert.equal(payload.writing_events_base, 1);
  assert.equal(payload.keystroke_log, undefined);
  assert.equal(payload.expected_updated_at, baseline.updatedAt);
});

test("React autosave payload sends a full event array if existing history was rewritten", async () => {
  const { buildIncrementalSubmissionPayload } = await loadTeacherApi();
  const baseline = {
    writingEvents: [{ id: "event-1", type: "insert" }],
    updatedAt: "2026-08-09T10:00:00.000Z",
  };
  const current = {
    ...baseline,
    writingEvents: [{ id: "replacement", type: "paste_insert" }],
  };

  const payload = buildIncrementalSubmissionPayload(current, baseline);

  assert.deepEqual(payload.writing_events, [
    { id: "replacement", type: "paste_insert" },
  ]);
  assert.equal(payload.writing_events_append, undefined);
});

test("teacher workspace snapshot preserves course, assignment, and submission identities", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    assert.equal(path, "/api/teacher/workspace");
    return new Response(JSON.stringify({
      classes: [{ id: "class-1", name: "Writing", invite_code: "JOIN123" }],
      assignments: [{
        id: "assignment-1",
        class_id: "class-1",
        title: "Essay",
        status: "published",
        rubric: { criteria: [{ id: "criterion-1" }] },
      }],
      submissions: [{
        id: "submission-1",
        assignment_id: "assignment-1",
        student_id: "student-1",
        status: "submitted",
        profiles: { name: "Student One", email: "student@aui.ma" },
        detail_loaded: false,
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { getTeacherWorkspaceSnapshot } = await loadTeacherApi();
    const snapshot = await getTeacherWorkspaceSnapshot();
    assert.equal(snapshot.classes[0].code, "JOIN123");
    assert.equal(snapshot.assignments[0].classId, "class-1");
    assert.equal(snapshot.assignments[0].rubric.length, 1);
    assert.equal(snapshot.submissions[0].assignmentId, "assignment-1");
    assert.equal(snapshot.submissions[0].studentName, "Student One");
    assert.equal(snapshot.submissions[0].detailLoaded, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("student workspace snapshot keeps persisted draft content available", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (path) => {
    assert.equal(path, "/api/student/workspace");
    return new Response(JSON.stringify({
      classes: [{ id: "class-1", name: "Writing" }],
      pendingClasses: [],
      assignments: [{ id: "assignment-1", class_id: "class-1", status: "published" }],
      submissions: [{
        id: "submission-1",
        assignment_id: "assignment-1",
        student_id: "student-1",
        status: "draft",
        draft_text: "My saved draft",
        chat_history: [{ role: "student", content: "Idea" }],
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const { getStudentWorkspaceSnapshot } = await loadTeacherApi();
    const snapshot = await getStudentWorkspaceSnapshot();
    assert.equal(snapshot.submissions[0].draftText, "My saved draft");
    assert.equal(snapshot.submissions[0].chatHistory.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
