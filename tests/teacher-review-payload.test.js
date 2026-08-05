const assert = require("node:assert/strict");
const test = require("node:test");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const teacherApiUrl = pathToFileURL(
  path.join(__dirname, "../frontend/src/services/teacherApi.js")
).href;

test("a saved grade replaces an existing empty teacher review", async () => {
  const {
    buildTeacherReviewPayload,
  } = await import(`${teacherApiUrl}?payload=${Date.now()}`);

  const review = buildTeacherReviewPayload({
    status: "Graded",
    reviewedAt: "2026-07-23T23:00:00.000Z",
    score: 87.5,
    feedback: "Clear organization and useful examples.",
    annotations: [
      {
        id: "annotation-1",
        start: 4,
        end: 18,
        comment: "Strong topic sentence.",
      },
    ],
    rubricScores: {
      organization: {
        criterionId: "organization",
        score: 22.5,
        comment: "Logical sequence.",
      },
    },
    rubricId: "rubric-1",
    rubricTitle: "Process writing",
    rubricTotal: 100,
    rubricCalculatedScore: 87.5,
    rubricOverride: false,
    teacherReview: {
      status: "ungraded",
      finalScore: "",
      finalNotes: "",
      annotations: [],
      rubricScores: {},
      savedAt: null,
    },
  });

  assert.equal(review.status, "graded");
  assert.equal(review.savedAt, "2026-07-23T23:00:00.000Z");
  assert.equal(review.finalScore, 87.5);
  assert.equal(review.finalNotes, "Clear organization and useful examples.");
  assert.equal(review.annotations.length, 1);
  assert.equal(review.rubricScores.organization.score, 22.5);
  assert.equal(review.rubricId, "rubric-1");
  assert.equal(review.rubricTotal, 100);
});

test("student normalization exposes the complete nested teacher review", async () => {
  const {
    normalizeSubmission,
  } = await import(`${teacherApiUrl}?normalize=${Date.now()}`);

  const submission = normalizeSubmission({
    id: "submission-1",
    assignment_id: "assignment-1",
    status: "graded",
    teacher_review: {
      status: "graded",
      finalScore: 92,
      finalNotes: "Excellent revision.",
      savedAt: "2026-07-23T23:05:00.000Z",
      annotations: [{ id: "highlight-1", start: 0, end: 9 }],
      rubricScores: {
        clarity: { criterionId: "clarity", score: 23 },
      },
    },
  });

  assert.equal(submission.status, "graded");
  assert.equal(submission.score, 92);
  assert.equal(submission.feedback, "Excellent revision.");
  assert.equal(submission.reviewedAt, "2026-07-23T23:05:00.000Z");
  assert.equal(submission.annotations.length, 1);
  assert.equal(submission.rubricScores.clarity.score, 23);
});

test("legacy graded rows recover their displayed score from saved rubric scores", async () => {
  const {
    normalizeSubmission,
  } = await import(`${teacherApiUrl}?legacy=${Date.now()}`);

  const submission = normalizeSubmission({
    id: "legacy-graded",
    status: "graded",
    teacher_review: {
      status: "ungraded",
      finalScore: "",
      finalNotes: "",
      savedAt: "2026-07-23T22:30:19.081Z",
      rubricScores: {
        first: { score: 20 },
        second: { score: 22.5 },
        third: { score: 18 },
        fourth: { score: 24 },
      },
    },
  });

  assert.equal(submission.score, 84.5);
  assert.equal(Object.keys(submission.rubricScores).length, 4);
});

test("student rubric self-assessment round-trips through the API payload", async () => {
  const {
    normalizeSubmission,
    submissionPayload,
  } = await import(`${teacherApiUrl}?self-assessment=${Date.now()}`);

  const payload = submissionPayload({
    selfRubricAssessment: true,
    selfRubricScores: {
      clarity: {
        criterionId: "clarity",
        criterionName: "Clarity",
        maxPoints: 5,
        bandId: "good",
        bandLabel: "Good",
        score: 4,
      },
    },
    selfRubricTotal: 4,
    selfRubricMax: 5,
    selfRubricPercentage: 80,
    selfAssessedAt: "2026-08-05T18:00:00.000Z",
  });

  assert.equal(typeof payload.self_assessment, "object");
  assert.equal(payload.self_assessment.completed, true);
  assert.equal(payload.self_assessment.rowScores[0].criterionId, "clarity");
  assert.equal(payload.self_assessment.rowScores[0].points, 4);

  const normalized = normalizeSubmission({
    id: "submission-self-assessment",
    assignment_id: "assignment-1",
    self_assessment: payload.self_assessment,
  });

  assert.equal(normalized.selfRubricScores.clarity.bandId, "good");
  assert.equal(normalized.selfRubricTotal, 4);
  assert.equal(normalized.selfRubricMax, 5);
  assert.equal(normalized.selfRubricPercentage, 80);
  assert.equal(normalized.selfAssessedAt, "2026-08-05T18:00:00.000Z");
});
