import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import { TeacherWorkspaceContext } from "./TeacherWorkspaceContextBase";

import {
  getPraxisData,
  savePraxisData,
} from "../services/praxisMockStore";
import {
  getTeacherCourses,
} from "../services/courseApi";
import {
  createAssignment as createPersistedAssignment,
  createTeacherRubric,
  getAssignmentsForClass,
  getTeacherRubrics,
  getTeacherSubmissions,
  getTeacherSubmissionsForClass,
  removeAssignment as removePersistedAssignment,
  removeTeacherRubric,
  updateSubmissionAsTeacher,
  updateAssignment as updatePersistedAssignment,
  updateTeacherRubric,
} from "../services/teacherApi";
import { queryClient, queryKeys } from "../queryClient";

/* =====================================================
   RUBRIC HELPERS
===================================================== */

function createId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function roundToHalf(value) {
  return Math.round(Number(value || 0) * 2) / 2;
}

function calculateRubricTotal(criteria = []) {
  return criteria.reduce(
    (sum, criterion) => sum + Number(criterion.points || 0),
    0
  );
}

function buildDefaultBands(points = 0) {
  const max = Number(points || 0);

  return [
    {
      id: "excellent",
      label: "Excellent",
      points: roundToHalf(max),
      description:
        "Strong performance that fully meets the criterion expectations.",
    },
    {
      id: "good",
      label: "Good",
      points: roundToHalf(max * 0.85),
      description:
        "Clear performance with minor gaps or areas that could be strengthened.",
    },
    {
      id: "satisfactory",
      label: "Satisfactory",
      points: roundToHalf(max * 0.7),
      description:
        "Acceptable performance that meets the basic expectations.",
    },
    {
      id: "needs-work",
      label: "Needs Work",
      points: roundToHalf(max * 0.5),
      description:
        "Partial performance with important missing or underdeveloped elements.",
    },
    {
      id: "beginning",
      label: "Beginning",
      points: roundToHalf(max * 0.3),
      description:
        "Limited performance that needs major revision or support.",
    },
  ];
}

function normalizeRubricBands(bands = [], maxPoints = 0) {
  if (!Array.isArray(bands) || bands.length === 0) {
    return buildDefaultBands(maxPoints);
  }

  return bands.map((band, index) => ({
    id: band.id || `band_${index + 1}`,
    label: band.label || band.name || `Level ${index + 1}`,
    points: roundToHalf(
      band.points ??
        band.score ??
        band.value ??
        Number(maxPoints || 0)
    ),
    description:
      band.description ||
      band.feedback ||
      band.descriptor ||
      "",
  }));
}

function normalizeCriterion(criterion = {}, index = 0) {
  const points = Number(
    criterion.points ??
      criterion.maxPoints ??
      criterion.weight ??
      0
  );

  return {
    id: criterion.id || `criterion_${createId()}_${index}`,
    name: criterion.name || criterion.title || `Criterion ${index + 1}`,
    description:
      criterion.description ||
      criterion.guidelines ||
      criterion.descriptor ||
      "",
    points,
    bands: normalizeRubricBands(
      criterion.bands || criterion.levels || [],
      points
    ),
  };
}

function normalizeRubricSchema(rubricData = {}) {
  const criteria = Array.isArray(rubricData.criteria)
    ? rubricData.criteria.map(normalizeCriterion)
    : [];

  return {
    id: rubricData.id || createId(),

    title:
      rubricData.title ||
      rubricData.name ||
      "Untitled Rubric",

    assignmentId:
      rubricData.assignmentId ??
      rubricData.assignment_id ??
      null,

    assignmentTitle:
      rubricData.assignmentTitle ||
      rubricData.assignment_title ||
      "",

    source:
      rubricData.source ||
      "manual",

    status:
      rubricData.status ||
      "Draft",

    criteria,

    totalPoints:
      rubricData.totalPoints ||
      calculateRubricTotal(criteria),

    uploadedRubricName:
      rubricData.uploadedRubricName ||
      rubricData.uploaded_rubric_name ||
      "",

    uploadedRubricText:
      rubricData.uploadedRubricText ||
      rubricData.uploaded_rubric_text ||
      "",

    createdAt:
      rubricData.createdAt ||
      todayDate(),

    updatedAt:
      todayDate(),
  };
}

function upsertRubric(list = [], rubric) {
  const exists = list.some(
    (item) => String(item.id) === String(rubric.id)
  );

  if (exists) {
    return list.map((item) =>
      String(item.id) === String(rubric.id)
        ? rubric
        : item
    );
  }

  return [...list, rubric];
}

function buildAttachedRubricSchema({
  assignmentData,
  assignmentId,
  assignmentTitle,
  rubrics,
}) {
  if (
    assignmentData.rubricSource === "skip" ||
    assignmentData.rubricSkipped === true
  ) {
    return null;
  }

  const existingAttachedRubric =
    assignmentData.rubricSchema || null;

  const selectedLibraryRubric = assignmentData.rubricId
    ? rubrics.find(
        (rubric) =>
          String(rubric.id) === String(assignmentData.rubricId)
      )
    : null;

  const baseRubric =
    existingAttachedRubric ||
    selectedLibraryRubric ||
    assignmentData.rubric ||
    null;

  if (!baseRubric) return null;

  const isSameAttachedRubric =
    existingAttachedRubric?.id &&
    String(existingAttachedRubric.assignmentId) ===
      String(assignmentId);

  const rubricId = isSameAttachedRubric
    ? existingAttachedRubric.id
    : createId();

  return normalizeRubricSchema({
    ...baseRubric,
    id: rubricId,
    assignmentId,
    assignmentTitle,
    source:
      assignmentData.rubricSource ||
      baseRubric.source ||
      (selectedLibraryRubric ? "saved" : "manual"),
    status:
      assignmentData.rubricStatus ||
      baseRubric.status ||
      "Active",
    uploadedRubricName:
      assignmentData.uploadedRubricName ||
      baseRubric.uploadedRubricName ||
      "",
    uploadedRubricText:
      assignmentData.uploadedRubricText ||
      baseRubric.uploadedRubricText ||
      "",
  });
}

function countWords(text = "") {
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function hasSubmissionEvidence(submission = {}) {
  return Boolean(
    submission.submittedAt ||
      submission.resubmittedAt ||
      String(
        submission.submittedText ||
          submission.submissionText ||
          submission.finalText ||
          submission.content ||
          ""
      ).trim()
  );
}

function getSubmissionStudentKey(submission = {}) {
  return String(
    submission.studentEmail ||
      submission.userEmail ||
      submission.student?.email ||
      submission.id ||
      "student"
  )
    .trim()
    .toLowerCase();
}

function countCurrentSubmittedStudents(
  assignmentId,
  records = []
) {
  const studentKeys = new Set();

  safeArray(records).forEach((submission) => {
    if (
      String(submission.assignmentId) !==
      String(assignmentId)
    ) {
      return;
    }

    if (submission.isCurrent === false) {
      return;
    }

    const status = String(
      submission.status || ""
    )
      .trim()
      .toLowerCase();

    if (
      !["submitted", "late", "graded"].includes(
        status
      ) ||
      !hasSubmissionEvidence(submission)
    ) {
      return;
    }

    studentKeys.add(
      getSubmissionStudentKey(submission)
    );
  });

  return studentKeys.size;
}

function buildArchivedSubmissionRecord(
  submission = {},
  archivedAt
) {
  return {
    ...clonePlainData(submission),
    archivedAt,
    archiveReason: "assignment_deleted",
    originalStudentEmail:
      submission.studentEmail || null,
    studentName: "Archived Student",
    studentEmail: null,
    userEmail: null,
    student: null,
    profile: null,
  };
}

function getSubmissionRecordText(submission = {}) {
  return String(
    submission.finalText ||
      submission.submittedText ||
      submission.submissionText ||
      submission.content ||
      submission.draftText ||
      submission.text ||
      submission.essay ||
      submission.response ||
      submission.finalSubmission ||
      submission.submission?.content ||
      submission.submission?.text ||
      ""
  ).trim();
}

function getSubmissionRecordKey(submission = {}, fallbackIndex = 0) {
  return String(
    submission.id ||
      [
        submission.assignmentId ||
          submission.assignment?.id ||
          submission.assignmentDetails?.id ||
          "assignment",
        submission.studentEmail ||
          submission.userEmail ||
          submission.student?.email ||
          "student",
        submission.attemptNumber || fallbackIndex,
      ].join("::")
  );
}

function mergeSubmissionRecord(baseRecord = {}, incomingRecord = {}) {
  const baseText = getSubmissionRecordText(baseRecord);
  const incomingText = getSubmissionRecordText(incomingRecord);
  const preservedText = incomingText || baseText;

  const merged = {
    ...baseRecord,
    ...incomingRecord,
  };

  /*
   * Background synchronization returns compact submission summaries. Preserve
   * details already loaded into the review workspace; empty normalized arrays
   * from a summary must not erase AI history or writing replay evidence.
   */
  if (incomingRecord.detailLoaded === false) {
    /*
     * A compact polling response must not downgrade a submission that has
     * already been hydrated for the open review workspace. Downgrading this
     * flag makes the modal briefly render the compact record and fetch the
     * same details again on every poll, which visibly flickers the screen.
     */
    if (baseRecord.detailLoaded === true) {
      merged.detailLoaded = true;
    }

    [
      "writingEvents",
      "writingReplay",
      "writingHistory",
      "feedbackHistory",
      "aiFeedbackHistory",
      "studentAiFeedbackHistory",
      "draftFeedbackHistory",
      "chatHistory",
      "planningChat",
      "planningMessages",
      "planningChatMessages",
      "planningCoachHistory",
      "coachChatHistory",
      "ideaResponses",
      "keystrokeLog",
      "integrityLogs",
      "copyPasteLogs",
      "focusLossLogs",
    ].forEach((field) => {
      if (
        Array.isArray(baseRecord[field]) &&
        baseRecord[field].length > 0 &&
        (!Array.isArray(incomingRecord[field]) ||
          incomingRecord[field].length === 0)
      ) {
        merged[field] = baseRecord[field];
      }
    });
  }

  /*
    Review payloads and stale state objects may omit the essay fields.
    Never allow those partial objects to erase an existing student submission.
  */
  if (preservedText) {
    merged.content =
      incomingRecord.content ||
      baseRecord.content ||
      preservedText;

    merged.draftText =
      incomingRecord.draftText ||
      baseRecord.draftText ||
      preservedText;

    merged.submittedText =
      incomingRecord.submittedText ||
      baseRecord.submittedText ||
      preservedText;

    merged.finalText =
      incomingRecord.finalText ||
      baseRecord.finalText ||
      preservedText;

    merged.text =
      incomingRecord.text ||
      baseRecord.text ||
      preservedText;
  }

  return merged;
}

/*
  Records in primaryRecords win over matching records in fallbackRecords.
  This lets persisted student submissions remain authoritative while still
  preserving useful fields that exist only in current React state.
*/
function mergeSubmissionCollections(
  primaryRecords = [],
  fallbackRecords = []
) {
  const recordsByKey = new Map();

  safeArray(fallbackRecords).forEach((submission, index) => {
    if (!submission) return;

    recordsByKey.set(
      getSubmissionRecordKey(submission, index),
      submission
    );
  });

  safeArray(primaryRecords).forEach((submission, index) => {
    if (!submission) return;

    const key = getSubmissionRecordKey(submission, index);
    const previous = recordsByKey.get(key) || {};

    recordsByKey.set(
      key,
      mergeSubmissionRecord(previous, submission)
    );
  });

  return Array.from(recordsByKey.values());
}


function getAssignmentDeadlineDate(
  assignment = {}
) {
  const rawDate =
    assignment.dueDate ||
    assignment.deadline ||
    assignment.dueAt ||
    null;

  if (!rawDate) return null;

  const explicitTime =
    assignment.dueTime ||
    assignment.deadlineTime ||
    assignment.timeDue ||
    "";

  const rawText =
    String(rawDate).trim();

  const datePartMatch =
    rawText.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  const datePart =
    datePartMatch?.[1] || null;

  /*
    When a separate due time exists, combine it with the calendar date.
  */
  if (
    datePart &&
    String(explicitTime).trim()
  ) {
    const normalizedTime =
      String(explicitTime)
        .trim()
        .slice(0, 8);

    const combined =
      new Date(
        `${datePart}T${normalizedTime}`
      );

    return Number.isNaN(
      combined.getTime()
    )
      ? null
      : combined;
  }

  /*
    Date inputs are often serialized as:
      YYYY-MM-DD
      YYYY-MM-DDT00:00:00
      YYYY-MM-DDT00:00:00.000Z

    Without an explicit due time, these all mean the assignment remains
    open through the end of the selected calendar day.
  */
  const isDateOnly =
    /^\d{4}-\d{2}-\d{2}$/.test(
      rawText
    );

  const isSerializedMidnight =
    /^\d{4}-\d{2}-\d{2}T00:00(?::00(?:\.000)?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(
      rawText
    );

  if (
    datePart &&
    (isDateOnly ||
      isSerializedMidnight)
  ) {
    const endOfDay =
      new Date(
        `${datePart}T23:59:59.999`
      );

    return Number.isNaN(
      endOfDay.getTime()
    )
      ? null
      : endOfDay;
  }

  const parsed =
    new Date(rawDate);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

function repairFalseLateStatuses(
  data = {}
) {
  const assignmentsById =
    new Map(
      safeArray(
        data.assignments
      ).map((assignment) => [
        String(assignment.id),
        assignment,
      ])
    );

  let changed = false;

  const repairedSubmissions =
    safeArray(
      data.submissions
    ).map((submission) => {
      if (
        String(
          submission.status || ""
        ).toLowerCase() !== "late" ||
        !submission.submittedAt
      ) {
        return submission;
      }

      const assignment =
        assignmentsById.get(
          String(
            submission.assignmentId
          )
        );

      const deadline =
        getAssignmentDeadlineDate(
          assignment || {}
        );

      if (!deadline) {
        return submission;
      }

      const submittedAt =
        new Date(
          submission.submittedAt
        );

      if (
        Number.isNaN(
          submittedAt.getTime()
        ) ||
        submittedAt.getTime() >
          deadline.getTime()
      ) {
        return submission;
      }

      changed = true;

      return {
        ...submission,
        status: "Submitted",
        late: false,
        isLate: false,
        correctedFromLateAt:
          new Date().toISOString(),
      };
    });

  return {
    data: changed
      ? {
          ...data,
          submissions:
            repairedSubmissions,
        }
      : data,
    changed,
  };
}

function clonePlainData(value) {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function buildPreviousTeacherReviewSnapshot(
  submission = {},
  submittedText = ""
) {
  const exactText =
    submittedText ||
    getSubmissionRecordText(submission);

  return {
    sourceSubmissionId:
      submission.id || null,

    attemptNumber:
      Number(submission.attemptNumber || 1),

    status:
      submission.status || null,

    assignmentId:
      submission.assignmentId || null,

    assignmentTitle:
      submission.assignmentTitle || "",

    submittedAt:
      submission.submittedAt || null,

    resubmittedAt:
      submission.resubmittedAt || null,

    finalText: exactText,
    submittedText: exactText,
    content: exactText,
    draftText: exactText,
    text: exactText,

    wordCount:
      submission.wordCount ||
      countWords(exactText),

    score:
      submission.score ?? null,

    feedback:
      submission.feedback || "",

    annotations:
      clonePlainData(
        safeArray(submission.annotations)
      ),

    rubricId:
      submission.rubricId || null,

    rubricTitle:
      submission.rubricTitle || null,

    rubricScores:
      clonePlainData(
        submission.rubricScores || {}
      ),

    rubricTotal:
      submission.rubricTotal || null,

    rubricCalculatedScore:
      submission.rubricCalculatedScore ??
      null,

    rubricOverride:
      Boolean(submission.rubricOverride),

    reviewedAt:
      submission.reviewedAt || null,
  };
}

function buildReopenSnapshot(submission = {}) {
  const {
    reopenSnapshot,
    reopenPending,
    revisionRequestedAt,
    revisionMessage,
    reopenedAt,
    reopenedBy,
    ...snapshot
  } = submission;

  return clonePlainData(snapshot);
}

function isLegacyPhantomReopenAttempt(
  submission = {}
) {
  return (
    String(
      submission.status || ""
    ).toLowerCase() === "reopened" &&
    submission.isCurrent !== false &&
    !submission.submittedAt &&
    Boolean(submission.previousSubmissionId) &&
    Number(submission.attemptNumber || 1) > 1
  );
}

/*
  Earlier reopen logic created a new Attempt 2 immediately.
  That record was only an editable revision workspace, not a real
  student resubmission. Collapse it back into the source attempt.
*/
function repairLegacyReopenedAttempts(
  records = []
) {
  const list = safeArray(records).filter(Boolean);
  const byId = new Map(
    list.map((submission) => [
      String(submission.id),
      submission,
    ])
  );

  const removedIds = new Set();
  const replacements = new Map();
  const reopenedGroups = new Set();
  let changed = false;

  list.forEach((phantom) => {
    if (
      !isLegacyPhantomReopenAttempt(
        phantom
      )
    ) {
      return;
    }

    const source = byId.get(
      String(
        phantom.previousSubmissionId
      )
    );

    if (!source) return;

    const originalText =
      getSubmissionRecordText(source);

    const revisionText =
      getSubmissionRecordText(phantom) ||
      originalText;

    const groupKey = [
      source.assignmentId || "",
      String(
        source.studentEmail || ""
      ).toLowerCase(),
    ].join("::");

    const reopenedSource = {
      ...source,
      ...phantom,

      id: source.id,

      attemptNumber:
        Number(source.attemptNumber || 1),

      previousSubmissionId:
        source.previousSubmissionId ||
        null,

      revisionSourceSubmissionId:
        source.id,

      status: "Reopened",
      isCurrent: true,
      reopenPending: true,

      submittedAt:
        source.submittedAt || null,

      resubmittedAt:
        source.resubmittedAt || null,

      createdAt:
        source.createdAt ||
        phantom.createdAt,

      content: revisionText,
      draftText: revisionText,
      submittedText: revisionText,
      finalText: revisionText,
      text: revisionText,

      wordCount:
        countWords(revisionText),

      previousTeacherReview:
        phantom.previousTeacherReview ||
        buildPreviousTeacherReviewSnapshot(
          source,
          originalText
        ),

      reopenSnapshot:
        phantom.reopenSnapshot ||
        buildReopenSnapshot(source),

      reopenedAt:
        phantom.reopenedAt ||
        new Date().toISOString(),

      updatedAt:
        phantom.updatedAt ||
        new Date().toISOString(),
    };

    replacements.set(
      String(source.id),
      reopenedSource
    );

    removedIds.add(
      String(phantom.id)
    );

    reopenedGroups.add(groupKey);
    changed = true;
  });

  if (!changed) {
    return {
      submissions: list,
      changed: false,
    };
  }

  const repaired = list
    .filter(
      (submission) =>
        !removedIds.has(
          String(submission.id)
        )
    )
    .map((submission) => {
      const replacement =
        replacements.get(
          String(submission.id)
        );

      if (replacement) {
        return replacement;
      }

      const groupKey = [
        submission.assignmentId || "",
        String(
          submission.studentEmail || ""
        ).toLowerCase(),
      ].join("::");

      if (
        reopenedGroups.has(groupKey)
      ) {
        return {
          ...submission,
          isCurrent: false,
        };
      }

      return submission;
    });

  return {
    submissions: repaired,
    changed: true,
  };
}

function getRepairedPraxisData() {
  const originalData =
    getPraxisData();

  const attemptRepair =
    repairLegacyReopenedAttempts(
      originalData.submissions || []
    );

  const attemptRepairedData = {
    ...originalData,
    submissions:
      attemptRepair.submissions,
  };

  const lateRepair =
    repairFalseLateStatuses(
      attemptRepairedData
    );

  const nextData =
    lateRepair.data;

  if (
    attemptRepair.changed ||
    lateRepair.changed
  ) {
    savePraxisData(nextData);
  }

  return nextData;
}

function notifyPraxisDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("praxis-data-changed"));
  }
}


function normalizeComparable(value) {
  return String(value ?? "").trim().toLowerCase();
}

function resolveAssignmentClass(classes = [], assignmentData = {}) {
  const requestedId =
    assignmentData.classId ??
    assignmentData.courseId ??
    null;

  const requestedCode =
    assignmentData.classCode ||
    assignmentData.courseCode ||
    assignmentData.course ||
    "";

  const requestedName =
    assignmentData.className ||
    assignmentData.courseName ||
    assignmentData.course ||
    "";

  return (
    classes.find((cls) => {
      const sameId =
        requestedId !== null &&
        requestedId !== undefined &&
        cls?.id !== null &&
        cls?.id !== undefined &&
        String(cls.id) === String(requestedId);

      const sameCode =
        requestedCode &&
        cls?.code &&
        normalizeComparable(cls.code) === normalizeComparable(requestedCode);

      const sameName =
        requestedName &&
        cls?.name &&
        normalizeComparable(cls.name) === normalizeComparable(requestedName);

      return sameId || sameCode || sameName;
    }) || null
  );
}

function getAssignmentCriteriaCount(assignment = {}) {
  const schemaCriteria = Array.isArray(assignment?.rubricSchema?.criteria)
    ? assignment.rubricSchema.criteria
    : [];

  if (schemaCriteria.length > 0) {
    return schemaCriteria.length;
  }

  const rubricCriteria = Array.isArray(assignment?.rubric)
    ? assignment.rubric
    : [];

  return rubricCriteria.length;
}

function isAssignmentComplete(assignment = {}) {
  const title = String(assignment.title || "").trim();
  const description = String(
    assignment.description || assignment.instructions || ""
  ).trim();
  const dueDate = String(assignment.dueDate || assignment.deadline || "").trim();
  const level = String(
    assignment.studentLevel || assignment.languageLevel || ""
  ).trim();
  const type = String(
    assignment.assignmentType || assignment.assignment_type || ""
  ).trim();

  const minWords = Number(
    assignment.minWords ?? assignment.wordCountMin ?? assignment.word_count_min ?? 0
  );
  const maxWords = Number(
    assignment.maxWords ?? assignment.wordCountMax ?? assignment.word_count_max ?? 0
  );

  const hasClass = Boolean(
    assignment.classId ||
      String(assignment.classCode || "").trim() ||
      String(assignment.className || "").trim()
  );

  return Boolean(
    title &&
      title.toLowerCase() !== "untitled draft assignment" &&
      description &&
      dueDate &&
      level &&
      type &&
      hasClass &&
      minWords > 0 &&
      maxWords >= minWords &&
      getAssignmentCriteriaCount(assignment) > 0
  );
}

function persistTeacherCollections({
  classes,
  assignments,
  rubrics,
}) {
  const currentData = getPraxisData();

  /*
    Assignment and rubric changes must never write a possibly stale instructor
    submissions array over newer student submissions in the shared store.
  */
  savePraxisData({
    ...currentData,
    classes,
    assignments,
    rubrics,
    submissions: safeArray(currentData.submissions),
  });

  notifyPraxisDataChanged();
}

/* =====================================================
   PROVIDER
===================================================== */

export function TeacherWorkspaceProvider({ children }) {
  /* =====================================================
     NAVIGATION
  ===================================================== */

  const [view, setView] = useState("list");

  /* =====================================================
     SHARED DATA FROM LOCAL STORE
  ===================================================== */

  // Authenticated teacher collections are backend-authoritative. Starting
  // from the browser-wide recovery store can expose the previous account's
  // workspace while the scoped API request is loading.
  const [classes, setClasses] = useState([]);

  const [assignments, setAssignments] = useState([]);

  const [submissions, setSubmissions] = useState([]);

  const [rubrics, setRubrics] = useState([]);
  const [isWorkspaceLoading, setIsWorkspaceLoading] = useState(true);
  const assignmentStatusRequestsRef = useRef(new Map());

  useEffect(() => {
    let active = true;

    async function syncCoursesWithBackend() {
      try {
        const backendCourses = await queryClient.fetchQuery({
          queryKey: queryKeys.teacherCourses,
          queryFn: getTeacherCourses,
        });
        const displayedCourses = backendCourses;

        const [assignmentGroups, rawSubmissionGroups] = await Promise.all([
          Promise.all(
            displayedCourses.map(async (course) => {
              const backendClassId = course.backendId || course.id;
              const rows = await queryClient.fetchQuery({
                queryKey: queryKeys.classAssignments(backendClassId),
                queryFn: () => getAssignmentsForClass(backendClassId),
              });
              return rows.map((assignment) => ({
                ...assignment,
                classId: course.id,
                backendClassId,
                classCode: course.code || "",
                className: course.name || "",
              }));
            })
          ),
          Promise.all(
            displayedCourses.map(async (course) => {
              const backendClassId = course.backendId || course.id;
              const rows = await queryClient.fetchQuery({
                queryKey: queryKeys.teacherSubmissions(backendClassId),
                queryFn: () => getTeacherSubmissionsForClass(backendClassId),
              });
              return { course, rows };
            })
          ),
        ]);
        const flattenedAssignments = assignmentGroups.flat();
        const submissionGroups = rawSubmissionGroups.map(({ course, rows }) =>
          rows.map((submission) => {
            const assignment = flattenedAssignments.find(
              (entry) => String(entry.id) === String(submission.assignmentId)
            );
            return {
              ...submission,
              assignment,
              assignmentDetails: assignment,
              assignmentTitle: assignment?.title || "",
              classId: course.id,
              classCode: course.code || "",
              className: course.name || "",
              isCurrent: true,
            };
          })
        );

        if (active) {
          setClasses(displayedCourses);
          setAssignments(assignmentGroups.flat());
          setSubmissions(submissionGroups.flat());
        }
        queryClient.fetchQuery({
          queryKey: queryKeys.teacherRubrics,
          queryFn: getTeacherRubrics,
        })
          .then((rows) => {
            if (active) setRubrics(rows.map(normalizeRubricSchema));
          })
          .catch((error) => {
            console.error("Could not synchronize reusable rubrics with Supabase:", error);
          });
      } catch (error) {
        // Keep the local workspace usable when Supabase is temporarily unavailable.
        console.error("Could not synchronize courses with Supabase:", error);
      } finally {
        if (active) setIsWorkspaceLoading(false);
      }
    }

    syncCoursesWithBackend();
    return () => {
      active = false;
    };
  }, []);

  /*
   * The application authenticates through the server's secure session cookie,
   * so the browser cannot safely subscribe to Supabase tables directly.
   * Refresh the compact, teacher-scoped submission feed while the workspace is
   * visible. One consolidated request avoids the previous per-course N+1 load.
   */
  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshSubmissionFeed() {
      if (
        !active ||
        refreshing ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      refreshing = true;
      try {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.allTeacherSubmissions,
        });
        const rows = await queryClient.fetchQuery({
          queryKey: queryKeys.allTeacherSubmissions,
          queryFn: getTeacherSubmissions,
          staleTime: 0,
        });

        if (active) {
          setSubmissions((current) =>
            mergeSubmissionCollections(rows, current)
          );
        }
      } catch {
        // Keep the last confirmed workspace visible during transient outages.
      } finally {
        refreshing = false;
      }
    }

    const intervalId = window.setInterval(
      refreshSubmissionFeed,
      2000
    );
    window.addEventListener("focus", refreshSubmissionFeed);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshSubmissionFeed);
    };
  }, []);

  /* =====================================================
     CURRENT ASSIGNMENT / FILTERS
  ===================================================== */

  const [selectedAssignment, setSelectedAssignment] = useState(null);

  const [submissionFilterAssignment, setSubmissionFilterAssignment] =
    useState(null);

  /* =====================================================
     SAVE TEACHER DATA TO SHARED STORE
  ===================================================== */

  useEffect(() => {
    const currentData = getPraxisData();

    /*
      Submissions are intentionally excluded here. A student may have written
      a newer submission into the shared store while this provider still holds
      an older in-memory array. Persisting that old array would erase the
      student's work.
    */
    savePraxisData({
      ...currentData,
      classes,
      assignments,
      rubrics,
      submissions: safeArray(currentData.submissions),
    });
  }, [classes, assignments, rubrics]);

  /* =====================================================
     ASSIGNMENT ACTIONS
  ===================================================== */

  async function addAssignment(assignmentData) {
    const selectedClass = resolveAssignmentClass(classes, assignmentData);

    if (!selectedClass) {
      console.error(
        "Cannot create assignment: the selected course/class could not be resolved.",
        assignmentData
      );
      return null;
    }

    const now = nowIso();
    const assignmentId = createId();

    const attachedRubric = buildAttachedRubricSchema({
      assignmentData,
      assignmentId,
      assignmentTitle: assignmentData.title,
      rubrics,
    });

    const normalizedStatus =
      String(assignmentData.status || "Draft").toLowerCase() === "published"
        ? "Published"
        : "Draft";

    let newAssignment = {
      ...assignmentData,

      id: assignmentId,

      title: assignmentData.title?.trim() || "Untitled Assignment",

      instructions:
        assignmentData.instructions ||
        assignmentData.description ||
        "",

      description:
        assignmentData.description ||
        assignmentData.instructions ||
        "",

      classId: selectedClass.id,
      classCode: selectedClass.code || "",
      className: selectedClass.name || "",

      dueDate: assignmentData.dueDate || null,

      status: normalizedStatus,

      minWords: Number(
        assignmentData.minWords ??
          assignmentData.wordCountMin ??
          0
      ),

      maxWords: Number(
        assignmentData.maxWords ??
          assignmentData.wordCountMax ??
          0
      ),

      allowAI: assignmentData.allowAI ?? true,
      aiFeedback: assignmentData.aiFeedback ?? true,
      writingPlayback: assignmentData.writingPlayback ?? true,

      rubricId: attachedRubric?.id || null,
      rubricTitle: attachedRubric?.title || "",
      rubricSource: attachedRubric?.source || "none",
      rubricSchema: attachedRubric,
      uploadedRubricName: attachedRubric?.uploadedRubricName || "",
      uploadedRubricText: attachedRubric?.uploadedRubricText || "",

      submissionsCount: Number(assignmentData.submissionsCount || 0),

      createdAt: now,
      updatedAt: now,

      publishedAt:
        normalizedStatus === "Published"
          ? now
          : null,

      archived: false,
    };

    const persisted = await createPersistedAssignment(
      selectedClass.backendId || selectedClass.id,
      newAssignment
    );
    await queryClient.invalidateQueries({
      queryKey: queryKeys.classAssignments(selectedClass.backendId || selectedClass.id),
    });
    newAssignment = {
      ...newAssignment,
      ...persisted,
      id: persisted.id,
      classId: selectedClass.id,
      backendClassId: selectedClass.backendId || selectedClass.id,
      classCode: selectedClass.code || "",
      className: selectedClass.name || "",
    };

    setAssignments((prev) => {
      const nextAssignments = [...prev, newAssignment];

      persistTeacherCollections({
        classes,
        assignments: nextAssignments,
        submissions,
        rubrics: attachedRubric
          ? upsertRubric(rubrics, attachedRubric)
          : rubrics,
      });

      return nextAssignments;
    });

    if (attachedRubric) {
      setRubrics((prev) =>
        upsertRubric(prev, attachedRubric)
      );
    }

    setSelectedAssignment(newAssignment);
    setView("list");

    return newAssignment;
  }

  async function updateAssignment(updatedAssignment) {
    const existingAssignment = assignments.find(
      (item) => String(item.id) === String(updatedAssignment.id)
    );

    const selectedClass = resolveAssignmentClass(classes, {
      ...existingAssignment,
      ...updatedAssignment,
    });

    if (!selectedClass) {
      console.error(
        "Cannot update assignment: the selected course/class could not be resolved.",
        updatedAssignment
      );
      return null;
    }

    const now = nowIso();

    const attachedRubric = buildAttachedRubricSchema({
      assignmentData: updatedAssignment,
      assignmentId: updatedAssignment.id,
      assignmentTitle: updatedAssignment.title,
      rubrics,
    });

    const normalizedStatus =
      String(updatedAssignment.status || existingAssignment?.status || "Draft")
        .toLowerCase() === "published"
        ? "Published"
        : "Draft";

    let assignment = {
      ...existingAssignment,
      ...updatedAssignment,

      instructions:
        updatedAssignment.instructions ||
        updatedAssignment.description ||
        existingAssignment?.instructions ||
        "",

      description:
        updatedAssignment.description ||
        updatedAssignment.instructions ||
        existingAssignment?.description ||
        "",

      classId: selectedClass.id,
      classCode: selectedClass.code || "",
      className: selectedClass.name || "",

      status: normalizedStatus,

      publishedAt:
        normalizedStatus === "Published"
          ? updatedAssignment.publishedAt ||
            existingAssignment?.publishedAt ||
            now
          : null,

      rubricId: attachedRubric?.id || null,
      rubricTitle: attachedRubric?.title || "",
      rubricSource: attachedRubric?.source || "none",
      rubricSchema: attachedRubric,
      uploadedRubricName: attachedRubric?.uploadedRubricName || "",
      uploadedRubricText: attachedRubric?.uploadedRubricText || "",

      updatedAt: now,
    };

    const persisted = await updatePersistedAssignment(
      assignment.id,
      assignment
    );
    await queryClient.invalidateQueries({
      queryKey: queryKeys.classAssignments(selectedClass.backendId || selectedClass.id),
    });
    assignment = {
      ...assignment,
      ...persisted,
      classId: selectedClass.id,
      backendClassId: selectedClass.backendId || selectedClass.id,
      classCode: selectedClass.code || "",
      className: selectedClass.name || "",
    };

    setAssignments((prev) => {
      const nextAssignments = prev.map((item) =>
        String(item.id) === String(assignment.id)
          ? assignment
          : item
      );

      persistTeacherCollections({
        classes,
        assignments: nextAssignments,
        submissions,
        rubrics: attachedRubric
          ? upsertRubric(rubrics, attachedRubric)
          : rubrics,
      });

      return nextAssignments;
    });

    if (attachedRubric) {
      setRubrics((prev) =>
        upsertRubric(prev, attachedRubric)
      );
    }

    setSelectedAssignment(assignment);
    setView("details");

    return assignment;
  }

  async function deleteAssignment(id) {
    await removePersistedAssignment(id);
    await queryClient.invalidateQueries({ queryKey: ["classes"] });
    const currentData = getPraxisData();
    const archivedAt = nowIso();

    const assignmentToArchive =
      assignments.find(
        (assignment) =>
          String(assignment.id) === String(id)
      ) ||
      safeArray(currentData.assignments).find(
        (assignment) =>
          String(assignment.id) === String(id)
      ) ||
      null;

    const completeSubmissions = mergeSubmissionCollections(
      currentData.submissions || [],
      submissions
    );

    const relatedSubmissions =
      completeSubmissions.filter(
        (submission) =>
          String(submission.assignmentId) ===
          String(id)
      );

    const relatedRubrics = safeArray(
      currentData.rubrics || rubrics
    ).filter(
      (rubric) =>
        String(rubric.assignmentId) ===
        String(id)
    );

    const nextAssignments = assignments.filter(
      (assignment) =>
        String(assignment.id) !== String(id)
    );

    const nextRubrics = rubrics.filter(
      (rubric) =>
        String(rubric.assignmentId) !== String(id)
    );

    const nextSubmissions = completeSubmissions.filter(
      (submission) =>
        String(submission.assignmentId) !== String(id)
    );

    const assignmentArchive = [
      ...safeArray(currentData.assignmentArchive),
      ...(assignmentToArchive
        ? [
            {
              ...clonePlainData(assignmentToArchive),
              archivedAt,
              archiveReason: "teacher_deleted",
            },
          ]
        : []),
    ];

    const submissionArchive = [
      ...safeArray(currentData.submissionArchive),
      ...relatedSubmissions.map((submission) =>
        buildArchivedSubmissionRecord(
          submission,
          archivedAt
        )
      ),
    ];

    const rubricArchive = [
      ...safeArray(currentData.rubricArchive),
      ...relatedRubrics.map((rubric) => ({
        ...clonePlainData(rubric),
        archivedAt,
        archiveReason: "assignment_deleted",
      })),
    ];

    setAssignments(nextAssignments);
    setRubrics(nextRubrics);
    setSubmissions(nextSubmissions);

    savePraxisData({
      ...currentData,
      assignments: nextAssignments,
      rubrics: nextRubrics,
      submissions: nextSubmissions,
      assignmentArchive,
      submissionArchive,
      rubricArchive,
    });

    notifyPraxisDataChanged();

    if (
      String(selectedAssignment?.id) ===
      String(id)
    ) {
      setSelectedAssignment(null);
      setView("list");
    }

    if (
      String(submissionFilterAssignment?.id) ===
      String(id)
    ) {
      setSubmissionFilterAssignment(null);
    }
  }

  async function toggleAssignmentStatus(id) {
    const requestKey = String(id);
    const pendingRequest = assignmentStatusRequestsRef.current.get(requestKey);
    if (pendingRequest) return pendingRequest;

    const request = (async () => {
      const original = assignments.find(
        (assignment) => String(assignment.id) === requestKey
      );
      if (!original) throw new Error("Assignment not found. Refresh and try again.");

      const wasPublished =
        String(original.status || "").toLowerCase() === "published";
      if (!wasPublished && !isAssignmentComplete(original)) {
        throw new Error("Complete all required assignment fields before publishing.");
      }

      const desiredStatus = wasPublished ? "Draft" : "Published";
      const persistStatus = async (source) => {
        const now = nowIso();
        const requested = {
          ...source,
          status: desiredStatus,
          publishedAt: desiredStatus === "Published" ? now : null,
          updatedAt: now,
        };
        const persisted = await updatePersistedAssignment(id, requested);
        return {
          ...requested,
          ...persisted,
          classId: source.classId,
          backendClassId: source.backendClassId,
          classCode: source.classCode,
          className: source.className,
        };
      };

      let next;
      try {
        next = await persistStatus(original);
      } catch (error) {
        if (!error?.conflict) throw error;

        const owningClass = resolveAssignmentClass(classes, original);
        const backendClassId =
          original.backendClassId || owningClass?.backendId || owningClass?.id;
        if (!backendClassId) throw error;

        const refreshed = await getAssignmentsForClass(backendClassId);
        const latest = refreshed.find(
          (assignment) => String(assignment.id) === requestKey
        );
        if (!latest) throw error;

        const refreshedSource = {
          ...original,
          ...latest,
          classId: original.classId,
          backendClassId,
          classCode: original.classCode,
          className: original.className,
        };
        next = await persistStatus(refreshedSource);
      }

      setAssignments((prev) =>
        prev.map((assignment) =>
          String(assignment.id) === requestKey ? next : assignment
        )
      );
      setSelectedAssignment((prev) =>
        prev && String(prev.id) === requestKey ? next : prev
      );
      return next;
    })();

    assignmentStatusRequestsRef.current.set(requestKey, request);
    try {
      return await request;
    } finally {
      assignmentStatusRequestsRef.current.delete(requestKey);
    }
  }

  function attachRubricToAssignment(assignmentId, rubricData) {
    const assignment = assignments.find(
      (item) => String(item.id) === String(assignmentId)
    );

    if (!assignment) return null;

    const attachedRubric = normalizeRubricSchema({
      ...rubricData,
      id: rubricData.id || createId(),
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
      status: rubricData.status || "Active",
    });

    setAssignments((prev) =>
      prev.map((item) =>
        String(item.id) === String(assignmentId)
          ? {
              ...item,
              rubricId: attachedRubric.id,
              rubricTitle: attachedRubric.title,
              rubricSource: attachedRubric.source,
              rubricSchema: attachedRubric,
              uploadedRubricName:
                attachedRubric.uploadedRubricName || "",
              uploadedRubricText:
                attachedRubric.uploadedRubricText || "",
              updatedAt: todayDate(),
            }
          : item
      )
    );

    setRubrics((prev) =>
      upsertRubric(prev, attachedRubric)
    );

    return attachedRubric;
  }

  function detachRubricFromAssignment(assignmentId) {
    setAssignments((prev) =>
      prev.map((item) =>
        String(item.id) === String(assignmentId)
          ? {
              ...item,
              rubricId: null,
              rubricTitle: "",
              rubricSource: "none",
              rubricSchema: null,
              uploadedRubricName: "",
              uploadedRubricText: "",
              updatedAt: todayDate(),
            }
          : item
      )
    );
  }

  /* =====================================================
     SUBMISSION ACTIONS
  ===================================================== */

  function addSubmission(submissionData) {
    const assignment = assignments.find(
      (item) =>
        String(item.id) === String(submissionData.assignmentId)
    );

    const now = new Date().toISOString();

    const requestedStatus =
      submissionData.status || "Submitted";

    const newSubmission = {
      ...submissionData,

      id: submissionData.id || createId(),

      assignmentId: submissionData.assignmentId,
      assignmentTitle:
        assignment?.title ||
        submissionData.assignmentTitle ||
        "Untitled Assignment",

      studentName:
        submissionData.studentName ||
        "Student",

      studentEmail:
        submissionData.studentEmail ||
        "student@aui.ma",

      classId:
        assignment?.classId ??
        submissionData.classId ??
        null,

      classCode:
        assignment?.classCode ||
        submissionData.classCode ||
        "",

      className:
        assignment?.className ||
        submissionData.className ||
        "",

      submittedAt:
        submissionData.submittedAt ??
        (requestedStatus === "Submitted" ||
        requestedStatus === "Late"
          ? now
          : null),

      status: requestedStatus,

      score:
        submissionData.score ?? null,

      feedback:
        submissionData.feedback || "",

      reviewedAt:
        submissionData.reviewedAt || null,

      wordCount:
        submissionData.wordCount ??
        countWords(getSubmissionRecordText(submissionData)),

      aiFlags:
        Number(submissionData.aiFlags || 0),

      content:
        getSubmissionRecordText(submissionData),

      draftText:
        submissionData.draftText ||
        getSubmissionRecordText(submissionData),

      submittedText:
        submissionData.submittedText ||
        getSubmissionRecordText(submissionData),

      finalText:
        submissionData.finalText ||
        getSubmissionRecordText(submissionData),

      text:
        submissionData.text ||
        getSubmissionRecordText(submissionData),

      annotations:
        Array.isArray(submissionData.annotations)
          ? submissionData.annotations
          : [],

      integrityLogs:
        Array.isArray(submissionData.integrityLogs)
          ? submissionData.integrityLogs
          : [],

      copyPasteLogs:
        Array.isArray(submissionData.copyPasteLogs)
          ? submissionData.copyPasteLogs
          : [],

      focusLossLogs:
        Array.isArray(submissionData.focusLossLogs)
          ? submissionData.focusLossLogs
          : [],

      writingEvents:
        Array.isArray(submissionData.writingEvents)
          ? submissionData.writingEvents
          : [],

      rubricId:
        submissionData.rubricId ||
        assignment?.rubricId ||
        null,

      rubricTitle:
        submissionData.rubricTitle ||
        assignment?.rubricTitle ||
        "",

      rubricSchema:
        submissionData.rubricSchema ||
        assignment?.rubricSchema ||
        null,

      createdAt:
        submissionData.createdAt || now,

      updatedAt: now,
    };

    setSubmissions((currentSubmissions) => {
      const currentData = getPraxisData();

      const completeSubmissions = mergeSubmissionCollections(
        currentData.submissions || [],
        currentSubmissions
      );

      const existingIndex = completeSubmissions.findIndex(
        (submission) =>
          String(submission.id) === String(newSubmission.id)
      );

      const nextSubmissions =
        existingIndex >= 0
          ? completeSubmissions.map((submission, index) =>
              index === existingIndex
                ? mergeSubmissionRecord(
                    submission,
                    newSubmission
                  )
                : submission
            )
          : [...completeSubmissions, newSubmission];

      savePraxisData({
        ...currentData,
        submissions: nextSubmissions,
      });

      notifyPraxisDataChanged();

      return nextSubmissions;
    });

    setAssignments((prev) => {
      const currentData = getPraxisData();
      const completeSubmissions = mergeSubmissionCollections(
        currentData.submissions || [],
        submissions
      );

      const nextCompleteSubmissions =
        mergeSubmissionCollections(
          [newSubmission],
          completeSubmissions
        );

      const currentStudentCount =
        countCurrentSubmittedStudents(
          submissionData.assignmentId,
          nextCompleteSubmissions
        );

      const nextAssignments = prev.map((item) =>
        String(item.id) ===
        String(submissionData.assignmentId)
          ? {
              ...item,
              submissionsCount:
                currentStudentCount,
              updatedAt: now,
            }
          : item
      );

      savePraxisData({
        ...currentData,
        assignments: nextAssignments,
      });

      notifyPraxisDataChanged();

      return nextAssignments;
    });

    return newSubmission;
  }

  async function updateSubmissionReview(id, reviewData) {
    const now = new Date().toISOString();
    const existingPersisted = submissions.find(
      (submission) => String(submission.id) === String(id)
    );
    if (existingPersisted) {
      const persisted = await updateSubmissionAsTeacher(id, {
        ...existingPersisted,
        ...reviewData,
        teacherReview:
          reviewData.teacherReview ||
          reviewData.teacher_review ||
          existingPersisted.teacherReview ||
          existingPersisted.teacher_review ||
          reviewData,
        status: reviewData.status || existingPersisted.status || "submitted",
      });
      reviewData = { ...reviewData, ...persisted };
    }

    setSubmissions((currentSubmissions) => {
      const currentData = getPraxisData();

      /*
        The persisted list is primary because it may contain a student
        submission created after this instructor provider was mounted.
      */
      const completeSubmissions = mergeSubmissionCollections(
        currentData.submissions || [],
        currentSubmissions
      );

      const existingIndex = completeSubmissions.findIndex(
        (submission) => String(submission.id) === String(id)
      );

      if (existingIndex < 0) {
        return completeSubmissions;
      }

      const existingSubmission =
        completeSubmissions[existingIndex];

      const updatedSubmission = mergeSubmissionRecord(
        existingSubmission,
        {
          ...reviewData,
          id: existingSubmission.id,

          assignmentId:
            existingSubmission.assignmentId ??
            reviewData.assignmentId,

          studentEmail:
            existingSubmission.studentEmail ||
            reviewData.studentEmail,

          studentName:
            existingSubmission.studentName ||
            reviewData.studentName,

          attemptNumber:
            existingSubmission.attemptNumber ??
            reviewData.attemptNumber ??
            1,

          isCurrent:
            existingSubmission.isCurrent ??
            reviewData.isCurrent ??
            true,

          reviewedAt:
            reviewData.reviewedAt ??
            existingSubmission.reviewedAt ??
            null,

          updatedAt: now,
        }
      );

      const nextSubmissions = completeSubmissions.map(
        (submission, index) =>
          index === existingIndex
            ? updatedSubmission
            : submission
      );

      savePraxisData({
        ...currentData,
        submissions: nextSubmissions,
      });

      notifyPraxisDataChanged();

      return nextSubmissions;
    });
  }


  async function reopenSubmission(id, options = {}) {
    const currentData =
      getRepairedPraxisData();

    const completeSubmissions =
      mergeSubmissionCollections(
        currentData.submissions || [],
        submissions
      );

    const sourceSubmission =
      completeSubmissions.find(
        (submission) =>
          String(submission.id) ===
          String(id)
      );

    if (!sourceSubmission) {
      console.error(
        "Cannot reopen submission: attempt was not found.",
        id
      );
      return null;
    }

    if (
      sourceSubmission.isCurrent === false
    ) {
      console.error(
        "Cannot reopen a previous attempt. Reopen the current/latest attempt.",
        sourceSubmission
      );
      return null;
    }

    const sourceStatus = String(
      sourceSubmission.status || ""
    ).toLowerCase();

    if (sourceStatus === "reopened") {
      return sourceSubmission;
    }

    if (
      !["submitted", "late", "graded"].includes(
        sourceStatus
      )
    ) {
      console.error(
        "Only submitted, late, or graded attempts can be reopened.",
        sourceSubmission
      );
      return null;
    }

    const revisionText =
      getSubmissionRecordText(
        sourceSubmission
      );

    if (!revisionText) {
      console.error(
        "Cannot reopen submission: no submitted text exists.",
        sourceSubmission
      );
      return null;
    }

    const now =
      new Date().toISOString();

    await updateSubmissionAsTeacher(id, {
      ...sourceSubmission,
      status: "reopened",
      teacherReview: {
        ...(sourceSubmission.teacherReview || sourceSubmission.teacher_review || {}),
        status: "reopened",
        reopenedAt: now,
        revisionMessage: options.message || options.revisionMessage || "",
      },
    });

    const previousTeacherReview =
      buildPreviousTeacherReviewSnapshot(
        sourceSubmission,
        revisionText
      );

    const reopenSnapshot =
      buildReopenSnapshot(
        sourceSubmission
      );

    const existingFeedbackHistory =
      safeArray(
        sourceSubmission.feedbackHistory
      );

    const hasSavedTeacherReview =
      existingFeedbackHistory.some(
        (item) =>
          String(
            item?.type || ""
          ).toLowerCase() ===
            "teacher_review" &&
          String(
            item?.sourceSubmissionId ||
              ""
          ) ===
            String(
              sourceSubmission.id
            )
      );

    const feedbackHistory =
      sourceSubmission.feedback &&
      !hasSavedTeacherReview
        ? [
            ...existingFeedbackHistory,
            {
              id: `teacher_review_${sourceSubmission.id}`,
              role: "teacher",
              type: "teacher_review",
              sourceSubmissionId:
                sourceSubmission.id,
              text:
                sourceSubmission.feedback,
              feedback:
                sourceSubmission.feedback,
              score:
                sourceSubmission.score ??
                null,
              annotations:
                clonePlainData(
                  safeArray(
                    sourceSubmission.annotations
                  )
                ),
              rubricScores:
                clonePlainData(
                  sourceSubmission.rubricScores ||
                    {}
                ),
              rubricTotal:
                sourceSubmission.rubricTotal ||
                null,
              reviewedAt:
                sourceSubmission.reviewedAt ||
                null,
              createdAt:
                sourceSubmission.reviewedAt ||
                now,
            },
          ]
        : existingFeedbackHistory;

    /*
      Reopen the same attempt in place.
      A new attempt is created only when the student actually resubmits.
    */
    const reopenedSubmission = {
      ...sourceSubmission,

      status: "Reopened",
      isCurrent: true,
      reopenPending: true,

      reopenedAt: now,
      reopenedBy:
        options.reopenedBy ||
        options.teacherEmail ||
        "Instructor",

      revisionRequestedAt: now,
      revisionMessage:
        options.revisionMessage || "",

      revisionSourceSubmissionId:
        sourceSubmission.id,

      previousTeacherReview,
      reopenSnapshot,
      feedbackHistory,

      content: revisionText,
      draftText: revisionText,
      submittedText: revisionText,
      finalText: revisionText,
      text: revisionText,
      wordCount:
        countWords(revisionText),

      updatedAt: now,
      lastSavedAt: now,
    };

    const nextSubmissions =
      completeSubmissions.map(
        (submission) => {
          const isSameStudentAssignment =
            String(
              submission.assignmentId
            ) ===
              String(
                sourceSubmission.assignmentId
              ) &&
            String(
              submission.studentEmail ||
                ""
            ).toLowerCase() ===
              String(
                sourceSubmission.studentEmail ||
                  ""
              ).toLowerCase();

          if (!isSameStudentAssignment) {
            return submission;
          }

          if (
            String(submission.id) ===
            String(sourceSubmission.id)
          ) {
            return reopenedSubmission;
          }

          return {
            ...submission,
            isCurrent: false,
          };
        }
      );

    savePraxisData({
      ...currentData,
      submissions: nextSubmissions,
    });

    setSubmissions(nextSubmissions);
    notifyPraxisDataChanged();

    return reopenedSubmission;
  }

  /* =====================================================
     RUBRIC ACTIONS
  ===================================================== */

  async function addRubric(rubricData) {
    let newRubric = normalizeRubricSchema({
      ...rubricData,
      id: rubricData.id || createId(),
      source: rubricData.source || "manual",
      status: rubricData.status || "Draft",
    });
    newRubric = normalizeRubricSchema(await createTeacherRubric(newRubric));
    await queryClient.invalidateQueries({ queryKey: queryKeys.teacherRubrics });

    setRubrics((prev) => [
      ...prev,
      newRubric,
    ]);

    return newRubric;
  }

  async function updateRubric(id, rubricData) {
    const existingRubric = rubrics.find(
      (rubric) => String(rubric.id) === String(id)
    );

    let updatedRubric = normalizeRubricSchema({
      ...existingRubric,
      ...rubricData,
      id,
      updatedAt: todayDate(),
    });
    updatedRubric = normalizeRubricSchema(await updateTeacherRubric(updatedRubric));
    await queryClient.invalidateQueries({ queryKey: queryKeys.teacherRubrics });

    setRubrics((prev) =>
      prev.map((rubric) =>
        String(rubric.id) === String(id)
          ? updatedRubric
          : rubric
      )
    );

    setAssignments((prev) =>
      prev.map((assignment) => {
        const assignmentUsesRubric =
          String(assignment.rubricId) === String(id) ||
          String(assignment.rubricSchema?.id) === String(id);

        if (!assignmentUsesRubric) return assignment;

        const attachedRubric = normalizeRubricSchema({
          ...updatedRubric,
          assignmentId: assignment.id,
          assignmentTitle: assignment.title,
          status: updatedRubric.status || "Active",
        });

        return {
          ...assignment,
          rubricTitle: attachedRubric.title,
          rubricSchema: attachedRubric,
          uploadedRubricName:
            attachedRubric.uploadedRubricName || "",
          uploadedRubricText:
            attachedRubric.uploadedRubricText || "",
          updatedAt: todayDate(),
        };
      })
    );

    return updatedRubric;
  }

  async function deleteRubric(id) {
    await removeTeacherRubric(id);
    await queryClient.invalidateQueries({ queryKey: queryKeys.teacherRubrics });
    setRubrics((prev) =>
      prev.filter(
        (rubric) => String(rubric.id) !== String(id)
      )
    );
  }

  async function duplicateRubric(id) {
    const rubric = rubrics.find(
      (item) => String(item.id) === String(id)
    );

    if (!rubric) return null;

    let duplicatedRubric = normalizeRubricSchema({
      ...rubric,
      id: createId(),
      title: `${rubric.title} Copy`,
      assignmentId: null,
      assignmentTitle: "",
      status: "Draft",
      source: "saved",
      createdAt: todayDate(),
      updatedAt: todayDate(),
    });
    duplicatedRubric = normalizeRubricSchema(
      await createTeacherRubric(duplicatedRubric)
    );
    await queryClient.invalidateQueries({ queryKey: queryKeys.teacherRubrics });

    setRubrics((prev) => [
      ...prev,
      duplicatedRubric,
    ]);

    return duplicatedRubric;
  }

  function getRubricForAssignment(assignmentId) {
    const assignment = assignments.find(
      (item) => String(item.id) === String(assignmentId)
    );

    if (assignment?.rubricSchema) {
      return normalizeRubricSchema(assignment.rubricSchema);
    }

    const activeRubric = rubrics.find(
      (rubric) =>
        String(rubric.assignmentId) === String(assignmentId) &&
        rubric.status === "Active"
    );

    if (activeRubric) return activeRubric;

    return (
      rubrics.find(
        (rubric) =>
          String(rubric.assignmentId) === String(assignmentId)
      ) || null
    );
  }

  function refreshTeacherWorkspace() {
    // Never repopulate an authenticated workspace from the browser-wide mock
    // store. The polling feed and scoped query invalidations refresh server data.
    queryClient.invalidateQueries({ queryKey: ["teacher"] });
  }

  /* =====================================================
     PROVIDER
  ===================================================== */

  return (
    <TeacherWorkspaceContext.Provider
      value={{
        view,
        setView,

        classes,
        setClasses,
        isWorkspaceLoading,

        assignments,
        setAssignments,

        addAssignment,
        updateAssignment,
        deleteAssignment,
        toggleAssignmentStatus,
        attachRubricToAssignment,
        detachRubricFromAssignment,

        selectedAssignment,
        setSelectedAssignment,

        submissionFilterAssignment,
        setSubmissionFilterAssignment,

        submissions,
        setSubmissions,
        addSubmission,
        updateSubmissionReview,
        reopenSubmission,

        rubrics,
        setRubrics,
        addRubric,
        updateRubric,
        deleteRubric,
        duplicateRubric,
        getRubricForAssignment,
        calculateRubricTotal,
        normalizeRubricSchema,
        refreshTeacherWorkspace,
      }}
    >
      {children}
    </TeacherWorkspaceContext.Provider>
  );
}
