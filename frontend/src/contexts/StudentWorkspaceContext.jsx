import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getPraxisData,
  savePraxisData,
} from "../services/praxisMockStore";

const StudentWorkspaceContext =
  createContext(null);

/* =====================================================
   GENERAL HELPERS
===================================================== */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function removeUndefinedFields(object = {}) {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) => value !== undefined
    )
  );
}

function countWords(text = "") {
  const cleanText = String(
    text || ""
  ).trim();

  if (!cleanText) return 0;

  return cleanText
    .split(/\s+/)
    .filter(Boolean).length;
}

function notifyPraxisDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("praxis-data-changed")
    );
  }
}

function getCurrentStudentProfile() {
  try {
    const savedProfile =
      localStorage.getItem(
        "auizero_profile"
      );

    if (!savedProfile) {
      return {
        name: "Student",
        email: "student@aui.ma",
      };
    }

    const profile =
      JSON.parse(savedProfile);

    return {
      name:
        profile.name ||
        profile.fullName ||
        "Student",
      email:
        profile.email ||
        "student@aui.ma",
    };
  } catch {
    return {
      name: "Student",
      email: "student@aui.ma",
    };
  }
}

function normalizeAssignmentForStudent(
  assignment = {}
) {
  return {
    ...assignment,

    prompt:
      assignment.instructions ||
      assignment.description ||
      assignment.prompt ||
      "No instructions provided.",

    wordCountMin:
      assignment.minWords ??
      assignment.wordCountMin ??
      0,

    wordCountMax:
      assignment.maxWords ??
      assignment.wordCountMax ??
      0,

    feedbackRequestLimit:
      assignment.feedbackRequestLimit ??
      assignment.feedbackChecks ??
      (assignment.aiFeedback ? 3 : 0),
  };
}

function normalizeStudentStatus(status) {
  const value = String(
    status || "draft"
  ).toLowerCase();

  if (value === "graded")
    return "graded";
  if (value === "submitted")
    return "submitted";
  if (value === "late")
    return "late";
  if (value === "missing")
    return "missing";
  if (value === "reopened")
    return "reopened";
  if (value === "in progress")
    return "draft";
  if (value === "draft")
    return "draft";

  return "draft";
}

function isDraftLikeStatus(status) {
  const value = normalizeStudentStatus(
    status
  );

  return (
    value === "draft" ||
    value === "reopened"
  );
}

function getSubmissionText(
  submission = {}
) {
  return String(
    submission.finalText ||
      submission.submittedText ||
      submission.submissionText ||
      submission.content ||
      submission.draftText ||
      submission.text ||
      submission.essay ||
      submission.response ||
      ""
  ).trim();
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
    getSubmissionText(submission);

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
      getSubmissionText(source);

    const revisionText =
      getSubmissionText(phantom) ||
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

function buildWelcomeChatMessage() {
  return {
    role: "assistant",
    text:
      "Welcome to your planning dashboard. You can brainstorm ideas here before moving to the drafting canvas.",
    createdAt:
      new Date().toISOString(),
  };
}

function normalizeFeedbackHistory(
  submission = {}
) {
  const existingFeedbackHistory =
    safeArray(
      submission.feedbackHistory
    );

  if (!submission.feedback) {
    return existingFeedbackHistory;
  }

  const alreadyHasTeacherFeedback =
    existingFeedbackHistory.some(
      (item) =>
        String(
          item?.role || ""
        ).toLowerCase() ===
          "teacher" &&
        String(
          item?.text ||
            item?.feedback ||
            ""
        ) ===
          String(
            submission.feedback
          ) &&
        String(
          item?.reviewedAt || ""
        ) ===
          String(
            submission.reviewedAt ||
              ""
          )
    );

  if (alreadyHasTeacherFeedback) {
    return existingFeedbackHistory;
  }

  return [
    {
      id: `teacher_review_${
        submission.id || Date.now()
      }`,
      role: "teacher",
      type: "teacher_review",
      sourceSubmissionId:
        submission.id || null,
      text:
        submission.feedback,
      feedback:
        submission.feedback,
      score:
        submission.score ?? null,
      annotations:
        safeArray(
          submission.annotations
        ),
      rubricScores:
        submission.rubricScores || {},
      rubricTotal:
        submission.rubricTotal || null,
      reviewedAt:
        submission.reviewedAt || null,
      createdAt:
        submission.reviewedAt ||
        new Date().toISOString(),
    },
    ...existingFeedbackHistory,
  ];
}

function normalizeSubmissionForStudent(
  submission = {}
) {
  const draftText =
    getSubmissionText(submission);

  return {
    ...submission,

    status:
      normalizeStudentStatus(
        submission.status
      ),

    content:
      submission.content ||
      draftText,

    draftText:
      submission.draftText ||
      draftText,

    submittedText:
      submission.submittedText ||
      draftText,

    finalText:
      submission.finalText ||
      draftText,

    text:
      submission.text ||
      draftText,

    chatHistory:
      safeArray(
        submission.chatHistory
      ),

    planningChat:
      safeArray(
        submission.planningChat
      ),

    planningMessages:
      safeArray(
        submission.planningMessages
      ),

    coachChatHistory:
      safeArray(
        submission.coachChatHistory
      ),

    outline:
      submission.outline || {},

    feedbackHistory:
      normalizeFeedbackHistory(
        submission
      ),

    aiFeedbackHistory:
      safeArray(
        submission.aiFeedbackHistory
      ),

    studentAiFeedbackHistory:
      safeArray(
        submission.studentAiFeedbackHistory
      ),

    draftFeedbackHistory:
      safeArray(
        submission.draftFeedbackHistory
      ),

    integrityLogs:
      safeArray(
        submission.integrityLogs
      ),

    copyPasteLogs:
      safeArray(
        submission.copyPasteLogs
      ),

    focusLossLogs:
      safeArray(
        submission.focusLossLogs
      ),

    writingEvents:
      safeArray(
        submission.writingEvents
      ),

    writingReplay:
      safeArray(
        submission.writingReplay
      ),

    writingHistory:
      safeArray(
        submission.writingHistory
      ),

    keystrokeLog:
      safeArray(
        submission.keystrokeLog
      ),

    annotations:
      safeArray(
        submission.annotations
      ),

    feedback:
      submission.feedback || "",

    score:
      submission.score ?? null,

    rubricId:
      submission.rubricId || null,

    rubricTitle:
      submission.rubricTitle || null,

    rubricScores:
      submission.rubricScores || {},

    rubricTotal:
      submission.rubricTotal || null,

    reviewedAt:
      submission.reviewedAt || null,

    previousTeacherReview:
      submission.previousTeacherReview ||
      null,
  };
}

function getSubmissionTime(
  submission = {}
) {
  return new Date(
    submission.reopenedAt ||
      submission.resubmittedAt ||
      submission.submittedAt ||
      submission.updatedAt ||
      submission.createdAt ||
      0
  ).getTime();
}

function getCurrentSubmissionForAssignment(
  submissionsList,
  assignmentId
) {
  const matching = safeArray(
    submissionsList
  ).filter(
    (submission) =>
      String(
        submission.assignmentId
      ) === String(assignmentId)
  );

  const explicitlyCurrent =
    matching
      .filter(
        (submission) =>
          submission.isCurrent === true
      )
      .sort(
        (a, b) =>
          getSubmissionTime(b) -
          getSubmissionTime(a)
      )[0] || null;

  if (explicitlyCurrent) {
    return explicitlyCurrent;
  }

  return (
    matching.sort(
      (a, b) =>
        getSubmissionTime(b) -
        getSubmissionTime(a)
    )[0] || null
  );
}

function buildDraftSubmission({
  assignment,
  studentName,
  studentEmail,
  patch = {},
}) {
  const now =
    new Date().toISOString();

  const draftText = String(
    patch.draftText ??
      patch.content ??
      patch.finalText ??
      ""
  );

  const chatHistory =
    safeArray(
      patch.chatHistory
    ).length > 0
      ? safeArray(
          patch.chatHistory
        )
      : [
          buildWelcomeChatMessage(),
        ];

  return {
    ...patch,

    id:
      patch.id ||
      `draft_${Date.now()}`,

    assignmentId:
      assignment.id,

    assignmentTitle:
      assignment.title,

    assignment,
    assignmentDetails:
      assignment,

    studentName,
    studentEmail,

    classId:
      assignment.classId ??
      patch.classId ??
      null,

    classCode:
      assignment.classCode ||
      patch.classCode ||
      "",

    className:
      assignment.className ||
      patch.className ||
      "",

    submittedAt: null,
    resubmittedAt: null,

    status: "draft",

    score: null,
    feedback: "",
    reviewedAt: null,

    wordCount:
      countWords(draftText),

    aiFlags:
      Number(
        patch.aiFlags || 0
      ),

    content: draftText,
    draftText,
    submittedText: draftText,
    finalText: draftText,
    text: draftText,

    chatHistory,
    outline:
      patch.outline || {},

    feedbackHistory:
      safeArray(
        patch.feedbackHistory
      ),

    aiFeedbackHistory:
      safeArray(
        patch.aiFeedbackHistory
      ),

    studentAiFeedbackHistory:
      safeArray(
        patch.studentAiFeedbackHistory
      ),

    draftFeedbackHistory:
      safeArray(
        patch.draftFeedbackHistory
      ),

    integrityLogs:
      safeArray(
        patch.integrityLogs
      ),

    copyPasteLogs:
      safeArray(
        patch.copyPasteLogs
      ),

    focusLossLogs:
      safeArray(
        patch.focusLossLogs
      ),

    writingEvents:
      safeArray(
        patch.writingEvents
      ),

    writingReplay:
      safeArray(
        patch.writingReplay
      ),

    writingHistory:
      safeArray(
        patch.writingHistory
      ),

    keystrokeLog:
      safeArray(
        patch.keystrokeLog
      ),

    annotations: [],

    attemptNumber:
      Number(
        patch.attemptNumber || 1
      ),

    previousSubmissionId:
      patch.previousSubmissionId ||
      null,

    isCurrent: true,

    createdAt:
      patch.createdAt || now,

    updatedAt: now,
    lastSavedAt: now,
  };
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

function getDeadlineDate(
  assignment = {}
) {
  return getAssignmentDeadlineDate(
    assignment
  );
}

/* =====================================================
   PROVIDER
===================================================== */

export function StudentWorkspaceProvider({
  children,
}) {
  const [classes, setClasses] =
    useState([]);

  const [
    currentClassId,
    setCurrentClassId,
  ] = useState("__all__");

  const [
    pendingClasses,
    setPendingClasses,
  ] = useState([]);

  const [
    assignments,
    setAssignments,
  ] = useState([]);

  const [
    submissions,
    setSubmissions,
  ] = useState([]);

  const [
    selectedAssignmentId,
    setSelectedAssignmentId,
  ] = useState(null);

  const [
    studentStep,
    setStudentStep,
  ] = useState(1);

  const [
    viewingTray,
    setViewingTray,
  ] = useState(true);

  const [
    typedText,
    setTypedText,
  ] = useState("");

  const [
    studentProfile,
    setStudentProfile,
  ] = useState(
    () =>
      getCurrentStudentProfile()
  );

  function loadStudentWorkspace() {
    const data =
      getRepairedPraxisData();

    const profile =
      getCurrentStudentProfile();

    setStudentProfile(profile);

    const allEnrollments =
      safeArray(
        data.enrollments
      );

    let studentEnrollments =
      allEnrollments.filter(
        (enrollment) =>
          String(
            enrollment.studentEmail ||
              ""
          ).toLowerCase() ===
          String(
            profile.email || ""
          ).toLowerCase()
      );

    if (
      studentEnrollments.length ===
      0
    ) {
      studentEnrollments =
        allEnrollments.filter(
          (enrollment) =>
            String(
              enrollment.studentEmail ||
                ""
            ).toLowerCase() ===
            "student@aui.ma"
        );
    }

    const enrolledClassIds =
      studentEnrollments.map(
        (enrollment) =>
          enrollment.classId
      );

    const studentClasses =
      safeArray(data.classes)
        .filter((cls) =>
          enrolledClassIds.some(
            (classId) =>
              String(classId) ===
              String(cls.id)
          )
        )
        .map((cls) => ({
          ...cls,
          name: cls.code
            ? `${cls.code}: ${cls.name}`
            : cls.name,
        }));

    const studentAssignments =
      safeArray(
        data.assignments
      )
        .filter(
          (assignment) =>
            String(
              assignment.status ||
                ""
            ).toLowerCase() ===
              "published" &&
            !assignment.archived &&
            enrolledClassIds.some(
              (classId) =>
                String(classId) ===
                String(
                  assignment.classId
                )
            )
        )
        .map(
          normalizeAssignmentForStudent
        );

    let studentSubmissions =
      safeArray(
        data.submissions
      )
        .filter(
          (submission) =>
            String(
              submission.studentEmail ||
                ""
            ).toLowerCase() ===
            String(
              profile.email || ""
            ).toLowerCase()
        )
        .map(
          normalizeSubmissionForStudent
        );

    if (
      studentSubmissions.length ===
        0 &&
      String(
        profile.email || ""
      ).toLowerCase() !==
        "student@aui.ma"
    ) {
      studentSubmissions =
        safeArray(
          data.submissions
        )
          .filter(
            (submission) =>
              String(
                submission.studentEmail ||
                  ""
              ).toLowerCase() ===
              "student@aui.ma"
          )
          .map(
            normalizeSubmissionForStudent
          );
    }

    setClasses(
      studentClasses
    );

    setAssignments(
      studentAssignments
    );

    setSubmissions(
      studentSubmissions
    );
  }

  useEffect(() => {
    loadStudentWorkspace();

    function handleFocus() {
      loadStudentWorkspace();
    }

    function handleStorageChange(
      event
    ) {
      if (
        !event?.key ||
        event.key ===
          "praxis_mock_data"
      ) {
        loadStudentWorkspace();
      }
    }

    function handlePraxisDataChanged() {
      loadStudentWorkspace();
    }

    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        loadStudentWorkspace();
      }
    }

    window.addEventListener(
      "focus",
      handleFocus
    );

    window.addEventListener(
      "storage",
      handleStorageChange
    );

    window.addEventListener(
      "praxis-data-changed",
      handlePraxisDataChanged
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.removeEventListener(
        "focus",
        handleFocus
      );

      window.removeEventListener(
        "storage",
        handleStorageChange
      );

      window.removeEventListener(
        "praxis-data-changed",
        handlePraxisDataChanged
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, []);

  const activeAssignment =
    useMemo(
      () =>
        assignments.find(
          (assignment) =>
            String(
              assignment.id
            ) ===
            String(
              selectedAssignmentId
            )
        ) || null,
      [
        assignments,
        selectedAssignmentId,
      ]
    );

  const activeSubmission =
    useMemo(
      () => {
        const saved =
          getCurrentSubmissionForAssignment(
            submissions,
            selectedAssignmentId
          );

        if (saved) return saved;

        if (!activeAssignment) {
          return null;
        }

        return {
          assignmentId:
            activeAssignment.id,

          assignmentTitle:
            activeAssignment.title,

          assignment:
            activeAssignment,

          assignmentDetails:
            activeAssignment,

          status: "draft",

          draftText:
            typedText || "",

          content:
            typedText || "",

          submittedText:
            typedText || "",

          finalText:
            typedText || "",

          text:
            typedText || "",

          chatHistory: [
            buildWelcomeChatMessage(),
          ],

          outline: {},

          feedbackHistory: [],
          aiFeedbackHistory: [],
          studentAiFeedbackHistory: [],
          draftFeedbackHistory: [],

          integrityLogs: [],
          copyPasteLogs: [],
          focusLossLogs: [],
          writingEvents: [],
          writingReplay: [],
          writingHistory: [],
          keystrokeLog: [],

          annotations: [],
        };
      },
      [
        submissions,
        selectedAssignmentId,
        activeAssignment,
        typedText,
      ]
    );

  useEffect(() => {
    if (!selectedAssignmentId) {
      setTypedText("");
      return;
    }

    setTypedText(
      getSubmissionText(
        activeSubmission
      )
    );
  }, [
    selectedAssignmentId,
    activeSubmission?.id,
  ]);

  /*
    A newly reopened attempt always starts at Step 1.
    The dependencies only change when the attempt is created/reopened,
    so the student can navigate to Steps 2, 3, and 4 afterward.
  */
  useEffect(() => {
    if (
      normalizeStudentStatus(
        activeSubmission?.status
      ) === "reopened"
    ) {
      setStudentStep(1);
    }
  }, [
    selectedAssignmentId,
    activeSubmission?.id,
    activeSubmission?.reopenedAt,
  ]);

  function saveDraftProgress(
    assignmentId,
    patch = {}
  ) {
    const data =
      getRepairedPraxisData();

    const assignment =
      safeArray(
        data.assignments
      ).find(
        (item) =>
          String(item.id) ===
          String(assignmentId)
      );

    if (!assignment) {
      return false;
    }

    const profile =
      getCurrentStudentProfile();

    const studentEmail =
      studentProfile?.email ||
      profile.email ||
      "student@aui.ma";

    const studentName =
      studentProfile?.name ||
      studentProfile?.fullName ||
      profile.name ||
      "Student";

    const now =
      new Date().toISOString();

    const allSubmissions =
      safeArray(
        data.submissions
      );

    const sameStudentAttempts =
      allSubmissions.filter(
        (submission) =>
          String(
            submission.assignmentId
          ) ===
            String(assignmentId) &&
          String(
            submission.studentEmail ||
              ""
          ).toLowerCase() ===
            String(
              studentEmail
            ).toLowerCase()
      );

    const existingDraft =
      sameStudentAttempts
        .filter(
          (submission) =>
            submission.isCurrent !==
              false &&
            isDraftLikeStatus(
              submission.status
            )
        )
        .sort(
          (a, b) =>
            getSubmissionTime(b) -
            getSubmissionTime(a)
        )[0] || null;

    const cleanPatch =
      removeUndefinedFields(
        patch
      );

    let nextRecord;

    if (existingDraft) {
      const patchHasText =
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "draftText"
        ) ||
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "content"
        ) ||
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "submittedText"
        ) ||
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "finalText"
        ) ||
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "text"
        );

      const nextDraftText =
        patchHasText
          ? String(
              cleanPatch.draftText ??
                cleanPatch.content ??
                cleanPatch.submittedText ??
                cleanPatch.finalText ??
                cleanPatch.text ??
                ""
            )
          : getSubmissionText(
              existingDraft
            );

      nextRecord = {
        ...existingDraft,
        ...cleanPatch,

        id:
          existingDraft.id,

        status:
          normalizeStudentStatus(
            existingDraft.status
          ) === "reopened"
            ? "Reopened"
            : "draft",

        content:
          nextDraftText,

        draftText:
          nextDraftText,

        submittedText:
          nextDraftText,

        finalText:
          nextDraftText,

        text:
          nextDraftText,

        wordCount:
          cleanPatch.wordCount ??
          countWords(
            nextDraftText
          ),

        chatHistory:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "chatHistory"
          )
            ? safeArray(
                cleanPatch.chatHistory
              )
            : safeArray(
                existingDraft.chatHistory
              ),

        outline:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "outline"
          )
            ? cleanPatch.outline || {}
            : existingDraft.outline || {},

        feedbackHistory:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "feedbackHistory"
          )
            ? safeArray(
                cleanPatch.feedbackHistory
              )
            : safeArray(
                existingDraft.feedbackHistory
              ),

        integrityLogs:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "integrityLogs"
          )
            ? safeArray(
                cleanPatch.integrityLogs
              )
            : safeArray(
                existingDraft.integrityLogs
              ),

        copyPasteLogs:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "copyPasteLogs"
          )
            ? safeArray(
                cleanPatch.copyPasteLogs
              )
            : safeArray(
                existingDraft.copyPasteLogs
              ),

        writingEvents:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "writingEvents"
          )
            ? safeArray(
                cleanPatch.writingEvents
              )
            : safeArray(
                existingDraft.writingEvents
              ),

        keystrokeLog:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "keystrokeLog"
          )
            ? safeArray(
                cleanPatch.keystrokeLog
              )
            : safeArray(
                existingDraft.keystrokeLog
              ),

        isCurrent: true,

        updatedAt: now,
        lastSavedAt: now,
      };
    } else {
      const maxAttemptNumber =
        Math.max(
          0,
          ...sameStudentAttempts.map(
            (submission) =>
              Number(
                submission.attemptNumber ||
                  0
              )
          )
        );

      const latestAttempt =
        sameStudentAttempts.sort(
          (a, b) =>
            getSubmissionTime(b) -
            getSubmissionTime(a)
        )[0] || null;

      nextRecord =
        buildDraftSubmission({
          assignment,
          studentName,
          studentEmail,
          patch: {
            ...cleanPatch,
            attemptNumber:
              maxAttemptNumber + 1,
            previousSubmissionId:
              latestAttempt?.id ||
              null,
          },
        });
    }

    const nextSubmissions =
      existingDraft
        ? allSubmissions.map(
            (submission) =>
              String(
                submission.id
              ) ===
              String(
                existingDraft.id
              )
                ? nextRecord
                : submission
          )
        : [
            ...allSubmissions.map(
              (submission) => {
                const isSameStudentAssignment =
                  String(
                    submission.assignmentId
                  ) ===
                    String(
                      assignmentId
                    ) &&
                  String(
                    submission.studentEmail ||
                      ""
                  ).toLowerCase() ===
                    String(
                      studentEmail
                    ).toLowerCase();

                return isSameStudentAssignment
                  ? {
                      ...submission,
                      isCurrent: false,
                      supersededAt:
                        now,
                    }
                  : submission;
              }
            ),
            nextRecord,
          ];

    savePraxisData({
      ...data,
      submissions:
        nextSubmissions,
    });

    notifyPraxisDataChanged();
    loadStudentWorkspace();

    return true;
  }

  function submitAssignment(
    assignmentId,
    content
  ) {
    const data =
      getRepairedPraxisData();

    const assignment =
      safeArray(
        data.assignments
      ).find(
        (item) =>
          String(item.id) ===
          String(assignmentId)
      );

    if (!assignment) {
      return false;
    }

    const cleanContent =
      String(content || "").trim();

    if (!cleanContent) {
      return false;
    }

    const profile =
      getCurrentStudentProfile();

    const studentEmail =
      studentProfile?.email ||
      profile.email ||
      "student@aui.ma";

    const studentName =
      studentProfile?.name ||
      studentProfile?.fullName ||
      profile.name ||
      "Student";

    const now =
      new Date().toISOString();

    const allSubmissions =
      safeArray(
        data.submissions
      );

    const sameStudentAttempts =
      allSubmissions.filter(
        (submission) =>
          String(
            submission.assignmentId
          ) ===
            String(assignmentId) &&
          String(
            submission.studentEmail ||
              ""
          ).toLowerCase() ===
            String(
              studentEmail
            ).toLowerCase()
      );

    const existingDraft =
      sameStudentAttempts
        .filter(
          (submission) =>
            submission.isCurrent !==
              false &&
            isDraftLikeStatus(
              submission.status
            )
        )
        .sort(
          (a, b) =>
            getSubmissionTime(b) -
            getSubmissionTime(a)
        )[0] || null;

    const dueDate =
      getDeadlineDate(
        assignment
      );

    const submittedStatus =
      dueDate &&
      new Date(now).getTime() >
        dueDate.getTime()
        ? "Late"
        : "Submitted";

    const isReopenedSubmission =
      normalizeStudentStatus(
        existingDraft?.status
      ) === "reopened";

    /*
      REOPENED RESUBMISSION
      Attempt 2 is created only now, when the student actually submits.
    */
    if (
      existingDraft &&
      isReopenedSubmission
    ) {
      const originalSnapshot =
        existingDraft.reopenSnapshot ||
        null;

      const originalText =
        getSubmissionText(
          originalSnapshot ||
          existingDraft
        );

      const previousAttempt = {
        ...(originalSnapshot ||
          existingDraft),

        id: existingDraft.id,

        attemptNumber:
          Number(
            existingDraft.attemptNumber ||
              originalSnapshot?.attemptNumber ||
              1
          ),

        status:
          originalSnapshot?.status ||
          existingDraft
            ?.previousTeacherReview
            ?.status ||
          "Graded",

        submittedAt:
          originalSnapshot?.submittedAt ||
          existingDraft.submittedAt ||
          null,

        resubmittedAt:
          originalSnapshot?.resubmittedAt ||
          existingDraft.resubmittedAt ||
          null,

        content: originalText,
        draftText: originalText,
        submittedText: originalText,
        finalText: originalText,
        text: originalText,

        wordCount:
          originalSnapshot?.wordCount ||
          countWords(originalText),

        score:
          originalSnapshot?.score ??
          existingDraft
            ?.previousTeacherReview
            ?.score ??
          null,

        feedback:
          originalSnapshot?.feedback ||
          existingDraft
            ?.previousTeacherReview
            ?.feedback ||
          "",

        annotations:
          safeArray(
            originalSnapshot?.annotations ||
            existingDraft
              ?.previousTeacherReview
              ?.annotations
          ),

        rubricId:
          originalSnapshot?.rubricId ||
          existingDraft
            ?.previousTeacherReview
            ?.rubricId ||
          null,

        rubricTitle:
          originalSnapshot?.rubricTitle ||
          existingDraft
            ?.previousTeacherReview
            ?.rubricTitle ||
          null,

        rubricScores:
          originalSnapshot?.rubricScores ||
          existingDraft
            ?.previousTeacherReview
            ?.rubricScores ||
          {},

        rubricTotal:
          originalSnapshot?.rubricTotal ||
          existingDraft
            ?.previousTeacherReview
            ?.rubricTotal ||
          null,

        reviewedAt:
          originalSnapshot?.reviewedAt ||
          existingDraft
            ?.previousTeacherReview
            ?.reviewedAt ||
          null,

        isCurrent: false,
        reopenPending: false,
        supersededAt: now,
        updatedAt:
          originalSnapshot?.updatedAt ||
          now,
      };

      delete previousAttempt.reopenSnapshot;

      const previousTeacherReview =
        existingDraft.previousTeacherReview ||
        buildPreviousTeacherReviewSnapshot(
          previousAttempt,
          originalText
        );

      const nextAttemptNumber =
        Number(
          previousAttempt.attemptNumber ||
            1
        ) + 1;

      const newSubmission = {
        ...existingDraft,

        id: `sub_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,

        assignmentId:
          assignment.id,

        assignmentTitle:
          assignment.title,

        assignment,
        assignmentDetails:
          assignment,

        studentName,
        studentEmail,

        submittedAt: now,
        resubmittedAt: now,

        status:
          submittedStatus,

        score: null,
        feedback: "",
        reviewedAt: null,
        annotations: [],
        rubricScores: {},
        rubricCalculatedScore: null,
        rubricOverride: false,

        previousTeacherReview,

        attemptNumber:
          nextAttemptNumber,

        previousSubmissionId:
          previousAttempt.id,

        revisionSourceSubmissionId:
          previousAttempt.id,

        isCurrent: true,
        reopenPending: false,

        content:
          cleanContent,

        draftText:
          cleanContent,

        submittedText:
          cleanContent,

        finalText:
          cleanContent,

        text:
          cleanContent,

        wordCount:
          countWords(
            cleanContent
          ),

        createdAt: now,
        updatedAt: now,
        lastSavedAt: now,
      };

      delete newSubmission.reopenSnapshot;

      const nextSubmissions =
        allSubmissions
          .filter(
            (submission) =>
              String(submission.id) !==
              String(existingDraft.id)
          )
          .map((submission) => {
            const isSameStudentAssignment =
              String(
                submission.assignmentId
              ) ===
                String(assignmentId) &&
              String(
                submission.studentEmail ||
                  ""
              ).toLowerCase() ===
                String(
                  studentEmail
                ).toLowerCase();

            return isSameStudentAssignment
              ? {
                  ...submission,
                  isCurrent: false,
                }
              : submission;
          });

      nextSubmissions.push(
        previousAttempt,
        newSubmission
      );

      savePraxisData({
        ...data,
        submissions:
          nextSubmissions,
      });

      notifyPraxisDataChanged();
      loadStudentWorkspace();

      return true;
    }

    /*
      FIRST SUBMISSION OR AN ORDINARY DRAFT
      Keep Attempt 1 and submit that same draft record.
    */
    const maxAttemptNumber =
      Math.max(
        0,
        ...sameStudentAttempts.map(
          (submission) =>
            Number(
              submission.attemptNumber ||
                0
            )
        )
      );

    const attemptNumber =
      Number(
        existingDraft?.attemptNumber ||
          0
      ) ||
      maxAttemptNumber + 1;

    const newSubmission = {
      ...(existingDraft || {}),

      id:
        existingDraft?.id ||
        `sub_${Date.now()}`,

      assignmentId:
        assignment.id,

      assignmentTitle:
        assignment.title,

      assignment,
      assignmentDetails:
        assignment,

      studentName,
      studentEmail,

      classId:
        assignment.classId ??
        existingDraft?.classId ??
        null,

      classCode:
        assignment.classCode ||
        existingDraft?.classCode ||
        "",

      className:
        assignment.className ||
        existingDraft?.className ||
        "",

      submittedAt: now,
      resubmittedAt:
        attemptNumber > 1
          ? now
          : null,

      status:
        submittedStatus,

      score: null,
      feedback: "",
      reviewedAt: null,
      annotations: [],
      rubricScores: {},
      rubricCalculatedScore: null,
      rubricOverride: false,

      previousTeacherReview: null,

      wordCount:
        countWords(
          cleanContent
        ),

      content:
        cleanContent,

      draftText:
        cleanContent,

      submittedText:
        cleanContent,

      finalText:
        cleanContent,

      text:
        cleanContent,

      chatHistory:
        safeArray(
          existingDraft?.chatHistory
        ),

      planningChat:
        safeArray(
          existingDraft?.planningChat
        ),

      planningMessages:
        safeArray(
          existingDraft?.planningMessages
        ),

      coachChatHistory:
        safeArray(
          existingDraft?.coachChatHistory
        ),

      outline:
        existingDraft?.outline || {},

      feedbackHistory:
        safeArray(
          existingDraft?.feedbackHistory
        ),

      aiFeedbackHistory:
        safeArray(
          existingDraft?.aiFeedbackHistory
        ),

      studentAiFeedbackHistory:
        safeArray(
          existingDraft?.studentAiFeedbackHistory
        ),

      draftFeedbackHistory:
        safeArray(
          existingDraft?.draftFeedbackHistory
        ),

      integrityLogs:
        safeArray(
          existingDraft?.integrityLogs
        ),

      copyPasteLogs:
        safeArray(
          existingDraft?.copyPasteLogs
        ),

      focusLossLogs:
        safeArray(
          existingDraft?.focusLossLogs
        ),

      writingEvents:
        safeArray(
          existingDraft?.writingEvents
        ),

      writingReplay:
        safeArray(
          existingDraft?.writingReplay
        ),

      writingHistory:
        safeArray(
          existingDraft?.writingHistory
        ),

      keystrokeLog:
        safeArray(
          existingDraft?.keystrokeLog
        ),

      attemptNumber,

      previousSubmissionId:
        existingDraft?.previousSubmissionId ||
        null,

      revisionSourceSubmissionId:
        existingDraft?.revisionSourceSubmissionId ||
        null,

      isCurrent: true,

      createdAt:
        existingDraft?.createdAt ||
        now,

      updatedAt: now,
      lastSavedAt: now,
    };

    delete newSubmission.reopenSnapshot;

    const nextSubmissions =
      allSubmissions.map(
        (submission) => {
          const isSameStudentAssignment =
            String(
              submission.assignmentId
            ) ===
              String(assignmentId) &&
            String(
              submission.studentEmail ||
                ""
            ).toLowerCase() ===
              String(
                studentEmail
              ).toLowerCase();

          if (!isSameStudentAssignment) {
            return submission;
          }

          if (
            existingDraft &&
            String(
              submission.id
            ) ===
              String(
                existingDraft.id
              )
          ) {
            return newSubmission;
          }

          return {
            ...submission,
            isCurrent: false,
          };
        }
      );

    if (!existingDraft) {
      nextSubmissions.push(
        newSubmission
      );
    }

    savePraxisData({
      ...data,
      submissions:
        nextSubmissions,
    });

    notifyPraxisDataChanged();
    loadStudentWorkspace();

    return true;
  }

  function refreshStudentWorkspace() {
    loadStudentWorkspace();
  }

  return (
    <StudentWorkspaceContext.Provider
      value={{
        studentProfile,

        classes,
        setClasses,

        currentClassId,
        setCurrentClassId,

        pendingClasses,
        setPendingClasses,

        assignments,
        setAssignments,

        submissions,
        setSubmissions,

        selectedAssignmentId,
        setSelectedAssignmentId,

        studentStep,
        setStudentStep,

        viewingTray,
        setViewingTray,

        activeAssignment,
        activeSubmission,

        saveDraftProgress,
        submitAssignment,
        refreshStudentWorkspace,

        typedText,
        setTypedText,
      }}
    >
      {children}
    </StudentWorkspaceContext.Provider>
  );
}

export const useStudentWorkspace = () =>
  useContext(
    StudentWorkspaceContext
  );