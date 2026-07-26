const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const serviceUrl = pathToFileURL(
  path.join(__dirname, "../frontend/src/services/teacherApi.js")
).href;
const reportServiceUrl = pathToFileURL(
  path.join(__dirname, "../frontend/src/services/reportApi.js")
).href;

test("workspace persistence service normalizes database assignment rows", async () => {
  const { normalizeAssignment } = await import(serviceUrl);
  const assignment = normalizeAssignment({
    id: "assignment-1",
    class_id: "class-1",
    status: "published",
    deadline: "2026-08-01T12:00:00.000Z",
    word_count_min: 250,
    word_count_max: 500,
    rubric: { criteria: [{ id: "clarity" }] },
    version: 3,
  });

  assert.equal(assignment.classId, "class-1");
  assert.equal(assignment.status, "Published");
  assert.equal(assignment.dueDate, "2026-08-01T12:00:00.000Z");
  assert.equal(assignment.minWords, 250);
  assert.equal(assignment.maxWords, 500);
  assert.equal(assignment.rubric.length, 1);
  assert.equal(assignment.version, 3);
});

test("assignment creation sends database field names and an idempotency key", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options };
    return {
      ok: true,
      json: async () => ({
        assignment: {
          id: "assignment-1",
          class_id: "class-1",
          title: "Persist me",
          status: "draft",
          version: 1,
        },
      }),
    };
  };

  const { createAssignment } = await import(serviceUrl);
  const created = await createAssignment("class-1", {
    title: "Persist me",
    description: "Durable instructions",
    assignmentType: "Essay",
    languageLevel: "B2",
    minWords: 200,
    maxWords: 400,
    idempotencyKey: "request-key-1",
  });

  assert.equal(captured.url, "/api/classes/class-1/assignments");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["Idempotency-Key"], "request-key-1");
  const body = JSON.parse(captured.options.body);
  assert.equal(body.prompt, "Durable instructions");
  assert.equal(body.assignment_type, "Essay");
  assert.equal(body.word_count_min, 200);
  assert.equal(body.word_count_max, 400);
  assert.equal(created.id, "assignment-1");
});

test("submission autosave includes optimistic concurrency timestamp", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });

  let body;
  global.fetch = async (_url, options) => {
    body = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({
        submission: {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: "student-1",
          status: "draft",
          draft_text: body.draft_text,
          updated_at: "2026-07-23T16:20:00.000Z",
        },
      }),
    };
  };

  const { saveMySubmission } = await import(serviceUrl);
  const saved = await saveMySubmission({
    id: "submission-1",
    assignmentId: "assignment-1",
    draftText: "Never silently lose this text.",
    updatedAt: "2026-07-23T16:19:00.000Z",
  });

  assert.equal(body.draft_text, "Never silently lose this text.");
  assert.equal(body.expected_updated_at, "2026-07-23T16:19:00.000Z");
  assert.equal(saved.draftText, "Never silently lose this text.");
});

test("submission failure exposes conflict metadata and never returns false success", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => ({
    ok: false,
    status: 409,
    json: async () => ({
      error: "Submission changed elsewhere.",
      conflict: true,
      updated_at: "2026-07-23T16:21:00.000Z",
    }),
  });

  const { submitMyAssignment } = await import(serviceUrl);
  await assert.rejects(
    submitMyAssignment("assignment-1", {
      draftText: "Local recovery text",
      finalText: "Final text",
      idempotencyKey: "submission-request-1",
    }),
    (error) =>
      error.status === 409 &&
      error.conflict === true &&
      error.updatedAt === "2026-07-23T16:21:00.000Z"
  );
});

test("teacher submission lists and detail loads use separate endpoints", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const calls = [];
  global.fetch = async (url) => {
    calls.push(url);
    if (url === "/api/classes/class-1/submissions") {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          submissions: [{
            id: "submission-1",
            assignment_id: "assignment-1",
            student_id: "student-1",
            status: "submitted",
            final_text: "Submitted text",
            detail_loaded: false,
          }],
        }),
      };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        submission: {
          id: "submission-1",
          assignment_id: "assignment-1",
          student_id: "student-1",
          status: "submitted",
          final_text: "Submitted text",
          writing_events: [{ type: "input" }],
          detail_loaded: true,
        },
      }),
    };
  };

  const {
    getSubmissionDetails,
    getTeacherSubmissionsForClass,
  } = await import(serviceUrl);
  const summaries = await getTeacherSubmissionsForClass("class-1");
  assert.equal(summaries[0].detailLoaded, false);
  assert.deepEqual(summaries[0].writingEvents, []);

  const detail = await getSubmissionDetails("submission-1");
  assert.equal(detail.detailLoaded, true);
  assert.equal(detail.writingEvents.length, 1);
  assert.deepEqual(calls, [
    "/api/classes/class-1/submissions",
    "/api/submissions/submission-1",
  ]);
});

test("bug reports are sent to the authenticated backend with context", async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  let captured;
  global.fetch = async (url, options) => {
    captured = { url, options, body: JSON.parse(options.body) };
    return {
      ok: true,
      json: async () => ({ report: { id: "report-1", status: "open" } }),
    };
  };

  const { createBugReport } = await import(reportServiceUrl);
  const report = await createBugReport({
    description: "The submit button remained disabled.",
    route: "/student",
    assignmentId: "assignment-1",
    studentStep: 4,
  });

  assert.equal(captured.url, "/api/bug-reports");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.body.description, "The submit button remained disabled.");
  assert.equal(captured.body.context.assignmentId, "assignment-1");
  assert.equal(captured.body.context.studentStep, 4);
  assert.equal(report.id, "report-1");
});
