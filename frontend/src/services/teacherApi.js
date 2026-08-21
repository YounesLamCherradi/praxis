function snakeToCamel(row = {}) {
  return Object.fromEntries(
    Object.entries(row || {}).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ])
  );
}

function hasReviewValue(value) {
  return value !== undefined && value !== null && value !== "";
}

async function request(path, options = {}) {
  return requestJson(path, options, { errorPrefix: "Workspace request failed" });
}

export function normalizeAssignment(row = {}) {
  const value = snakeToCamel(row);
  const rubricSchema =
    value.rubric && !Array.isArray(value.rubric)
      ? value.rubric
      : { criteria: Array.isArray(value.rubric) ? value.rubric : [] };
  return {
    ...value,
    classId: value.classId,
    dueDate: value.deadline || value.dueDate || null,
    description: value.description || value.prompt || "",
    instructions: value.description || value.prompt || "",
    assignmentType: value.assignmentType || "Other",
    languageLevel: value.languageLevel || "",
    studentLevel: value.languageLevel || "",
    minWords: Number(value.wordCountMin || 0),
    maxWords: Number(value.wordCountMax || 0),
    rubricSchema,
    rubric: Array.isArray(rubricSchema.criteria) ? rubricSchema.criteria : [],
    status: String(value.status || "draft").toLowerCase() === "published"
      ? "Published"
      : "Draft",
  };
}

function assignmentPayload(assignment = {}) {
  const rawStatus = String(assignment.status || "draft").toLowerCase();
  return {
    title: String(assignment.title || "").trim() || "Untitled draft assignment",
    prompt: assignment.prompt || assignment.description || assignment.instructions || "",
    brief: assignment.aiBrief || assignment.teacherRequest || assignment.brief || "",
    focus: assignment.focus || "",
    assignment_type: assignment.assignmentType || assignment.assignment_type || "Other",
    language_level: assignment.languageLevel || assignment.studentLevel || "",
    word_count_min: Number(assignment.wordCountMin ?? assignment.minWords ?? 0),
    word_count_max: Number(assignment.wordCountMax ?? assignment.maxWords ?? 0),
    idea_request_limit: Number(assignment.ideaRequestLimit || 0),
    feedback_request_limit: Number(assignment.feedbackRequestLimit || 0),
    chat_time_limit: Number(assignment.chatTimeLimit || 0),
    student_focus: assignment.studentFocus || {},
    rubric: assignment.rubricSchema || {
      criteria: Array.isArray(assignment.rubric) ? assignment.rubric : [],
    },
    status: rawStatus === "published" || rawStatus === "active" ? "published" : "draft",
    deadline: assignment.dueDate || assignment.deadline || null,
    uploaded_rubric_text: assignment.uploadedRubricText || "",
    auto_outline_from_chat: Boolean(assignment.autoOutlineFromChat),
    expected_version: assignment.version || undefined,
  };
}

export async function getAssignmentsForClass(classId) {
  const data = await request(`/api/classes/${encodeURIComponent(classId)}/assignments`);
  return (Array.isArray(data.assignments) ? data.assignments : []).map(normalizeAssignment);
}

export async function createAssignment(classId, assignment) {
  const data = await request(`/api/classes/${encodeURIComponent(classId)}/assignments`, {
    method: "POST",
    headers: { "Idempotency-Key": assignment.idempotencyKey || crypto.randomUUID() },
    body: JSON.stringify(assignmentPayload(assignment)),
  });
  return normalizeAssignment(data.assignment);
}

export async function updateAssignment(assignmentId, assignment) {
  const data = await request(`/api/assignments/${encodeURIComponent(assignmentId)}`, {
    method: "PATCH",
    body: JSON.stringify(assignmentPayload(assignment)),
  });
  return normalizeAssignment(data.assignment);
}

export async function removeAssignment(assignmentId) {
  return request(`/api/assignments/${encodeURIComponent(assignmentId)}`, {
    method: "DELETE",
  });
}

export function normalizeSubmission(row = {}) {
  const value = snakeToCamel(row);
  const selfAssessment =
    value.selfAssessment && typeof value.selfAssessment === "object"
      ? value.selfAssessment
      : {};
  const selfAssessmentRows = Array.isArray(selfAssessment.rowScores)
    ? selfAssessment.rowScores
    : [];
  const selfRubricScores =
    selfAssessment.rubricScores &&
    typeof selfAssessment.rubricScores === "object"
      ? selfAssessment.rubricScores
      : Object.fromEntries(
          selfAssessmentRows
            .filter((entry) => entry?.criterionId)
            .map((entry) => [
              entry.criterionId,
              {
                criterionId: entry.criterionId,
                criterionName: entry.criterionName || entry.label || "",
                maxPoints: Number(entry.maxPoints || 0),
                bandId: entry.bandId || entry.levelId || "",
                bandLabel: entry.bandLabel || entry.levelLabel || "",
                score: Number(entry.score ?? entry.points ?? 0),
                comment: entry.comment || "",
              },
            ])
        );
  const teacherReview =
    value.teacherReview && typeof value.teacherReview === "object"
      ? snakeToCamel(value.teacherReview)
      : {};
  const rubricScores =
    value.rubricScores && typeof value.rubricScores === "object"
      ? value.rubricScores
      : teacherReview.rubricScores &&
          typeof teacherReview.rubricScores === "object"
        ? teacherReview.rubricScores
        : {};
  const calculatedRubricScore = Object.values(rubricScores).reduce(
    (sum, entry) => {
      const rawScore =
        entry && typeof entry === "object"
          ? entry.score
          : entry;
      const numericScore = Number(rawScore);
      return Number.isFinite(numericScore)
        ? sum + numericScore
        : sum;
    },
    0
  );
  const hasSavedRubricScores =
    Object.keys(rubricScores).length > 0;
  const score =
    hasReviewValue(value.score)
      ? value.score
      : hasReviewValue(teacherReview.finalScore)
        ? teacherReview.finalScore
        : hasSavedRubricScores
          ? calculatedRubricScore
          : null;
  const feedback =
    String(value.feedback || "").trim()
      ? value.feedback
      : teacherReview.finalNotes || "";
  const annotations = Array.isArray(value.annotations)
    ? value.annotations
    : Array.isArray(teacherReview.annotations)
      ? teacherReview.annotations
      : [];
  const reviewedAt =
    value.reviewedAt ||
    value.teacherReviewedAt ||
    teacherReview.savedAt ||
    null;

  return {
    ...value,
    selfAssessment,
    selfRubricScores,
    selfRubricTotal:
      value.selfRubricTotal ??
      selfAssessment.score ??
      selfAssessment.total ??
      Object.values(selfRubricScores).reduce(
        (sum, entry) => sum + Number(entry?.score || 0),
        0
      ),
    selfRubricMax:
      value.selfRubricMax ??
      selfAssessment.maxScore ??
      selfAssessment.max ??
      null,
    selfRubricPercentage:
      value.selfRubricPercentage ?? selfAssessment.percentage ?? null,
    selfAssessedAt:
      value.selfAssessedAt ?? selfAssessment.assessedAt ?? null,
    teacherReview,
    score,
    feedback,
    annotations,
    rubricScores,
    reviewedAt,
    teacherReviewedAt: reviewedAt,
    gradedAt:
      value.gradedAt ||
      (String(value.status || "").toLowerCase() === "graded"
        ? reviewedAt
        : null),
    assignmentId: value.assignmentId,
    studentId: value.studentId,
    studentName: value.profiles?.name || value.studentName || "Student",
    studentEmail:
      value.profiles?.email ||
      value.studentEmail ||
      value.userEmail ||
      "",
    draftText: value.draftText || "",
    finalText: value.finalText || "",
    submittedText: ["submitted", "graded", "late"].includes(
      String(value.status || "").toLowerCase()
    )
      ? value.finalText || ""
      : "",
    chatHistory: Array.isArray(value.chatHistory) ? value.chatHistory : [],
    ideaResponses: Array.isArray(value.ideaResponses) ? value.ideaResponses : [],
    writingEvents: Array.isArray(value.writingEvents) ? value.writingEvents : [],
    keystrokeLog: Array.isArray(value.keystrokeLog) ? value.keystrokeLog : [],
    feedbackHistory: Array.isArray(value.feedbackHistory) ? value.feedbackHistory : [],
  };
}

export function submissionPayload(submission = {}) {
  const existingSelfAssessment =
    submission.selfAssessment && typeof submission.selfAssessment === "object"
      ? submission.selfAssessment
      : {};
  const selfRubricScores =
    submission.selfRubricScores && typeof submission.selfRubricScores === "object"
      ? submission.selfRubricScores
      : existingSelfAssessment.rubricScores || {};
  const selfAssessment = {
    ...existingSelfAssessment,
    completed: Boolean(
      submission.selfRubricAssessment ??
        submission.selfAssessmentComplete ??
        existingSelfAssessment.completed
    ),
    rubricScores: selfRubricScores,
    rowScores: Object.values(selfRubricScores).map((entry) => ({
      criterionId: entry.criterionId,
      criterionName: entry.criterionName || "",
      maxPoints: Number(entry.maxPoints || 0),
      bandId: entry.bandId || "",
      bandLabel: entry.bandLabel || "",
      score: Number(entry.score || 0),
      points: Number(entry.score || 0),
      comment: entry.comment || "",
    })),
    score: Number(
      submission.selfRubricTotal ?? existingSelfAssessment.score ?? 0
    ),
    maxScore: Number(
      submission.selfRubricMax ?? existingSelfAssessment.maxScore ?? 0
    ),
    percentage: Number(
      submission.selfRubricPercentage ?? existingSelfAssessment.percentage ?? 0
    ),
    assessedAt:
      submission.selfAssessedAt || existingSelfAssessment.assessedAt || null,
  };

  return {
    idea_responses: submission.ideaResponses || [],
    draft_text: submission.draftText ?? submission.content ?? "",
    final_text: submission.finalText ?? "",
    reflections: submission.reflections || {},
    outline: submission.outline || {},
    chat_history: submission.chatHistory || [],
    writing_events: submission.writingEvents || [],
    feedback_history: submission.feedbackHistory || [],
    focus_annotations: submission.focusAnnotations || submission.annotations || [],
    self_assessment: selfAssessment,
    chat_started_at: submission.chatStartedAt || null,
    chat_skipped_at: submission.chatSkippedAt || null,
    chat_expired_at: submission.chatExpiredAt || null,
    chat_elapsed_ms: Number(submission.chatElapsedMs || 0),
    started_at: submission.startedAt || submission.createdAt || new Date().toISOString(),
    keystroke_log: submission.keystrokeLog || [],
    fluency_summary: submission.fluencySummary || {},
    final_unlocked: Boolean(submission.finalUnlocked),
    expected_updated_at: submission.updatedAt || submission.updated_at || undefined,
  };
}

export async function getStudentAssignments(classId) {
  return getAssignmentsForClass(classId);
}

export async function getStudentSubmissions(assignmentIds = []) {
  const query = assignmentIds.length
    ? `?assignmentIds=${encodeURIComponent(assignmentIds.join(","))}`
    : "";
  const data = await request(`/api/student/submissions${query}`);
  return (Array.isArray(data.submissions) ? data.submissions : []).map(normalizeSubmission);
}

export async function getStudentSubmissionSummaries() {
  const data = await request("/api/student/submissions?summary=1");
  return (Array.isArray(data.submissions) ? data.submissions : []).map(normalizeSubmission);
}

export async function getTeacherSubmissionsForClass(classId) {
  const data = await request(`/api/classes/${encodeURIComponent(classId)}/submissions`);
  return (Array.isArray(data.submissions) ? data.submissions : []).map(normalizeSubmission);
}

export async function getTeacherSubmissions() {
  const data = await request("/api/teacher/submissions");
  return (Array.isArray(data.submissions) ? data.submissions : []).map(normalizeSubmission);
}

export async function getSubmissionDetails(submissionId) {
  const data = await request(`/api/submissions/${encodeURIComponent(submissionId)}`);
  return normalizeSubmission(data.submission);
}

export function buildTeacherReviewPayload(submission = {}) {
  const rawReview =
    submission.teacherReview ||
    submission.teacher_review ||
    {};
  const submissionStatus = String(
    submission.status || "submitted"
  ).toLowerCase();
  const reviewStatus = String(
    submissionStatus === "graded"
      ? "graded"
      : rawReview.status || "ungraded"
  ).toLowerCase();
  const explicitReviewedAt =
    submission.reviewedAt ||
    submission.reviewed_at ||
    null;
  const savedAt =
    explicitReviewedAt ||
    rawReview.savedAt ||
    rawReview.saved_at ||
    (reviewStatus === "graded" ? new Date().toISOString() : null);

  return {
    ...rawReview,
    status: reviewStatus,
    savedAt,
    finalScore:
      hasReviewValue(submission.score)
        ? submission.score
        : rawReview.finalScore ??
          rawReview.final_score ??
          "",
    finalNotes:
      Object.prototype.hasOwnProperty.call(submission, "feedback")
        ? submission.feedback || ""
        : rawReview.finalNotes ??
          rawReview.final_notes ??
          "",
    annotations:
      Object.prototype.hasOwnProperty.call(submission, "annotations")
        ? submission.annotations || []
        : rawReview.annotations || [],
    rubricScores:
      Object.prototype.hasOwnProperty.call(submission, "rubricScores")
        ? submission.rubricScores || {}
        : rawReview.rubricScores ||
          rawReview.rubric_scores ||
          {},
    rubricId:
      submission.rubricId ??
      rawReview.rubricId ??
      rawReview.rubric_id ??
      null,
    rubricTitle:
      submission.rubricTitle ??
      rawReview.rubricTitle ??
      rawReview.rubric_title ??
      null,
    rubricTotal:
      submission.rubricTotal ??
      rawReview.rubricTotal ??
      rawReview.rubric_total ??
      null,
    rubricCalculatedScore:
      submission.rubricCalculatedScore ??
      rawReview.rubricCalculatedScore ??
      rawReview.rubric_calculated_score ??
      null,
    rubricOverride:
      submission.rubricOverride ??
      rawReview.rubricOverride ??
      rawReview.rubric_override ??
      false,
  };
}

export async function updateSubmissionAsTeacher(submissionId, submission = {}) {
  const submissionStatus = String(submission.status || "submitted").toLowerCase();
  const teacherReview = buildTeacherReviewPayload(submission);

  const data = await request(`/api/submissions/${encodeURIComponent(submissionId)}`, {
    method: "PATCH",
    body: JSON.stringify({
      teacher_review: teacherReview,
      status: submissionStatus,
      draft_text: submission.draftText,
      final_text: submission.finalText,
      submitted_at: submission.submittedAt,
      ...(submission.attemptReset === true
        ? {
            self_assessment: {},
            writing_events: [],
            keystroke_log: [],
            feedback_history: [],
            fluency_summary: {
              attemptBaseText: submission.draftText || "",
              attemptStartedAt: submission.reopenedAt || new Date().toISOString(),
            },
          }
        : {}),
    }),
  });
  return normalizeSubmission(data.submission);
}

function normalizeRubric(row = {}) {
  const schema = row.rubric_schema || row.rubricSchema || row;
  return {
    ...schema,
    id: row.id || schema.id,
    title: row.title || schema.title || "Untitled rubric",
    status: row.status || schema.status || "Active",
    createdAt: row.created_at || schema.createdAt,
    updatedAt: row.updated_at || schema.updatedAt,
  };
}

export async function getTeacherRubrics() {
  const data = await request("/api/rubrics");
  return (Array.isArray(data.rubrics) ? data.rubrics : []).map(normalizeRubric);
}

export async function getAssignmentBuilderDraft() {
  const data = await request("/api/assignment-builder-draft");
  return data.draft || null;
}

export async function saveAssignmentBuilderDraft(draft) {
  return request("/api/assignment-builder-draft", {
    method: "PUT",
    body: JSON.stringify({ draft }),
  });
}

export async function clearAssignmentBuilderDraft() {
  return request("/api/assignment-builder-draft", { method: "DELETE" });
}

export async function createTeacherRubric(rubric) {
  const data = await request("/api/rubrics", {
    method: "POST",
    body: JSON.stringify({
      title: rubric.title,
      status: String(rubric.status || "active").toLowerCase(),
      rubric_schema: rubric,
    }),
  });
  return normalizeRubric(data.rubric);
}

export async function updateTeacherRubric(rubric) {
  const data = await request(`/api/rubrics/${encodeURIComponent(rubric.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: rubric.title,
      status: String(rubric.status || "active").toLowerCase(),
      rubric_schema: rubric,
    }),
  });
  return normalizeRubric(data.rubric);
}

export async function removeTeacherRubric(rubricId) {
  return request(`/api/rubrics/${encodeURIComponent(rubricId)}`, {
    method: "DELETE",
  });
}

export async function getOrCreateMySubmission(assignmentId) {
  const data = await request(
    `/api/assignments/${encodeURIComponent(assignmentId)}/my-submission`
  );
  return normalizeSubmission(data.submission);
}

function valuesMatch(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function buildIncrementalSubmissionPayload(submission, baseline = {}) {
  const payload = submissionPayload(submission);
  const baselinePayload = submissionPayload(baseline);
  const currentPayload = { ...payload };

  for (const key of Object.keys(payload)) {
    if (key !== "expected_updated_at" && valuesMatch(payload[key], baselinePayload[key])) {
      delete payload[key];
    }
  }

  const appendOnlyFields = [
    ["writing_events", "writing_events_append", "writing_events_base"],
    ["keystroke_log", "keystroke_log_append", "keystroke_log_base"],
  ];
  for (const [field, appendField, baseField] of appendOnlyFields) {
    const current = Array.isArray(currentPayload[field])
      ? currentPayload[field]
      : [];
    const previous = Array.isArray(baselinePayload[field]) ? baselinePayload[field] : [];
    const prefixMatches = previous.every((entry, index) => valuesMatch(entry, current[index]));
    if (current.length >= previous.length && prefixMatches) {
      delete payload[field];
      if (current.length > previous.length) {
        payload[appendField] = current.slice(previous.length);
        payload[baseField] = previous.length;
      }
    }
  }

  return payload;
}

export async function saveMySubmission(submission, baseline = {}) {
  if (!submission?.id) {
    throw new Error("A database submission id is required before autosave.");
  }
  const path = `/api/submissions/${encodeURIComponent(submission.id)}`;
  let data;
  try {
    data = await request(path, {
      method: "PATCH",
      body: JSON.stringify(buildIncrementalSubmissionPayload(submission, baseline)),
    });
  } catch (error) {
    if (!error?.conflict) throw error;
    data = await request(path, {
      method: "PATCH",
      body: JSON.stringify(submissionPayload({
        ...submission,
        updatedAt:
          error.updatedAt ||
          error.updated_at ||
          submission.updatedAt,
      })),
    });
  }
  return normalizeSubmission(data.submission);
}

export async function submitMyAssignment(assignmentId, submission) {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), 30000);
  try {
    const data = await request(`/api/assignments/${encodeURIComponent(assignmentId)}/submit`, {
      method: "POST",
      headers: { "Idempotency-Key": submission.idempotencyKey || crypto.randomUUID() },
      body: JSON.stringify(submissionPayload(submission)),
      signal: controller.signal,
    });
    return normalizeSubmission(data.submission);
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}
import { requestJson } from "./auth.js";
