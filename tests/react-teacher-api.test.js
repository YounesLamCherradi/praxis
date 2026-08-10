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
