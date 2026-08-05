import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StudentWorkspaceContext } from "./StudentWorkspaceContextBase";

import {
  getPraxisData,
  savePraxisData,
} from "../services/praxisMockStore";
import { getStudentCourses } from "../services/courseApi";
import {
  getOrCreateMySubmission,
  getStudentAssignments,
  getStudentSubmissions,
  saveMySubmission,
  submitMyAssignment,
} from "../services/teacherApi";
import AuthService from "../services/auth";
import { queryClient, queryKeys } from "../queryClient";

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

function loadActiveStudentAssignmentId() {
  return null;
}

function saveActiveStudentAssignmentId(assignmentId) {
  void assignmentId;
}

function getDraftText(submission = {}) {
  const source =
    submission && typeof submission === "object"
      ? submission
      : {};

  return String(
    source.draftText ??
      source.content ??
      source.text ??
      ""
  );
}

function getFinalText(submission = {}) {
  const source =
    submission && typeof submission === "object"
      ? submission
      : {};

  return String(
    source.finalText ??
      source.submittedText ??
      source.submissionText ??
      source.draftText ??
      source.content ??
      source.text ??
      ""
  );
}

function getCanonicalChatTimeLimit(assignment = {}) {
  if (assignment.disableChatbot === true) return -1;

  const raw =
    assignment.chatTimeLimit ??
    assignment.coachTimeLimitMinutes ??
    assignment.aiCoachTimeLimitMinutes ??
    assignment.aiSupportSettings?.chatTimeLimit ??
    assignment.aiSupportSettings?.coachTimeLimitMinutes ??
    0;

  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : 0;
}

function isCoachDisabledForAssignment(assignment = {}) {
  return (
    assignment.disableChatbot === true ||
    assignment.aiIdeasCoach === false ||
    assignment.allowAI === false ||
    getCanonicalChatTimeLimit(assignment) < 0
  );
}

function getAiFeedbackEntries(submission = {}) {
  return safeArray(submission.feedbackHistory).filter((entry) => {
    const role = String(entry?.role || "").toLowerCase();
    const type = String(entry?.type || "").toLowerCase();
    const source = String(entry?.source || "").toLowerCase();

    return (
      role === "ai" ||
      type === "draft_review" ||
      type === "ai_feedback" ||
      source === "ai" ||
      source === "claude" ||
      (safeArray(entry?.items).length > 0 && role !== "teacher")
    );
  });
}

function loadStudentStepOverrides() {
  return {};
}

function saveStudentStepOverrides(overrides = {}) {
  void overrides;
}

function notifyPraxisDataChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new Event("praxis-data-changed")
    );
  }
}

function refreshStudentSubmissionsAfterMutation() {
  // The mutation response is authoritative. A follow-up cache refresh can fail
  // independently (for example, while an expired session cookie is being
  // refreshed) and must never turn a successful submit into a failure message.
  return queryClient.invalidateQueries({
    queryKey: queryKeys.studentSubmissions,
  }).catch((error) => {
    console.warn("Submission saved, but the submission cache could not refresh:", error);
  });
}

function getCurrentStudentProfile() {
  const profile = AuthService.getProfile() || {};
  return {
    id: profile.id || null,
    name: profile.name || profile.fullName || "Student",
    email: profile.email || "student@aui.ma",
  };
}

function normalizeAssignmentForStudent(
  assignment = {}
) {
  const aiSupportSettings = assignment.aiSupportSettings || {};

  const chatTimeLimit = getCanonicalChatTimeLimit(assignment);
  const disableChatbot =
    assignment.disableChatbot === true || chatTimeLimit < 0;

  const autoOutlineFromChat = Boolean(
    assignment.autoOutlineFromChat ??
      assignment.autoBuildOutlineFromCoach ??
      assignment.generateOutlineFromCoach ??
      aiSupportSettings.autoOutlineFromChat ??
      aiSupportSettings.autoBuildOutlineFromCoach ??
      false
  );

  return {
    ...assignment,

    prompt:
      assignment.instructions ||
      assignment.description ||
      assignment.prompt ||
      "No instructions provided.",

    assignmentType:
      assignment.assignmentType ||
      assignment.type ||
      "response",

    languageLevel:
      assignment.languageLevel ||
      assignment.studentLevel ||
      assignment.level ||
      "B1",

    studentLevel:
      assignment.studentLevel ||
      assignment.languageLevel ||
      assignment.level ||
      "B1",

    wordCountMin:
      assignment.minWords ??
      assignment.wordCountMin ??
      0,

    wordCountMax:
      assignment.maxWords ??
      assignment.wordCountMax ??
      0,

    ideaRequestLimit:
      assignment.ideaRequestLimit ??
      assignment.ideaRequests ??
      3,

    feedbackRequestLimit:
      assignment.feedbackRequestLimit ??
      assignment.feedbackChecks ??
      (assignment.aiFeedback ? 3 : 0),

    disableChatbot,
    chatTimeLimit,

    coachTimeLimitMinutes:
      chatTimeLimit > 0 ? chatTimeLimit : 0,

    autoOutlineFromChat,
    autoBuildOutlineFromCoach: autoOutlineFromChat,
    generateOutlineFromCoach: autoOutlineFromChat,
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

function hasSubmissionEvidence(submission = {}) {
  const submittedText = String(
    submission.submittedText ||
      submission.submissionText ||
      ""
  ).trim();

  const submittedTimestamp =
    submission.submittedAt ||
    submission.resubmittedAt ||
    null;

  return Boolean(
    submittedTimestamp &&
      submittedText
  );
}

function isEditableStudentSubmission(submission = {}) {
  const status = normalizeStudentStatus(
    submission.status
  );

  if (
    status === "draft" ||
    status === "reopened" ||
    status === "missing"
  ) {
    return true;
  }

  if (status === "late") {
    return !hasSubmissionEvidence(submission);
  }

  return false;
}

function isStudentSubmissionLocked(submission = {}) {
  if (!submission) return false;

  const status = normalizeStudentStatus(
    submission.status
  );

  if (isEditableStudentSubmission(submission)) {
    return false;
  }

  if (
    status === "submitted" ||
    status === "graded"
  ) {
    return true;
  }

  return hasSubmissionEvidence(submission);
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

function repairDraftSubmittedTextAliases(
  records = []
) {
  let changed = false;

  const submissions = safeArray(records).map(
    (submission) => {
      const status = normalizeStudentStatus(
        submission.status
      );

      const editableWithoutSubmission =
        (
          status === "draft" ||
          status === "missing" ||
          status === "late"
        ) &&
        !submission.submittedAt &&
        !submission.resubmittedAt;

      if (!editableWithoutSubmission) {
        return submission;
      }

      const submittedText = String(
        submission.submittedText ||
          submission.submissionText ||
          ""
      );

      const finalText = String(
        submission.finalText || ""
      );

      const hasPrematureSubmittedAlias =
        Boolean(submittedText);

      if (!hasPrematureSubmittedAlias) {
        return submission;
      }

      changed = true;

      return {
        ...submission,
        submittedText: "",
        submissionText: "",
        honorConfirmed: false,
        honorConfirmedAt: null,
        repairedDraftSubmissionAliasAt:
          new Date().toISOString(),
      };
    }
  );

  return {
    submissions,
    changed,
  };
}

function repairDuplicateCurrentRecords(
  records = []
) {
  const list = safeArray(records).filter(Boolean);
  const groupsByStudentAssignment = new Map();
  let changed = false;

  list.forEach((submission) => {
    const key = `${String(
      submission.assignmentId
    )}:${String(
      submission.studentEmail || ""
    ).toLowerCase()}`;

    if (!groupsByStudentAssignment.has(key)) {
      groupsByStudentAssignment.set(
        key,
        []
      );
    }

    groupsByStudentAssignment
      .get(key)
      .push(submission);
  });

  const repairedRecords = list.map(
    (submission) => {
      const key = `${String(
        submission.assignmentId
      )}:${String(
        submission.studentEmail || ""
      ).toLowerCase()}`;

      const group =
        groupsByStudentAssignment.get(
          key
        );

      const currentRecords = group.filter(
        (s) => s.isCurrent === true
      );

      if (currentRecords.length <= 1) {
        return submission;
      }

      const mostRecent = currentRecords.sort(
        (a, b) =>
          getSubmissionTime(b) -
          getSubmissionTime(a)
      )[0];

      if (
        String(submission.id) ===
        String(mostRecent.id)
      ) {
        return submission;
      }

      changed = true;

      return {
        ...submission,
        isCurrent: false,
      };
    }
  );

  return {
    submissions: repairedRecords,
    changed,
  };
}

function getRepairedPraxisData() {
  const originalData =
    getPraxisData();

  const attemptRepair =
    repairLegacyReopenedAttempts(
      originalData.submissions || []
    );

  const aliasRepair =
    repairDraftSubmittedTextAliases(
      attemptRepair.submissions
    );

  const attemptRepairedData = {
    ...originalData,
    submissions:
      aliasRepair.submissions,
  };

  const lateRepair =
    repairFalseLateStatuses(
      attemptRepairedData
    );

  const currentRepair =
    repairDuplicateCurrentRecords(
      lateRepair.data.submissions || []
    );

  const nextData = {
    ...lateRepair.data,
    submissions:
      currentRepair.submissions,
  };

  if (
    attemptRepair.changed ||
    aliasRepair.changed ||
    lateRepair.changed ||
    currentRepair.changed
  ) {
    savePraxisData(nextData);
  }

  return nextData;
}

function buildWelcomeChatMessage() {
  return {
    role: "assistant",
    text:
      "What is your first idea for this assignment?",
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
  const status = normalizeStudentStatus(
    submission.status
  );

  const draftText = getDraftText(submission);

  const rawFinalText = String(
    submission.finalText ??
      ""
  );

  const rawSubmittedText = String(
    submission.submittedText ??
      submission.submissionText ??
      ""
  );

  const hasActualSubmission = Boolean(
    submission.submittedAt ||
      submission.resubmittedAt ||
      status === "submitted" ||
      status === "graded"
  );

  /*
    finalText is an editable Step 3 value.
    submittedText is immutable submission evidence.
    Never copy finalText into submittedText for a draft.
  */
  const submittedText =
    rawSubmittedText ||
    (
      hasActualSubmission
        ? rawFinalText
        : ""
    );

  const finalText =
    rawFinalText ||
    submittedText;

  return {
    ...submission,

    status,

    content:
      submission.content ??
      draftText,

    draftText,

    submittedText,

    finalText,

    text:
      submission.text ??
      finalText ??
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

    planningChatMessages:
      safeArray(
        submission.planningChatMessages
      ),

    planningCoachHistory:
      safeArray(
        submission.planningCoachHistory
      ),

    ideaResponses:
      safeArray(
        submission.ideaResponses
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

    chatStartedAt: submission.chatStartedAt || null,
    chatSkippedAt: submission.chatSkippedAt || null,
    chatExpiredAt: submission.chatExpiredAt || null,
    chatElapsedMs: Number(submission.chatElapsedMs || 0),
    chatResumedAt: submission.chatResumedAt || null,
  };
}

function getSubmissionTime(
  submission = {}
) {
  return new Date(
    submission.resubmittedAt ||
      submission.submittedAt ||
      submission.updatedAt ||
      submission.reopenedAt ||
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
      ""
  );

  const finalText = String(
    patch.finalText ??
      ""
  );

  /* Draft progress is not a real submission. */
  const submittedText = "";

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
    honorConfirmed: false,
    honorConfirmedAt: null,

    status: "draft",

    score: null,
    feedback: "",
    reviewedAt: null,

    wordCount:
      countWords(finalText || draftText),

    aiFlags:
      Number(
        patch.aiFlags || 0
      ),

    content: draftText,
    draftText,
    submittedText,
    submissionText: "",
    finalText,
    text: finalText || draftText,

    chatHistory,
    planningChatMessages: safeArray(patch.planningChatMessages),
    planningCoachHistory: safeArray(patch.planningCoachHistory),
    ideaResponses: safeArray(patch.ideaResponses),

    chatStartedAt: patch.chatStartedAt || null,
    chatSkippedAt: patch.chatSkippedAt || null,
    chatExpiredAt: patch.chatExpiredAt || null,
    chatElapsedMs: Number(patch.chatElapsedMs || 0),
    chatResumedAt: patch.chatResumedAt || null,

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

// Student workflow steps can remount while saves started by the previous step
// are still in flight. Keep the coordinator at module scope so every provider
// instance shares one ordered queue and one concurrency token per assignment.
// Otherwise a newly mounted step can PATCH with an older `updated_at` while the
// previous instance is finishing a save, producing a false "another tab" 409.
const sharedPersistentSaveQueues = new Map();
const sharedDurableSubmissionRefs = new Map();

function getStudentPersistenceKey(assignmentId, submission = null) {
  const profile = getCurrentStudentProfile();
  const studentKey = submission?.studentId || profile.id || profile.email;
  return `${studentKey}:${String(assignmentId)}`;
}

function rememberDurableSubmission(assignmentId, submission) {
  if (!assignmentId || !submission?.id) return;
  const key = getStudentPersistenceKey(assignmentId, submission);
  const current = sharedDurableSubmissionRefs.get(key);
  const currentVersion = Number(current?.version || 0);
  const nextVersion = Number(submission.version || 0);
  const currentUpdatedAt = Date.parse(current?.updatedAt || 0);
  const nextUpdatedAt = Date.parse(submission.updatedAt || 0);

  // A background workspace refresh may have started before the latest save.
  // Never let that older response roll the optimistic-concurrency token back.
  if (
    current &&
    (nextVersion < currentVersion ||
      (nextVersion === currentVersion && nextUpdatedAt < currentUpdatedAt))
  ) {
    return;
  }

  sharedDurableSubmissionRefs.set(key, {
    id: submission.id,
    version: submission.version,
    updatedAt: submission.updatedAt,
  });
}

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
  const persistentSaveQueues = useRef(sharedPersistentSaveQueues);
  const durableSubmissionRefs = useRef(sharedDurableSubmissionRefs);
  const syncWorkspaceRef = useRef(null);
  const [workspaceSyncState, setWorkspaceSyncState] = useState({
    status: "loading",
    error: "",
    lastSyncedAt: null,
  });

  const [
    selectedAssignmentId,
    setSelectedAssignmentId,
  ] = useState(() => loadActiveStudentAssignmentId());
  const [openingAssignmentId, setOpeningAssignmentId] = useState(null);

  const [
    studentStep,
    setStudentStep,
  ] = useState(() => {
    const activeAssignmentId = loadActiveStudentAssignmentId();
    const savedSteps = loadStudentStepOverrides();

    return activeAssignmentId
      ? Math.min(
          4,
          Math.max(1, Number(savedSteps[String(activeAssignmentId)] || 1))
        )
      : 1;
  });

  const [
    studentStepOverrides,
    setStudentStepOverrides,
  ] = useState(() => loadStudentStepOverrides());

  const [
    viewingTray,
    setViewingTray,
  ] = useState(true);

  const [
    typedText,
    setTypedText,
  ] = useState("");

  const [
    studentWorkflowNotice,
    setStudentWorkflowNotice,
  ] = useState(null);

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
          (
            profile.id &&
            String(enrollment.studentId || "") === String(profile.id)
          ) ||
          String(enrollment.studentEmail || "").toLowerCase() ===
            String(profile.email || "").toLowerCase()
      );

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
            (
              profile.id &&
              String(submission.studentId || "") === String(profile.id)
            ) ||
            String(submission.studentEmail || "").toLowerCase() ===
              String(profile.email || "").toLowerCase()
        )
        .map(
          normalizeSubmissionForStudent
        );

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

    let active = true;
    let syncPromise = null;

    async function syncEnrolledCoursesFromBackend() {
      if (syncPromise) return syncPromise;

      setWorkspaceSyncState((current) => ({
        ...current,
        status: current.lastSyncedAt ? "refreshing" : "loading",
        error: "",
      }));
      syncPromise = (async () => {
       try {
        const { classes: backendClasses } = await queryClient.fetchQuery({
          queryKey: queryKeys.studentCourses,
          queryFn: getStudentCourses,
          staleTime: 30_000,
        });
        if (!active) return;

        const profile = getCurrentStudentProfile();
        const data = getPraxisData();
        const knownEnrollmentClassIds = new Set(
          safeArray(data.enrollments)
            .filter((entry) =>
              (
                profile.id &&
                String(entry.studentId || "") === String(profile.id)
              ) ||
              String(entry.studentEmail || "").toLowerCase() ===
                String(profile.email || "").toLowerCase()
            )
            .map((entry) => String(entry.classId))
        );
        const now = new Date().toISOString();
        const nextClasses = [...safeArray(data.classes)];
        const nextEnrollments = [...safeArray(data.enrollments)];

        backendClasses.forEach((course) => {
          const cachedCourse = nextClasses.find(
            (entry) =>
              String(entry.id) === String(course.id) ||
              String(entry.backendId || "") === String(course.id) ||
              (entry.code &&
                String(entry.code).toUpperCase() === String(course.code).toUpperCase())
          );
          const workspaceCourseId = cachedCourse?.id || course.id;

          if (!cachedCourse) nextClasses.push(course);
          if (!knownEnrollmentClassIds.has(String(workspaceCourseId))) {
            nextEnrollments.push({
              id: `backend_enrollment_${course.id}_${profile.id || profile.email}`,
              studentId: profile.id || null,
              studentEmail: profile.email || "",
              studentName: profile.name || "Student",
              classId: workspaceCourseId,
              courseId: workspaceCourseId,
              classCode: course.code,
              courseCode: course.code,
              className: course.name,
              status: "active",
              joinedAt: now,
              createdAt: now,
              updatedAt: now,
            });
          }
        });

        const [assignmentGroups, backendSubmissions] = await Promise.all([
          Promise.all(
            backendClasses.map(async (course) => {
              const rows = await queryClient.fetchQuery({
                queryKey: queryKeys.classAssignments(course.id),
                queryFn: () => getStudentAssignments(course.id),
                staleTime: 30_000,
              });
              return rows.map((assignment) => ({
                ...assignment,
                classId: course.id,
                classCode: course.code || "",
                className: course.name || "",
              }));
            })
          ),
          queryClient.fetchQuery({
            queryKey: [...queryKeys.studentSubmissions, "all"],
            queryFn: () => getStudentSubmissions([]),
            staleTime: 30_000,
          }),
        ]);
        const backendAssignments = assignmentGroups.flat();
        const persistedSubmissions = backendSubmissions.map((submission) => {
          const assignment = backendAssignments.find(
            (entry) => String(entry.id) === String(submission.assignmentId)
          );
          return {
            ...submission,
            assignment,
            assignmentDetails: assignment,
            assignmentTitle: assignment?.title || "",
            studentId: profile.id || submission.studentId,
            studentEmail: profile.email || "",
            studentName: profile.name || "Student",
            classId: assignment?.classId || null,
            classCode: assignment?.classCode || "",
            className: assignment?.className || "",
            isCurrent: true,
          };
        });
        persistedSubmissions.forEach((submission) => {
          if (submission?.assignmentId && submission?.id) {
            rememberDurableSubmission(submission.assignmentId, submission);
          }
        });

        /*
         * Commit one complete backend snapshot. Previously courses were saved
         * first and assignments/submissions later, while focus/storage events
         * repeatedly reloaded the half-finished snapshot. That made courses
         * and submitted state appear only after several refreshes.
         */
        const latestData = getPraxisData();
        const mergedPersistedSubmissions = persistedSubmissions.map((incoming) => {
          if (!persistentSaveQueues.current.has(getStudentPersistenceKey(incoming.assignmentId, incoming))) {
            return incoming;
          }
          const local = safeArray(latestData.submissions).find(
            (entry) =>
              String(entry.assignmentId) === String(incoming.assignmentId) &&
              entry.isCurrent !== false
          );
          if (!local) return incoming;
          return {
            ...incoming,
            draftText: local.draftText ?? incoming.draftText,
            content: local.content ?? incoming.content,
            finalText: local.finalText ?? incoming.finalText,
            text: local.text ?? incoming.text,
            chatHistory: local.chatHistory ?? incoming.chatHistory,
            planningChatMessages:
              local.planningChatMessages ?? incoming.planningChatMessages,
            planningCoachHistory:
              local.planningCoachHistory ?? incoming.planningCoachHistory,
            outline: local.outline ?? incoming.outline,
            feedbackHistory: local.feedbackHistory ?? incoming.feedbackHistory,
            selfAssessment: local.selfAssessment ?? incoming.selfAssessment,
            selfRubricScores:
              local.selfRubricScores ?? incoming.selfRubricScores,
            selfRubricTotal: local.selfRubricTotal ?? incoming.selfRubricTotal,
            selfRubricMax: local.selfRubricMax ?? incoming.selfRubricMax,
            selfRubricPercentage:
              local.selfRubricPercentage ?? incoming.selfRubricPercentage,
            selfAssessedAt: local.selfAssessedAt ?? incoming.selfAssessedAt,
            writingEvents: local.writingEvents ?? incoming.writingEvents,
            keystrokeLog: local.keystrokeLog ?? incoming.keystrokeLog,
          };
        });
        const backendClassIds = new Set(
          backendClasses.map((course) => String(course.id))
        );
        const backendAssignmentIds = new Set(
          backendAssignments.map((assignment) => String(assignment.id))
        );
        const preservedAssignments = safeArray(latestData.assignments).filter(
          (assignment) => !backendClassIds.has(String(assignment.classId || ""))
        );
        const preservedSubmissions = safeArray(latestData.submissions).filter(
          (submission) =>
            !backendAssignmentIds.has(String(submission.assignmentId || "")) &&
            String(submission.studentId || "") !== String(profile.id || "")
        );

        savePraxisData({
          ...latestData,
          classes: nextClasses,
          enrollments: nextEnrollments,
          assignments: [...preservedAssignments, ...backendAssignments],
          submissions: [...preservedSubmissions, ...mergedPersistedSubmissions],
        });
        if (active) {
          loadStudentWorkspace();
          setWorkspaceSyncState({
            status: "ready",
            error: "",
            lastSyncedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Could not load enrolled courses from Supabase:", error);
        if (active) {
          setWorkspaceSyncState((current) => ({
            ...current,
            status: current.lastSyncedAt ? "ready" : "error",
            error:
              "Praxis could not refresh the workspace. Your last confirmed work is still available.",
          }));
        }
      } finally {
        syncPromise = null;
      }
      })();

      return syncPromise;
    }

    syncWorkspaceRef.current = syncEnrolledCoursesFromBackend;
    syncEnrolledCoursesFromBackend();

    function handleFocus() {
      loadStudentWorkspace();
      syncEnrolledCoursesFromBackend();
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
        syncEnrolledCoursesFromBackend();
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
      active = false;
      syncWorkspaceRef.current = null;
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

  /*
   * Review status is server-owned. Refresh only those review fields while the
   * tab is visible so polling can never replace an in-progress local draft.
   */
  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshReviewStatus() {
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
          queryKey: queryKeys.studentSubmissions,
        });
        const backendRows = await queryClient.fetchQuery({
          queryKey: [...queryKeys.studentSubmissions, "all"],
          queryFn: () => getStudentSubmissions([]),
          staleTime: 0,
        });

        if (!active) return;

        setSubmissions((currentRows) => {
          const backendById = new Map(
            safeArray(backendRows).map((row) => [String(row.id), row])
          );

          return safeArray(currentRows).map((current) => {
            const incoming = backendById.get(String(current.id));
            if (!incoming) return current;

            return {
              ...current,
              status: incoming.status || current.status,
              teacherReview:
                incoming.teacherReview || current.teacherReview,
              score:
                incoming.score ?? current.score ?? null,
              feedback:
                incoming.feedback ?? current.feedback ?? "",
              annotations:
                incoming.annotations || current.annotations || [],
              rubricScores:
                incoming.rubricScores || current.rubricScores || {},
              reviewedAt:
                incoming.reviewedAt || current.reviewedAt || null,
              teacherReviewedAt:
                incoming.teacherReviewedAt ||
                current.teacherReviewedAt ||
                null,
              gradedAt:
                incoming.gradedAt || current.gradedAt || null,
              updatedAt:
                incoming.updatedAt || current.updatedAt,
            };
          });
        });
      } catch {
        // Preserve current draft and last confirmed review during outages.
      } finally {
        refreshing = false;
      }
    }

    // Grades are not latency-critical enough to justify a request every two
    // seconds. Focus/reconnect refreshes remain immediate; this interval is a
    // low-cost fallback until the review channel moves to realtime events.
    const intervalId = window.setInterval(refreshReviewStatus, 60000);
    window.addEventListener("focus", refreshReviewStatus);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshReviewStatus);
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

          draftText: "",

          content: "",

          submittedText: "",

          finalText: "",

          text: "",

          chatHistory: [
            buildWelcomeChatMessage(),
          ],

          outline: {},

          ideaResponses: [],

          chatStartedAt: null,
          chatSkippedAt: null,
          chatExpiredAt: null,
          chatElapsedMs: 0,
          chatResumedAt: null,

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
      ]
    );

  useEffect(() => {
    if (!selectedAssignmentId) {
      setTypedText("");
      return;
    }

    /*
      Hydrate when the assignment or attempt changes.
      Do not hydrate on every step change: goToStudentStep already places
      the exact latest Draft/Final text into typedText.
    */
    if (studentStep >= 3) {
      setTypedText(
        getFinalText(activeSubmission) ||
          getDraftText(activeSubmission)
      );
      return;
    }

    setTypedText(
      getDraftText(activeSubmission)
    );
  }, [
    selectedAssignmentId,
    activeSubmission?.id,
    studentStep,
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
    activeSubmission?.status,
  ]);

  function queuePersistentDraftSave(assignmentId, record) {
    const key = getStudentPersistenceKey(assignmentId, record);
    const previous = persistentSaveQueues.current.get(key) || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        let databaseSubmission = durableSubmissionRefs.current.get(key);
        if (!databaseSubmission?.id) {
          databaseSubmission = await getOrCreateMySubmission(assignmentId);
        }
        const saved = await saveMySubmission({
          ...record,
          id: databaseSubmission.id,
          version: databaseSubmission.version,
          updatedAt: databaseSubmission.updatedAt,
        });
        rememberDurableSubmission(assignmentId, saved);
        return saved;
      })
      .catch((error) => {
        console.error("Supabase draft autosave failed; local recovery copy retained:", error);
        throw error;
      });
    persistentSaveQueues.current.set(key, next);
    const cleanup = () => {
      if (persistentSaveQueues.current.get(key) === next) {
        persistentSaveQueues.current.delete(key);
      }
    };
    next.then(cleanup, cleanup);
    return next;
  }

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
            isEditableStudentSubmission(
              submission
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

    /*
      CRITICAL STATE MACHINE CHECK:
      After submission, reject new saves to prevent auto-creating Attempt 3.
      saveDraftProgress() is only valid when:
      1. There's an editable current draft, OR
      2. This is the first-ever attempt (no sameStudentAttempts at all)
      
      If there's a submitted/graded current record, the save is invalid
      and must be rejected.
    */
    if (!existingDraft && sameStudentAttempts.length > 0) {
      const currentSubmitted =
        sameStudentAttempts.find(
          (submission) =>
            submission.isCurrent === true &&
            !isEditableStudentSubmission(
              submission
            )
        );

      if (currentSubmitted) {
        /* Silently reject post-submission saves. */
        return false;
      }
    }

    let nextRecord;

    if (existingDraft) {
      const hasDraftText =
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "draftText"
        );

      const hasFinalText =
        Object.prototype.hasOwnProperty.call(
          cleanPatch,
          "finalText"
        );

      const nextDraftText = hasDraftText
        ? String(cleanPatch.draftText ?? "")
        : getDraftText(existingDraft);

      const nextFinalText = hasFinalText
        ? String(cleanPatch.finalText ?? "")
        : String(existingDraft.finalText ?? "");

      const existingHasActualSubmission =
        hasSubmissionEvidence(existingDraft);

      const nextSubmittedText =
        existingHasActualSubmission
          ? String(
              existingDraft.submittedText ||
                existingDraft.submissionText ||
                ""
            )
          : "";

      const nextContent = Object.prototype.hasOwnProperty.call(
        cleanPatch,
        "content"
      )
        ? String(cleanPatch.content ?? "")
        : String(existingDraft.content ?? nextDraftText);

      const nextText = Object.prototype.hasOwnProperty.call(
        cleanPatch,
        "text"
      )
        ? String(cleanPatch.text ?? "")
        : String(
            existingDraft.text ??
              nextFinalText ??
              nextDraftText
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

        content: nextContent,
        draftText: nextDraftText,
        submittedText: nextSubmittedText,
        submissionText: nextSubmittedText,
        finalText: nextFinalText,
        text: nextText,

        submittedAt:
          existingDraft.submittedAt ||
          null,

        resubmittedAt:
          existingDraft.resubmittedAt ||
          null,

        honorConfirmed:
          existingHasActualSubmission
            ? existingDraft.honorConfirmed === true
            : false,

        honorConfirmedAt:
          existingHasActualSubmission
            ? existingDraft.honorConfirmedAt || null
            : null,

        wordCount:
          cleanPatch.wordCount ??
          countWords(
            nextFinalText || nextDraftText
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

        planningChatMessages:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "planningChatMessages"
          )
            ? safeArray(cleanPatch.planningChatMessages)
            : safeArray(existingDraft.planningChatMessages),

        planningCoachHistory:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "planningCoachHistory"
          )
            ? safeArray(cleanPatch.planningCoachHistory)
            : safeArray(existingDraft.planningCoachHistory),

        ideaResponses:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "ideaResponses"
          )
            ? safeArray(cleanPatch.ideaResponses)
            : safeArray(existingDraft.ideaResponses),

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

        focusLossLogs:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "focusLossLogs"
          )
            ? safeArray(cleanPatch.focusLossLogs)
            : safeArray(existingDraft.focusLossLogs),

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

        writingReplay:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "writingReplay"
          )
            ? safeArray(cleanPatch.writingReplay)
            : safeArray(existingDraft.writingReplay),

        writingHistory:
          Object.prototype.hasOwnProperty.call(
            cleanPatch,
            "writingHistory"
          )
            ? safeArray(cleanPatch.writingHistory)
            : safeArray(existingDraft.writingHistory),

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
    const persistence = queuePersistentDraftSave(assignmentId, nextRecord);
    // Most editor autosaves are intentionally fire-and-forget, while explicit
    // actions such as rubric save await the same promise for confirmation.
    persistence.catch(() => undefined);
    return persistence;
  }

  async function submitAssignment(
    assignmentId,
    content,
    submissionMeta = {}
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

    if (
      submissionMeta.honorConfirmed !==
      true
    ) {
      return false;
    }

    const honorConfirmedAt =
      submissionMeta.honorConfirmedAt ||
      new Date().toISOString();

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

    /*
      CRITICAL VALIDATION:
      Do not allow submission if there's already a current submitted/graded record.
      This prevents duplicate submissions and the auto-create bug.
    */
    const currentlySubmitted =
      sameStudentAttempts.find(
        (submission) =>
          submission.isCurrent === true &&
          isStudentSubmissionLocked(
            submission
          )
      );

    if (currentlySubmitted) {
      /* A submission already exists for this attempt. */
      return false;
    }

    const existingDraft =
      sameStudentAttempts
        .filter(
          (submission) =>
            submission.isCurrent !==
              false &&
            isEditableStudentSubmission(
              submission
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

      let newSubmission = {
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
        honorConfirmed: true,
        honorConfirmedAt,

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
          getDraftText(existingDraft) || cleanContent,

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

      const pendingSave = persistentSaveQueues.current.get(getStudentPersistenceKey(assignmentId));
      if (pendingSave) {
        await Promise.race([
          pendingSave.catch(() => undefined),
          new Promise((resolve) => window.setTimeout(resolve, 5000)),
        ]);
      }
      const persistedSubmission = await submitMyAssignment(assignmentId, newSubmission);
      void refreshStudentSubmissionsAfterMutation();
      newSubmission = {
        ...newSubmission,
        ...persistedSubmission,
        assignment,
        assignmentDetails: assignment,
        assignmentTitle: assignment.title,
        studentName,
        studentEmail,
        isCurrent: true,
      };

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

    let newSubmission = {
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
      honorConfirmed: true,
      honorConfirmedAt,

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
        getDraftText(existingDraft || {}) || cleanContent,

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

    const pendingSave = persistentSaveQueues.current.get(getStudentPersistenceKey(assignmentId));
    if (pendingSave) {
      await Promise.race([
        pendingSave.catch(() => undefined),
        new Promise((resolve) => window.setTimeout(resolve, 5000)),
      ]);
    }
    const persistedSubmission = await submitMyAssignment(assignmentId, newSubmission);
    void refreshStudentSubmissionsAfterMutation();
    newSubmission = {
      ...newSubmission,
      ...persistedSubmission,
      assignment,
      assignmentDetails: assignment,
      assignmentTitle: assignment.title,
      studentName,
      studentEmail,
      isCurrent: true,
    };

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

  function rememberStudentStep(
    assignmentId,
    step
  ) {
    if (!assignmentId) return;

    const safeStep = Math.min(
      4,
      Math.max(1, Number(step || 1))
    );

    setStudentStep(safeStep);

    setStudentStepOverrides((current) => {
      const next = {
        ...current,
        [String(assignmentId)]: safeStep,
      };

      saveStudentStepOverrides(next);
      return next;
    });
  }

  function pauseCoachSession() {
    if (
      !activeAssignment?.id ||
      !activeSubmission?.chatResumedAt ||
      isCoachDisabledForAssignment(activeAssignment)
    ) {
      return;
    }

    const resumedAt = Date.parse(
      activeSubmission.chatResumedAt
    );

    const elapsed = Number(
      activeSubmission.chatElapsedMs || 0
    );

    const nextElapsed = Number.isNaN(resumedAt)
      ? elapsed
      : elapsed + Math.max(0, Date.now() - resumedAt);

    saveDraftProgress(activeAssignment.id, {
      chatElapsedMs: nextElapsed,
      chatResumedAt: null,
    });
  }

  function resumeCoachSession() {
    if (
      !activeAssignment?.id ||
      !activeSubmission?.chatStartedAt ||
      activeSubmission?.chatSkippedAt ||
      activeSubmission?.chatExpiredAt ||
      activeSubmission?.chatResumedAt ||
      isCoachDisabledForAssignment(activeAssignment)
    ) {
      return;
    }

    saveDraftProgress(activeAssignment.id, {
      chatResumedAt: new Date().toISOString(),
    });
  }

  function startCoachSession() {
    if (
      !activeAssignment?.id ||
      isCoachDisabledForAssignment(activeAssignment)
    ) {
      return {};
    }

    const now = new Date().toISOString();

    const patch = activeSubmission?.chatStartedAt
      ? {
          chatResumedAt:
            activeSubmission.chatResumedAt || now,
        }
      : {
          chatStartedAt: now,
          chatElapsedMs: Number(
            activeSubmission?.chatElapsedMs || 0
          ),
          chatResumedAt: now,
          chatExpiredAt: null,
        };

    saveDraftProgress(activeAssignment.id, patch);
    return patch;
  }

  function showStudentWorkflowNotice(notice = {}) {
    const normalizedNotice = {
      id:
        notice.id ||
        `student_notice_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`,
      tone: notice.tone || "amber",
      title: notice.title || "Check this step",
      message: notice.message || "",
      primaryLabel: notice.primaryLabel || "",
      secondaryLabel: notice.secondaryLabel || "",
      pendingTransition: notice.pendingTransition || null,
    };

    setStudentWorkflowNotice(normalizedNotice);
    return normalizedNotice;
  }

  function clearStudentWorkflowNotice() {
    setStudentWorkflowNotice(null);
  }

  function confirmStudentWorkflowNotice() {
    const notice = studentWorkflowNotice;
    const pendingTransition = notice?.pendingTransition;

    setStudentWorkflowNotice(null);

    if (!pendingTransition) {
      return false;
    }

    const transitionOptions = {
      ...(pendingTransition.options || {}),
      confirmedFromNotice: true,
    };

    if (
      Number(pendingTransition.targetStep) === 4 &&
      transitionOptions.currentText === undefined
    ) {
      transitionOptions.currentText = String(
        transitionOptions.finalText ?? typedText ?? ""
      );
    }

    return goToStudentStep(
      pendingTransition.targetStep,
      transitionOptions
    );
  }

  function goToStudentStep(
    targetStep,
    options = {}
  ) {
    if (!activeAssignment) return false;

    const nextStep = Math.min(
      4,
      Math.max(1, Number(targetStep || 1))
    );

    /*
      `typedText` is the live editor value. It can be newer than the
      debounced local-storage record when a student clicks a step button
      immediately after typing. Always flush it before leaving Draft or
      Feedback so the next step receives the exact latest text.
    */
    const liveTypedText = String(
      options.currentText ??
        typedText ??
        ""
    );

    if (
      studentStep === 2 &&
      nextStep !== 2 &&
      !isStudentSubmissionLocked(activeSubmission)
    ) {
      saveDraftProgress(activeAssignment.id, {
        draftText: liveTypedText,
        content: liveTypedText,
        wordCount: countWords(liveTypedText),
        draftSavedAt:
          new Date().toISOString(),
        lastSavedAt:
          new Date().toISOString(),
      });
    }

    if (
      studentStep === 3 &&
      nextStep !== 3 &&
      !isStudentSubmissionLocked(activeSubmission)
    ) {
      saveDraftProgress(activeAssignment.id, {
        finalText: liveTypedText,
        wordCount: countWords(liveTypedText),
        finalSavedAt:
          new Date().toISOString(),
        lastSavedAt:
          new Date().toISOString(),
      });
    }

    const locked =
      isStudentSubmissionLocked(
        activeSubmission
      );

    if (locked && nextStep !== 4) {
      rememberStudentStep(activeAssignment.id, 4);
      setTypedText(getFinalText(activeSubmission));

      showStudentWorkflowNotice({
        tone: "blue",
        title: "Assignment already submitted",
        message:
          "This assignment is locked after submission. Open the Submit step to review your work.",
      });

      return false;
    }

    if (nextStep === 2 && !options.force) {
      const chatDisabled =
        isCoachDisabledForAssignment(activeAssignment);

      const hasChat =
        chatDisabled ||
        Boolean(activeSubmission?.chatSkippedAt) ||
        safeArray(
          activeSubmission?.chatHistory
        ).filter((message) =>
          String(
            message?.content ||
              message?.text ||
              ""
          ).trim()
        ).length >= 2;

      if (
        !hasChat &&
        !options.confirmedPlanningSkip
      ) {
        showStudentWorkflowNotice({
          tone: "amber",
          title: "Continue without using the Coach?",
          message:
            "You have not used the Coach yet. You may stay in Brainstorm, or continue to the Draft step without a coaching conversation.",
          primaryLabel: "Continue to Draft",
          secondaryLabel: "Stay in Brainstorm",
          pendingTransition: {
            targetStep: 2,
            options: {
              ...options,
              confirmedPlanningSkip: true,
            },
          },
        });

        return false;
      }

      if (
        !hasChat &&
        options.confirmedPlanningSkip
      ) {
        const skippedAt =
          activeSubmission?.chatSkippedAt ||
          new Date().toISOString();

        saveDraftProgress(activeAssignment.id, {
          chatSkippedAt: skippedAt,
          chatResumedAt: null,
        });
      }
    }

    if (nextStep === 3) {
      const savedDraftText = getDraftText(
        activeSubmission
      );

      const latestDraftText = String(
        options.draftText ??
          (
            studentStep === 2
              ? liveTypedText
              : savedDraftText
          )
      );

      if (!latestDraftText.trim()) {
        showStudentWorkflowNotice({
          tone: "amber",
          title: "Draft required",
          message:
            "Write part of your response in the Draft step before opening AI Feedback.",
        });

        return false;
      }

      const savedFinalText = String(
        activeSubmission?.finalText || ""
      );

      // Keep Submit preview in sync with the latest Draft content.
      // When the student enters Feedback from Draft, the current draft
      // should become the working final text for that attempt.
      const shouldInitializeFinalText =
        studentStep === 2 ||
        !savedFinalText.trim();

      const nextFinalText =
        shouldInitializeFinalText
          ? latestDraftText
          : savedFinalText;

      saveDraftProgress(activeAssignment.id, {
        draftText: latestDraftText,
        content: latestDraftText,
        finalText: nextFinalText,
        wordCount: countWords(nextFinalText),
        finalInitializedAt:
          activeSubmission?.finalInitializedAt ||
          (
            shouldInitializeFinalText
              ? new Date().toISOString()
              : null
          ),
      });

      setTypedText(nextFinalText);
    }

    if (nextStep === 4) {
      const savedFinalText = (
        getFinalText(activeSubmission) ||
        getDraftText(activeSubmission)
      );

      const finalText = String(
        options.finalText ??
          (
            (studentStep === 2 || studentStep === 3) &&
            liveTypedText.trim()
              ? liveTypedText
              : savedFinalText
          )
      ).trim();

      if (!finalText) {
        showStudentWorkflowNotice({
          tone: "amber",
          title: "Final revision required",
          message:
            "Write or revise your final version before moving to the Rubric Check.",
        });

        return false;
      }

      const feedbackLimit = Math.max(
        0,
        Number(
          activeAssignment.feedbackRequestLimit ??
            activeAssignment.feedbackChecks ??
            0
        )
      );

      const feedbackUsed = getAiFeedbackEntries(
        activeSubmission
      ).length;

      const remaining = Math.max(
        0,
        feedbackLimit - feedbackUsed
      );

      if (
        remaining > 0 &&
        !options.skipFeedbackPrompt &&
        !activeSubmission?.feedbackPromptResolvedAt
      ) {
        const currentFeedbackView =
          Number(studentStep) === 2 ? "Draft" : "AI Feedback";

        showStudentWorkflowNotice({
          tone: "blue",
          title: "Feedback checks are still available",
          message: `You still have ${remaining} feedback check${
            remaining === 1 ? "" : "s"
          } available. You may stay in ${currentFeedbackView}, or continue to the Rubric Check without using them.`,
          primaryLabel: "Continue to Rubric",
          secondaryLabel: `Stay in ${currentFeedbackView}`,
          pendingTransition: {
            targetStep: 4,
            options: {
              ...options,
              skipFeedbackPrompt: true,
            },
          },
        });

        setTypedText(finalText);
        return false;
      }

      saveDraftProgress(activeAssignment.id, {
        finalText,
        wordCount: countWords(finalText),
        feedbackPromptResolvedAt:
          activeSubmission?.feedbackPromptResolvedAt ||
          (options.skipFeedbackPrompt
            ? new Date().toISOString()
            : null),
        finalSavedAt:
          activeSubmission?.finalSavedAt ||
          new Date().toISOString(),
      });

      setTypedText(finalText);
    }

    if (studentStep === 1 && nextStep !== 1) {
      pauseCoachSession();
    }

    if (nextStep === 1) {
      setTypedText(getDraftText(activeSubmission));
      resumeCoachSession();
    } else if (nextStep === 2) {
      setTypedText(getDraftText(activeSubmission));
    }

    clearStudentWorkflowNotice();

    rememberStudentStep(
      activeAssignment.id,
      nextStep
    );

    return true;
  }

  async function openStudentAssignment(assignmentId, options = {}) {
    const assignment = assignments.find(
      (item) =>
        String(item.id) === String(assignmentId)
    );

    if (!assignment) return false;

    let submission =
      getCurrentSubmissionForAssignment(
        submissions,
        assignmentId
      );
    const hadCachedSubmission = Boolean(submission?.id);
    const workspaceReady = options.workspaceReady
      ? Promise.resolve(options.workspaceReady).catch(() => undefined)
      : null;

    const provisionalStatus = normalizeStudentStatus(submission?.status);
    const provisionalStep =
      provisionalStatus === "submitted" ||
      provisionalStatus === "graded" ||
      (provisionalStatus === "late" && isStudentSubmissionLocked(submission))
        ? 4
        : provisionalStatus === "reopened"
          ? 1
          : Number(studentStepOverrides[String(assignmentId)] || 1);

    // Keep the tray visible while a cold workflow bundle loads. A first
    // attempt also waits for its durable row, so neither path mounts an empty
    // workspace before replacing it with the finished Coach.
    setOpeningAssignmentId(
      !submission?.id || workspaceReady ? assignmentId : null
    );
    clearStudentWorkflowNotice();
    if (submission?.id) {
      if (workspaceReady) {
        await workspaceReady;
        setOpeningAssignmentId(null);
      }
      saveActiveStudentAssignmentId(assignmentId);
      setSelectedAssignmentId(assignmentId);
      setStudentStep(provisionalStep);
      setTypedText(
        provisionalStep >= 3
          ? getFinalText(submission) || getDraftText(submission)
          : getDraftText(submission)
      );
    }

    try {
      const persisted = await getOrCreateMySubmission(assignmentId);
      rememberDurableSubmission(assignmentId, persisted);
      const preserveLocalWork =
        persistentSaveQueues.current.has(getStudentPersistenceKey(assignmentId, submission)) ||
        Date.parse(submission?.updatedAt || 0) >
          Date.parse(persisted?.updatedAt || 0);
      submission = {
        ...submission,
        ...persisted,
        // Preserve recoverable student work, while server-owned status,
        // review, version, and timestamps always come from the durable row.
        draftText: preserveLocalWork
          ? getDraftText(submission) || getDraftText(persisted)
          : getDraftText(persisted) || getDraftText(submission),
        finalText: preserveLocalWork
          ? getFinalText(submission) || getFinalText(persisted)
          : getFinalText(persisted) || getFinalText(submission),
        chatHistory:
          preserveLocalWork && safeArray(submission?.chatHistory).length > 0
            ? submission.chatHistory
            : persisted.chatHistory,
        planningChatMessages:
          preserveLocalWork && safeArray(submission?.planningChatMessages).length > 0
            ? submission.planningChatMessages
            : persisted.planningChatMessages,
        planningCoachHistory:
          preserveLocalWork && safeArray(submission?.planningCoachHistory).length > 0
            ? submission.planningCoachHistory
            : persisted.planningCoachHistory,
        selfRubricScores:
          preserveLocalWork && Object.keys(submission?.selfRubricScores || {}).length > 0
            ? submission.selfRubricScores
            : persisted.selfRubricScores,
        id: persisted.id,
        version: persisted.version,
        updatedAt: persisted.updatedAt,
        assignment,
        assignmentDetails: assignment,
        assignmentTitle: assignment.title,
        classId: assignment.classId,
        classCode: assignment.classCode,
        className: assignment.className,
        isCurrent: true,
      };
      setSubmissions((current) => {
        const withoutCurrent = current.filter(
          (entry) => String(entry.assignmentId) !== String(assignmentId)
        );
        return [...withoutCurrent, submission];
      });

      if (!hadCachedSubmission && workspaceReady) {
        await workspaceReady;
      }
    } catch (error) {
      console.error("Could not open the durable submission:", error);
      showStudentWorkflowNotice({
        tone: hadCachedSubmission ? "amber" : "red",
        title: hadCachedSubmission
          ? "Showing your saved offline copy"
          : "Assignment could not be opened",
        message: hadCachedSubmission
          ? "Praxis could not confirm the latest database version. Your cached work is visible, but reconnect before submitting."
          : "Your connection to the database failed. Please try again before writing.",
      });
      if (hadCachedSubmission) {
        return true;
      }
      saveActiveStudentAssignmentId(null);
      setSelectedAssignmentId(null);
      return false;
    } finally {
      setOpeningAssignmentId(null);
    }

    const status = normalizeStudentStatus(
      submission?.status
    );

    let nextStep = 1;

    if (
      status === "submitted" ||
      status === "graded" ||
      (
        status === "late" &&
        isStudentSubmissionLocked(submission)
      )
    ) {
      nextStep = 4;
    } else if (status === "reopened") {
      nextStep = 1;
    } else {
      nextStep = Number(
        studentStepOverrides[
          String(assignmentId)
        ] || 1
      );
    }

    clearStudentWorkflowNotice();
    saveActiveStudentAssignmentId(assignmentId);
    setSelectedAssignmentId(assignmentId);
    setStudentStep(nextStep);

    if (nextStep >= 3) {
      setTypedText(
        getFinalText(submission) ||
          getDraftText(submission)
      );
    } else {
      setTypedText(getDraftText(submission));
    }

    return true;
  }

  function closeStudentAssignment() {
    clearStudentWorkflowNotice();
    pauseCoachSession();
    saveActiveStudentAssignmentId(null);
    setSelectedAssignmentId(null);
    setStudentStep(1);
    setTypedText("");
  }

  function refreshStudentWorkspace() {
    loadStudentWorkspace();
    return syncWorkspaceRef.current?.();
  }

  return (
    <StudentWorkspaceContext.Provider
      value={{
        studentProfile,
        workspaceSyncState,

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
        openingAssignmentId,

        studentStep,
        setStudentStep,
        studentStepOverrides,
        rememberStudentStep,
        studentWorkflowNotice,
        showStudentWorkflowNotice,
        clearStudentWorkflowNotice,
        confirmStudentWorkflowNotice,
        goToStudentStep,
        openStudentAssignment,
        closeStudentAssignment,
        startCoachSession,
        pauseCoachSession,
        resumeCoachSession,

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
