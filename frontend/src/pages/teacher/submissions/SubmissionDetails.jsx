import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Calendar,
  FileText,
  ShieldAlert,
  ShieldCheck,
  CheckSquare,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Activity,
  Highlighter,
  Trash2,
  Plus,
  Minus,
  MessageSquare,
  Pencil,
  AlertTriangle,
  Eye,
  Info,
  X,
  BookOpen,
  Bot,
  Sparkles,
  Loader2,
  Wand2,
  BrainCircuit,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Clock3,
  Copy,
  MousePointerClick,
  Gauge,
} from "lucide-react";

import { useTeacherWorkspace } from "../../../hooks/useTeacherWorkspace";
import { buildReplayTimeline } from "../../../utils/replayTimeline";

const ANNOTATION_CODES = [
  { code: "CS", label: "Comma splice", type: "mechanics" },
  { code: "RO", label: "Run-on", type: "sentence" },
  { code: "FR", label: "Fragment", type: "sentence" },
  { code: "P", label: "Missing punctuation", type: "mechanics" },
  { code: "VT", label: "Wrong verb tense", type: "grammar" },
  { code: "WF", label: "Wrong word form", type: "grammar" },
  { code: "AGR", label: "Agreement error", type: "grammar" },
  { code: "SP", label: "Spelling error", type: "spelling" },
  { code: "WW", label: "Wrong word", type: "word choice" },
  { code: "GOOD", label: "Good", type: "positive" },
  { code: "NOTE", label: "Note", type: "note" },
];

const REVIEW_TABS = [
  { id: "feedback", label: "Feedback", icon: MessageSquare },
  { id: "annotations", label: "Marks", icon: Highlighter },
  { id: "signals", label: "Signals", icon: Activity },
];

function roundToHalf(value) {
  return Math.round(Number(value || 0) * 2) / 2;
}

function clampScore(value, min, max) {
  const numeric = Number(value || 0);

  if (Number.isNaN(numeric)) return min;
  if (numeric < min) return min;
  if (numeric > max) return max;

  return roundToHalf(numeric);
}

function buildDefaultBands(points = 0) {
  const max = Number(points || 0);

  return [
    {
      id: "excellent",
      label: "Excellent",
      points: roundToHalf(max),
      description: "Fully meets or exceeds expectations.",
    },
    {
      id: "good",
      label: "Good",
      points: roundToHalf(max * 0.85),
      description: "Meets the criterion well with minor gaps.",
    },
    {
      id: "satisfactory",
      label: "Satisfactory",
      points: roundToHalf(max * 0.7),
      description: "Meets basic expectations but needs development.",
    },
    {
      id: "needs-work",
      label: "Needs Work",
      points: roundToHalf(max * 0.5),
      description: "Partially meets the criterion.",
    },
    {
      id: "beginning",
      label: "Beginning",
      points: roundToHalf(max * 0.3),
      description: "Shows limited progress.",
    },
  ];
}

function normalizeCriterion(criterion = {}, index = 0) {
  const points = Number(
    criterion.points ?? criterion.maxPoints ?? criterion.weight ?? 0
  );

  return {
    id: criterion.id || `criterion_${index + 1}`,
    name: criterion.name || criterion.title || `Criterion ${index + 1}`,
    description:
      criterion.description ||
      criterion.guidelines ||
      criterion.descriptor ||
      "",
    points,
    bands:
      Array.isArray(criterion.bands) && criterion.bands.length > 0
        ? criterion.bands.map((band, bandIndex) => ({
            id: band.id || `band_${bandIndex + 1}`,
            label: band.label || band.name || `Level ${bandIndex + 1}`,
            points: Number(band.points ?? band.score ?? 0),
            description:
              band.description || band.feedback || band.descriptor || "",
          }))
        : buildDefaultBands(points),
  };
}

function normalizeRubric(rubric) {
  if (!rubric) return null;

  if (Array.isArray(rubric)) {
    const criteria = rubric.map(normalizeCriterion);

    return {
      id: "embedded_rubric",
      title: "Attached Rubric",
      criteria,
      totalPoints: criteria.reduce(
        (sum, criterion) => sum + Number(criterion.points || 0),
        0
      ),
    };
  }

  const rawCriteria =
    rubric.criteria ||
    rubric.rubricCriteria ||
    rubric.items ||
    rubric.dimensions ||
    [];

  const criteria = Array.isArray(rawCriteria)
    ? rawCriteria.map(normalizeCriterion)
    : [];

  return {
    ...rubric,
    id: rubric.id || rubric.rubricId || "embedded_rubric",
    title:
      rubric.title ||
      rubric.name ||
      rubric.rubricTitle ||
      "Attached Rubric",
    criteria,
    totalPoints:
      rubric.totalPoints ||
      rubric.maxPoints ||
      criteria.reduce(
        (sum, criterion) => sum + Number(criterion.points || 0),
        0
      ),
  };
}

function getScoreEntry(rubricScores, criterionId) {
  const value = rubricScores?.[criterionId];

  if (value && typeof value === "object") {
    return {
      criterionId,
      bandId: value.bandId || "",
      bandLabel: value.bandLabel || "",
      score:
        value.score !== null && value.score !== undefined ? value.score : "",
      comment: value.comment || "",
    };
  }

  return {
    criterionId,
    bandId: "",
    bandLabel: "",
    score: value !== null && value !== undefined ? value : "",
    comment: "",
  };
}

function countWords(text = "") {
  const clean = String(text || "").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function stripJsonFence(value = "") {
  const text = String(value || "").trim();
  const fenceMatch = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenceMatch ? fenceMatch[1].trim() : text;
}

function tryParseJsonPayload(value = "") {
  const raw = stripJsonFence(value);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const start = Math.min(
      ...[raw.indexOf("["), raw.indexOf("{")].filter((index) => index >= 0)
    );

    const end = Math.max(raw.lastIndexOf("]"), raw.lastIndexOf("}"));

    if (!Number.isFinite(start) || start < 0 || end <= start) {
      return null;
    }

    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function looksLikeStructuredJsonText(value = "") {
  const text = String(value || "").trim();

  if (!text) {
    return false;
  }

  if (/^```(?:json)?/i.test(text)) {
    return true;
  }

  return (
    (text.startsWith("[") || text.startsWith("{")) &&
    /"(lineNumber|excerpt|comment|issues|summary|overall)"/i.test(text)
  );
}

function extractStructuredAiFeedback(payload) {
  if (!payload) {
    return {
      summary: "",
      strengths: [],
      issues: [],
      nextSteps: [],
    };
  }

  if (Array.isArray(payload)) {
    return {
      summary: "",
      strengths: [],
      issues: payload,
      nextSteps: [],
    };
  }

  const nested =
    (payload.review && typeof payload.review === "object" && payload.review) ||
    (payload.feedback && typeof payload.feedback === "object" && payload.feedback) ||
    (payload.response && typeof payload.response === "object" && payload.response) ||
    null;

  const source = nested || payload;

  return {
    summary:
      source.overall ||
      source.summary ||
      source.overallFeedback ||
      source.feedbackSummary ||
      "",
    strengths: safeArray(source.strengths || source.positivePoints),
    issues: safeArray(
      source.issues || source.improvements || source.areasToImprove || source.items
    ),
    nextSteps: safeArray(source.nextSteps || source.recommendations || source.actionItems),
  };
}


function getSubmissionText(submission = {}) {
  return String(
    submission.finalText ||
      submission.submittedText ||
      submission.content ||
      submission.draftText ||
      submission.text ||
      submission.essay ||
      submission.response ||
      ""
  );
}

function formatDateTime(value) {
  if (!value) return " - ";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(value) {
  if (!value) return " - ";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatSubmittedDateTime(value) {
  if (!value) return "Not submitted";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${year}-${month}-${day} · ${time}`;
}

function getAnnotationTone(annotation = {}) {
  const code = String(annotation.code || "").toUpperCase();
  const type = String(annotation.type || "").toLowerCase();

  if (code === "GOOD" || type === "positive") {
    return {
      highlight:
        "bg-emerald-100/90 border-b-2 border-emerald-500 text-slate-950 after:bg-emerald-500 after:text-white",
      chip: "bg-emerald-50 border-emerald-200 text-emerald-700",
      tooltip: "border-emerald-200",
    };
  }

  if (code === "NOTE" || type === "note") {
    return {
      highlight:
        "bg-sky-100/90 border-b-2 border-sky-500 text-slate-950 after:bg-sky-500 after:text-white",
      chip: "bg-sky-50 border-sky-200 text-sky-700",
      tooltip: "border-sky-200",
    };
  }

  return {
    highlight:
      "bg-amber-100/95 border-b-2 border-amber-500 text-slate-950 after:bg-amber-500 after:text-white",
    chip: "bg-amber-50 border-amber-200 text-amber-700",
    tooltip: "border-amber-200",
  };
}

function getAnnotationTooltipText(annotation = {}) {
  const code = annotation.code || annotation.type || "NOTE";
  const label = annotation.label || annotation.type || "Instructor note";
  const comment = annotation.comment || label;

  return {
    code,
    label,
    comment,
  };
}

function getAnnotationRange(annotation, text) {
  const selectedText = String(annotation.selectedText || "");
  const rawStart = Number(annotation.rangeStart);
  const rawEnd = Number(annotation.rangeEnd);

  if (
    Number.isFinite(rawStart) &&
    Number.isFinite(rawEnd) &&
    rawStart >= 0 &&
    rawEnd > rawStart &&
    rawEnd <= text.length
  ) {
    return {
      start: rawStart,
      end: rawEnd,
    };
  }

  if (!selectedText.trim()) return null;

  const index = text.indexOf(selectedText);

  if (index < 0) return null;

  return {
    start: index,
    end: index + selectedText.length,
  };
}

function normalizeAnnotationRanges(text, annotations) {
  const normalized = safeArray(annotations)
    .map((annotation, index) => {
      const range = getAnnotationRange(annotation, text);
      if (!range) return null;

      return {
        ...annotation,
        rangeStart: range.start,
        rangeEnd: range.end,
        order: index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.rangeStart !== b.rangeStart) {
        return a.rangeStart - b.rangeStart;
      }

      return a.rangeEnd - b.rangeEnd;
    });

  const clean = [];
  let cursor = 0;

  normalized.forEach((annotation) => {
    if (annotation.rangeStart < cursor) return;
    if (annotation.rangeStart >= annotation.rangeEnd) return;

    clean.push(annotation);
    cursor = annotation.rangeEnd;
  });

  return clean;
}

function getFloatingPosition(rect) {
  const width = 560;
  const margin = 16;

  let left = rect.left;
  let top = rect.top - 14;

  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - width - margin;
  }

  if (left < margin) {
    left = margin;
  }

  if (top < margin + 70) {
    top = rect.bottom + 12;
  }

  return {
    left,
    top,
    width: Math.min(width, window.innerWidth - margin * 2),
  };
}

function getSelectionOffsets(container) {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0) return null;

  const rawText = selection.toString();

  if (!rawText || !rawText.trim()) return null;

  const range = selection.getRangeAt(0);

  if (!container.contains(range.commonAncestorContainer)) {
    return null;
  }

  const rect = range.getBoundingClientRect();

  if (!rect || rect.width === 0) return null;

  const preRange = document.createRange();
  preRange.selectNodeContents(container);
  preRange.setEnd(range.startContainer, range.startOffset);

  let start = preRange.toString().length;
  let end = start + rawText.length;

  const leadingWhitespace = rawText.match(/^\s*/)?.[0]?.length || 0;
  const trailingWhitespace = rawText.match(/\s*$/)?.[0]?.length || 0;

  start += leadingWhitespace;
  end -= trailingWhitespace;

  const selectedText = rawText.trim();

  if (!selectedText || end <= start) return null;

  return {
    selectedText,
    rangeStart: start,
    rangeEnd: end,
    toolbarPosition: getFloatingPosition(rect),
  };
}

function renderAnnotatedText(text, annotations, onDeleteAnnotation) {
  const cleanText = String(text || "");
  const annotationRanges = normalizeAnnotationRanges(cleanText, annotations);

  if (annotationRanges.length === 0) {
    return cleanText;
  }

  const parts = [];
  let cursor = 0;

  annotationRanges.forEach((annotation) => {
    if (annotation.rangeStart > cursor) {
      parts.push(cleanText.slice(cursor, annotation.rangeStart));
    }

    const annotatedText = cleanText.slice(
      annotation.rangeStart,
      annotation.rangeEnd
    );

    parts.push(
      <AnnotationHighlight
        key={annotation.id || `${annotation.rangeStart}-${annotation.rangeEnd}`}
        annotation={annotation}
        onDelete={onDeleteAnnotation}
      >
        {annotatedText}
      </AnnotationHighlight>
    );

    cursor = annotation.rangeEnd;
  });

  if (cursor < cleanText.length) {
    parts.push(cleanText.slice(cursor));
  }

  return parts;
}

function getSelfAssessmentSummary(submission, rubricTotal) {
  const hasSelfAssessment =
    submission?.selfRubricAssessment ||
    submission?.selfAssessment ||
    submission?.selfRubricScores ||
    submission?.selfRubricTotal !== undefined;

  if (!hasSelfAssessment) return null;

  const score = submission.selfRubricTotal ?? " - ";
  const max = submission.selfRubricMax ?? rubricTotal ?? " - ";
  const percent =
    submission.selfRubricPercentage !== undefined &&
    submission.selfRubricPercentage !== null
      ? ` · ${submission.selfRubricPercentage}%`
      : "";

  return `${score} / ${max}${percent}`;
}

function hasGradeSheetValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ""
  );
}

function firstNonEmptyArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function normalizeConversationMessage(message, index = 0) {
  if (typeof message === "string") {
    return {
      id: `message_${index}`,
      role: "student",
      content: message,
      createdAt: null,
    };
  }

  return {
    id: message?.id || `message_${index}`,
    role:
      message?.role ||
      message?.sender ||
      message?.authorRole ||
      message?.type ||
      "student",
    content:
      message?.content ||
      message?.message ||
      message?.text ||
      message?.response ||
      message?.prompt ||
      "",
    createdAt:
      message?.createdAt ||
      message?.timestamp ||
      message?.sentAt ||
      message?.date ||
      null,
  };
}

function getPlanningChatMessages(submission) {
  const direct = firstNonEmptyArray(
    submission?.planningChat,
    submission?.planningMessages,
    submission?.planningConversation,
    submission?.coachChatHistory,
    submission?.chatHistory,
    submission?.planning?.messages,
    submission?.conversations?.planning
  );

  return direct
    .map(normalizeConversationMessage)
    .filter((message) => String(message.content || "").trim());
}

function normalizeStudentAiFeedbackIssue(issue = {}, index = 0) {
  if (typeof issue === "string") {
    return {
      id: `issue_${index + 1}`,
      excerpt: "",
      problem: issue,
      suggestion: "",
      severity: "medium",
    };
  }

  return {
    id: issue.id || `issue_${index + 1}`,
    excerpt:
      issue.excerpt ||
      issue.quote ||
      issue.selectedText ||
      issue.text ||
      "",
    problem:
      issue.problem ||
      issue.issue ||
      issue.comment ||
      issue.description ||
      "",
    suggestion:
      issue.suggestion ||
      issue.advice ||
      issue.fix ||
      issue.recommendation ||
      "",
    severity: String(
      issue.severity ||
        issue.level ||
        "medium"
    ).toLowerCase(),
  };
}

function normalizeStudentAiFeedback(item, index = 0) {
  if (typeof item === "string") {
    return {
      id: `ai_feedback_${index}`,
      overall: item,
      strengths: [],
      issues: [],
      nextSteps: [],
      rawText: item,
      request: "",
      used: null,
      saved: true,
      createdAt: null,
      draftWordCount: null,
      assignmentTitle: "",
    };
  }

  const source =
    item?.feedback &&
    typeof item.feedback === "object"
      ? item.feedback
      : item || {};

  const nestedResponse =
    source.response &&
    typeof source.response === "object"
      ? source.response
      : {};

  const rawPayloadCandidate =
    source.rawText ||
    source.rawResponse ||
    (typeof source.response === "string" ? source.response : "") ||
    (typeof source.feedback === "string" ? source.feedback : "") ||
    nestedResponse.rawText ||
    "";

  const parsedPayload = tryParseJsonPayload(rawPayloadCandidate);
  const structuredFeedback = extractStructuredAiFeedback(parsedPayload);

  const overall =
    source.overall ||
    source.summary ||
    source.overallFeedback ||
    source.feedbackSummary ||
    structuredFeedback.summary ||
    nestedResponse.overall ||
    nestedResponse.summary ||
    (typeof source.feedback === "string"
      ? source.feedback
      : "") ||
    (typeof source.response === "string"
      ? source.response
      : "") ||
    source.aiResponse ||
    source.suggestion ||
    source.content ||
    source.message ||
    "";

  const strengths = safeArray(
    source.strengths ||
      source.positivePoints ||
      nestedResponse.strengths
  )
    .map((strength) =>
      typeof strength === "string"
        ? strength
        : strength?.text ||
          strength?.description ||
          strength?.comment ||
          ""
    )
    .filter(Boolean);

  const parsedStrengths = safeArray(structuredFeedback.strengths)
    .map((strength) =>
      typeof strength === "string"
        ? strength
        : strength?.text || strength?.description || strength?.comment || ""
    )
    .filter(Boolean);

  const issues = safeArray(
    source.issues ||
      source.improvements ||
      source.areasToImprove ||
      nestedResponse.issues
  )
    .map(normalizeStudentAiFeedbackIssue)
    .filter(
      (issue) =>
        issue.excerpt ||
        issue.problem ||
        issue.suggestion
    );

  const parsedIssues = safeArray(structuredFeedback.issues)
    .map(normalizeStudentAiFeedbackIssue)
    .filter(
      (issue) => issue.excerpt || issue.problem || issue.suggestion
    );

  const nextSteps = safeArray(
    source.nextSteps ||
      source.recommendations ||
      source.actionItems ||
      nestedResponse.nextSteps
  )
    .map((step) =>
      typeof step === "string"
        ? step
        : step?.text ||
          step?.description ||
          step?.action ||
          ""
    )
    .filter(Boolean);

  const parsedNextSteps = safeArray(structuredFeedback.nextSteps)
    .map((step) =>
      typeof step === "string"
        ? step
        : step?.text || step?.description || step?.action || ""
    )
    .filter(Boolean);

  const rawText =
    source.rawText ||
    source.rawResponse ||
    nestedResponse.rawText ||
    "";

  const finalStrengths = strengths.length > 0 ? strengths : parsedStrengths;
  const finalIssues = issues.length > 0 ? issues : parsedIssues;
  const finalNextSteps = nextSteps.length > 0 ? nextSteps : parsedNextSteps;

  const sanitizedOverall = String(overall || "").trim();
  const parsedSummary =
    finalIssues.length > 0
      ? `AI identified ${finalIssues.length} revision point${finalIssues.length === 1 ? "" : "s"}.`
      : "";

  const shouldReplaceOverallWithSummary =
    !!parsedSummary &&
    (
      !sanitizedOverall ||
      !!tryParseJsonPayload(sanitizedOverall) ||
      looksLikeStructuredJsonText(sanitizedOverall)
    );

  const finalOverall =
    shouldReplaceOverallWithSummary
      ? parsedSummary
      : sanitizedOverall;

  return {
    id:
      source.id ||
      item?.id ||
      `ai_feedback_${index}`,
    overall: finalOverall,
    strengths: finalStrengths,
    issues: finalIssues,
    nextSteps: finalNextSteps,
    rawText,
    request:
      source.request ||
      source.prompt ||
      source.studentMessage ||
      source.draftExcerpt ||
      source.input ||
      "",
    used:
      source.used ??
      source.applied ??
      source.accepted ??
      source.inserted ??
      item?.used ??
      null,
    saved:
      source.saved ??
      item?.saved ??
      true,
    createdAt:
      source.createdAt ||
      item?.createdAt ||
      source.timestamp ||
      item?.timestamp ||
      source.requestedAt ||
      item?.requestedAt ||
      null,
    draftWordCount:
      source.draftWordCount ??
      item?.draftWordCount ??
      source.wordCount ??
      item?.wordCount ??
      null,
    assignmentTitle:
      source.assignmentTitle ||
      item?.assignmentTitle ||
      "",
  };
}

function getStudentAiFeedbackHistory(submission) {
  const direct = firstNonEmptyArray(
    submission?.feedbackHistory,
    submission?.aiFeedbackHistory,
    submission?.studentAiFeedbackHistory,
    submission?.aiFeedbackUsed,
    submission?.draftFeedbackHistory,
    submission?.coachFeedbackHistory
  );

  return direct
    .map(normalizeStudentAiFeedback)
    .filter(
      (item) =>
        String(item.overall || "").trim() ||
        item.strengths.length > 0 ||
        item.issues.length > 0 ||
        item.nextSteps.length > 0 ||
        String(item.rawText || "").trim()
    );
}

function getWritingReplayEvents(submission) {
  return firstNonEmptyArray(
    submission?.writingEvents,
    submission?.writingReplay,
    submission?.writingHistory,
    submission?.draftEvents,
    submission?.playbackEvents,
    submission?.autosaveHistory
  )
    .map((event, index) => ({
      ...event,
      id: event?.id || `writing_event_${index}`,
      timestamp:
        event?.timestamp || event?.createdAt || event?.savedAt || event?.date || null,
    }))
    .sort(
      (a, b) =>
        new Date(a.timestamp || 0).getTime() -
        new Date(b.timestamp || 0).getTime()
    );
}

function normalizeAiSuggestion(rawData, rubricCriteria, rubricTotal) {
  const data =
    rawData?.review ||
    rawData?.aiReview ||
    rawData?.suggestion ||
    rawData?.result ||
    rawData ||
    {};

  const feedback =
    data.suggestedFeedback ||
    data.feedback ||
    data.teacherFeedback ||
    data.summaryFeedback ||
    data.comment ||
    "";

  const summary =
    data.summary ||
    data.overall ||
    data.overallSummary ||
    "AI review completed. Review the suggestion before applying it.";

  const strengths = safeArray(data.strengths || data.positivePoints);
  const improvements = safeArray(
    data.improvements || data.issues || data.nextSteps || data.recommendations
  );

  const rawScores =
    data.criteria ||
    data.rubricScores ||
    data.scores ||
    data.criterionScores ||
    [];

  let criteriaScores = [];

  if (Array.isArray(rawScores)) {
    criteriaScores = rawScores.map((item, index) => {
      const matchedCriterion =
        rubricCriteria.find(
          (criterion) =>
            String(criterion.id) === String(item.criterionId || item.id) ||
            String(criterion.name).toLowerCase() ===
              String(item.criterionName || item.name || "").toLowerCase()
        ) || rubricCriteria[index];

      const score = clampScore(
        item.score ?? item.points ?? item.value ?? 0,
        0,
        matchedCriterion?.points || rubricTotal || 100
      );

      const closestBand = matchedCriterion?.bands
        ?.slice()
        .sort(
          (a, b) =>
            Math.abs(Number(a.points || 0) - score) -
            Math.abs(Number(b.points || 0) - score)
        )?.[0];

      return {
        criterionId: matchedCriterion?.id || item.criterionId || item.id,
        criterionName:
          matchedCriterion?.name ||
          item.criterionName ||
          item.name ||
          `Criterion ${index + 1}`,
        score,
        maxPoints: matchedCriterion?.points || item.maxPoints || "",
        bandId: item.bandId || closestBand?.id || "",
        bandLabel: item.bandLabel || item.level || closestBand?.label || "",
        comment:
          item.comment ||
          item.reason ||
          item.feedback ||
          item.explanation ||
          "",
      };
    });
  } else if (rawScores && typeof rawScores === "object") {
    criteriaScores = Object.entries(rawScores).map(([key, value]) => {
      const matchedCriterion =
        rubricCriteria.find(
          (criterion) =>
            String(criterion.id) === String(key) ||
            String(criterion.name).toLowerCase() === String(key).toLowerCase()
        ) || {};

      const rawValue = value && typeof value === "object" ? value : {};
      const score = clampScore(
        rawValue.score ?? rawValue.points ?? value ?? 0,
        0,
        matchedCriterion.points || rubricTotal || 100
      );

      const closestBand = matchedCriterion?.bands
        ?.slice()
        .sort(
          (a, b) =>
            Math.abs(Number(a.points || 0) - score) -
            Math.abs(Number(b.points || 0) - score)
        )?.[0];

      return {
        criterionId: matchedCriterion.id || key,
        criterionName: matchedCriterion.name || key,
        score,
        maxPoints: matchedCriterion.points || rawValue.maxPoints || "",
        bandId: rawValue.bandId || closestBand?.id || "",
        bandLabel: rawValue.bandLabel || rawValue.level || closestBand?.label || "",
        comment:
          rawValue.comment ||
          rawValue.reason ||
          rawValue.feedback ||
          rawValue.explanation ||
          "",
      };
    });
  }

  const finalScore =
    data.finalScore ??
    data.score ??
    data.suggestedScore ??
    criteriaScores.reduce((sum, item) => sum + Number(item.score || 0), 0);

  return {
    summary,
    feedback,
    strengths,
    improvements,
    criteriaScores,
    finalScore: clampScore(finalScore, 0, rubricTotal || 100),
    createdAt: new Date().toISOString(),
  };
}

const SubmissionDetails = forwardRef(function SubmissionDetails(
  {
    submission,
    onSaveReview,
    readOnly = false,
  },
  ref
) {
  const { rubrics = [], getRubricForAssignment } =
    useTeacherWorkspace() || {};

  const [feedback, setFeedback] = useState("");
  const [manualScore, setManualScore] = useState("");
  const [rubricScores, setRubricScores] = useState({});
  const [finalOverrideEnabled, setFinalOverrideEnabled] = useState(false);
  const [finalOverride, setFinalOverride] = useState("");
  const [saveMessage, setSaveMessage] = useState("");

  const [annotations, setAnnotations] = useState([]);
  const annotationsRef = useRef([]);

  const [selectedText, setSelectedText] = useState("");
  const [selectedRange, setSelectedRange] = useState(null);
  const [selectionToolbar, setSelectionToolbar] = useState(null);
  const [annotationComment, setAnnotationComment] = useState("");
  const [annotationMessage, setAnnotationMessage] = useState("");

  
  const [reviewMode, setReviewMode] = useState("grading");

  const [aiReviewLoading, setAiReviewLoading] = useState(false);
  const [aiReviewError, setAiReviewError] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [aiRubricApplied, setAiRubricApplied] = useState(false);
  const [aiFeedbackApplied, setAiFeedbackApplied] = useState(false);

  const studentTextRef = useRef(null);

  useImperativeHandle(ref, () => ({
    saveReview: handleSave,
    getGradeSheetData: buildGradeSheetData,
  }));

  const currentRubric = useMemo(() => {
    if (!submission) return null;

    const embeddedRubrics = [
      submission.rubricSchema,
      submission.assignment?.rubricSchema,
      submission.assignmentDetails?.rubricSchema,
      submission.rubric,
      submission.assignment?.rubric,
      submission.assignmentDetails?.rubric,
      submission.assignment?.rubricCriteria,
      submission.assignmentDetails?.rubricCriteria,
      submission.rubricCriteria,
    ];

    for (const rubric of embeddedRubrics) {
      const normalized = normalizeRubric(rubric);

      if (normalized && normalized.criteria.length > 0) {
        return normalized;
      }
    }

    if (typeof getRubricForAssignment === "function") {
      const rubricFromContext = getRubricForAssignment(submission.assignmentId);
      const normalized = normalizeRubric(rubricFromContext);

      if (normalized && normalized.criteria.length > 0) {
        return normalized;
      }
    }

    const activeRubric = rubrics.find(
      (rubric) =>
        String(rubric.assignmentId) === String(submission.assignmentId) &&
        String(rubric.status).toLowerCase() === "active"
    );

    const normalizedActive = normalizeRubric(activeRubric);

    if (normalizedActive && normalizedActive.criteria.length > 0) {
      return normalizedActive;
    }

    const fallbackRubric = rubrics.find(
      (rubric) => String(rubric.assignmentId) === String(submission.assignmentId)
    );

    const normalizedFallback = normalizeRubric(fallbackRubric);

    return normalizedFallback && normalizedFallback.criteria.length > 0
      ? normalizedFallback
      : null;
  }, [rubrics, submission, getRubricForAssignment]);

  const rubricCriteria = Array.isArray(currentRubric?.criteria)
    ? currentRubric.criteria
    : [];

  const rubricTotal = Number(currentRubric?.totalPoints || 0);

  const selfAssessmentSummary = getSelfAssessmentSummary(
    submission,
    rubricTotal
  );

  const rubricScoreTotal = currentRubric
    ? rubricCriteria.reduce((sum, criterion) => {
        const entry = getScoreEntry(rubricScores, criterion.id);
        return sum + Number(entry.score || 0);
      }, 0)
    : 0;

  const gradedCriteriaCount = currentRubric
    ? rubricCriteria.filter((criterion) => {
        const entry = getScoreEntry(rubricScores, criterion.id);
        return entry.score !== "" && entry.score !== null;
      }).length
    : 0;

  const finalDisplayedScore = currentRubric
    ? finalOverrideEnabled && finalOverride !== ""
      ? Number(finalOverride)
      : rubricScoreTotal
    : manualScore;

  useEffect(() => {
    if (!submission) return;

    const savedAnnotations = Array.isArray(submission.annotations)
      ? submission.annotations
      : [];

    setFeedback(submission.feedback || "");
    setManualScore(submission.score ?? "");
    setRubricScores(submission.rubricScores || {});
    setFinalOverrideEnabled(Boolean(submission.rubricOverride));
    setFinalOverride(
      submission.rubricOverride ? String(submission.score ?? "") : ""
    );

    setAnnotations(savedAnnotations);
    annotationsRef.current = savedAnnotations;

    setSelectedText("");
    setSelectedRange(null);
    setSelectionToolbar(null);
    setAnnotationComment("");
    setSaveMessage("");
    setAnnotationMessage("");
    setReviewMode("grading");
    setAiReviewError("");
    setAiSuggestion(
      submission.aiTeacherReviewSuggestion ||
        submission.aiReviewSuggestion ||
        null
    );
    setAiRubricApplied(
      Boolean(submission.aiRubricSuggestionApplied)
    );
    setAiFeedbackApplied(
      Boolean(submission.aiFeedbackSuggestionApplied)
    );
  }, [submission?.id]);

  if (!submission) return null;

  const submissionText =
    submission.submittedText ||
    submission.submissionText ||
    submission.finalText ||
    submission.content ||
    submission.draftText ||
    submission.text ||
    "";

  const integrityLogs = safeArray(submission.integrityLogs);
  const copyPasteLogs = safeArray(submission.copyPasteLogs);
  const focusLossLogs = safeArray(submission.focusLossLogs);
  const writingEvents = safeArray(submission.writingEvents);

  const planningChatMessages = getPlanningChatMessages(submission);
  const studentAiFeedbackHistory = getStudentAiFeedbackHistory(submission);
  const writingReplayEvents = getWritingReplayEvents(submission);

  const pasteAttemptCount = Number(
    submission.pasteAttemptCount ?? copyPasteLogs.length ?? 0
  );

  const focusLossCount = Number(
    submission.focusLossCount ?? focusLossLogs.length ?? 0
  );

  const feedbackChecksUsed = Number(
    submission.feedbackChecksUsed ??
      safeArray(submission.feedbackHistory).length ??
      0
  );

  const hasAiFlags = Number(submission.aiFlags || 0) > 0;
  const aiFlagCount = Number(submission.aiFlags || 0);
  const integrityFlagCount = pasteAttemptCount + focusLossCount + aiFlagCount;

  const hasReviewSignals =
    integrityFlagCount > 0 ||
    writingEvents.length > 0 ||
    feedbackChecksUsed > 0 ||
    Boolean(submission.honorConfirmed);

  const wordCount = submission.wordCount || countWords(submissionText);

  const integrityDescription = `${integrityFlagCount} integrity signal${
    integrityFlagCount === 1 ? "" : "s"
  } recorded:
Paste attempts: ${pasteAttemptCount}
Focus loss / tab switching: ${focusLossCount}
AI / external flags: ${aiFlagCount}

These are instructor-only review signals and are not automatic grades.`;

  function updateRubricEntry(criterionId, nextEntry) {
    if (readOnly) return;

    setRubricScores((prev) => {
      const previousEntry = getScoreEntry(prev, criterionId);

      return {
        ...prev,
        [criterionId]: {
          ...previousEntry,
          ...nextEntry,
          criterionId,
        },
      };
    });
  }

  function selectBand(criterion, band) {
    updateRubricEntry(criterion.id, {
      bandId: band.id,
      bandLabel: band.label,
      score: clampScore(band.points, 0, criterion.points),
    });
  }

  function adjustCriterionScore(criterion, delta) {
    const entry = getScoreEntry(rubricScores, criterion.id);
    const currentScore = Number(entry.score || 0);

    updateRubricEntry(criterion.id, {
      score: clampScore(currentScore + delta, 0, criterion.points),
    });
  }

  function updateCriterionScore(criterion, value) {
    updateRubricEntry(criterion.id, {
      score: clampScore(value, 0, criterion.points),
    });
  }

  function updateCriterionComment(criterionId, comment) {
    updateRubricEntry(criterionId, {
      comment,
    });
  }

  function captureSelectedText() {
    if (reviewMode !== "grading") return;

    const container = studentTextRef.current;
    if (!container) return;

    const selectionInfo = getSelectionOffsets(container);

    if (!selectionInfo) return;

    setSelectedText(selectionInfo.selectedText);
    setSelectedRange({
      rangeStart: selectionInfo.rangeStart,
      rangeEnd: selectionInfo.rangeEnd,
    });
    setSelectionToolbar(selectionInfo.toolbarPosition);
    setAnnotationMessage("");
  }

  function clearSelectionState() {
    setSelectedText("");
    setSelectedRange(null);
    setSelectionToolbar(null);
    setAnnotationComment("");
    window.getSelection()?.removeAllRanges();
  }

  function addAnnotation(codeItem) {
    if (readOnly) {
      setAnnotationMessage(
        "Previous attempts are read-only."
      );
      return;
    }

    if (!codeItem) {
      setAnnotationMessage("Choose an annotation code.");
      return;
    }

    const cleanSelectedText = selectedText.trim();
    let cleanComment = annotationComment.trim();

    if (!cleanSelectedText) {
      setAnnotationMessage("Select text from the student submission first.");
      return;
    }

    if (codeItem.code === "NOTE" && !cleanComment) {
      setAnnotationMessage("Write the note in the note box before adding it.");
      return;
    }

    let rangeStart = selectedRange?.rangeStart;
    let rangeEnd = selectedRange?.rangeEnd;

    if (
      !Number.isFinite(Number(rangeStart)) ||
      !Number.isFinite(Number(rangeEnd)) ||
      Number(rangeEnd) <= Number(rangeStart)
    ) {
      const fallbackIndex = submissionText.indexOf(cleanSelectedText);

      if (fallbackIndex >= 0) {
        rangeStart = fallbackIndex;
        rangeEnd = fallbackIndex + cleanSelectedText.length;
      }
    }

    const newAnnotation = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      selectedText: cleanSelectedText,
      rangeStart: Number(rangeStart),
      rangeEnd: Number(rangeEnd),
      comment: cleanComment || codeItem.label,
      type: codeItem.type,
      code: codeItem.code,
      label: codeItem.label,
      createdAt: new Date().toISOString(),
    };

    const nextAnnotations = [...annotationsRef.current, newAnnotation];

    annotationsRef.current = nextAnnotations;
    setAnnotations(nextAnnotations);

    clearSelectionState();

    setAnnotationMessage(`${codeItem.code} added. Save the review to keep it.`);
  }

  function deleteAnnotation(annotationId) {
    if (readOnly) {
      setAnnotationMessage(
        "Previous attempts are read-only."
      );
      return;
    }

    const nextAnnotations = annotationsRef.current.filter(
      (annotation) => annotation.id !== annotationId
    );

    annotationsRef.current = nextAnnotations;
    setAnnotations(nextAnnotations);

    setAnnotationMessage("Mark removed. Save the review to keep changes.");
  }

  async function handleAiCheck() {
    if (readOnly) {
      setAiReviewError(
        "Previous attempts are read-only."
      );
      return;
    }

    if (!submissionText.trim()) {
      setAiReviewError("No student text is available for AI check.");
      setReviewMode("grading");
      return;
    }

    setReviewMode("grading");
    setAiReviewLoading(true);
    setAiReviewError("");
    setAiSuggestion(null);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || "";

      const response = await fetch(
        `${apiBase}/api/teacher/ai-review-submission`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            submissionId: submission.id,
            assignmentId: submission.assignmentId,
            assignmentTitle: submission.assignmentTitle,
            studentEmail: submission.studentEmail,
            studentText: submissionText,
            wordCount,
            rubric: currentRubric,
            rubricCriteria,
            rubricTotal,
            existingAnnotations: annotations,
            integritySignals: {
              pasteAttemptCount,
              focusLossCount,
              aiFlagCount,
              feedbackChecksUsed,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`AI review failed with status ${response.status}`);
      }

      const rawData = await response.json();
      const normalizedSuggestion = normalizeAiSuggestion(
        rawData,
        rubricCriteria,
        rubricTotal
      );

      setAiSuggestion(normalizedSuggestion);
      setSaveMessage(
        "AI check completed. Review the suggestion before applying anything."
      );
    } catch (error) {
      console.error("AI review error:", error);

      setAiReviewError(
        "AI Check could not run. Confirm backend route POST /api/teacher/ai-review-submission is running and VITE_API_BASE_URL points to the backend."
      );
    } finally {
      setAiReviewLoading(false);
    }
  }

  function applyAiRubricScores() {
    if (!aiSuggestion) return;

    if (!currentRubric) {
      setManualScore(aiSuggestion.finalScore || "");
      setAiRubricApplied(true);
      setSaveMessage("AI suggested manual score applied. Review before saving.");
      setReviewMode("grading");
      return;
    }

    const nextRubricScores = {
      ...rubricScores,
    };

    aiSuggestion.criteriaScores.forEach((item) => {
      if (!item.criterionId) return;

      const criterion = rubricCriteria.find(
        (rubricCriterion) =>
          String(rubricCriterion.id) === String(item.criterionId)
      );

      nextRubricScores[item.criterionId] = {
        criterionId: item.criterionId,
        criterionName: item.criterionName || criterion?.name || "",
        maxPoints: criterion?.points || item.maxPoints || 0,
        bandId: item.bandId || "",
        bandLabel: item.bandLabel || "",
        score: clampScore(item.score, 0, criterion?.points || rubricTotal || 100),
        comment: item.comment || "",
      };
    });

    setRubricScores(nextRubricScores);
    setAiRubricApplied(true);
    setReviewMode("grading");
    setSaveMessage("AI suggested rubric scores applied. Review before saving.");
  }

  function applyAiFeedback() {
    const suggestion = String(aiSuggestion?.feedback || "").trim();

    if (!suggestion) return;

    setFeedback((currentFeedback) => {
      const current = String(currentFeedback || "").trim();

      if (current.includes(suggestion)) {
        return currentFeedback;
      }

      return current ? `${current}\n\n${suggestion}` : suggestion;
    });

    setAiFeedbackApplied(true);
    setSaveMessage(
      "AI feedback added as an instructor comment. Review and edit it before saving."
    );
  }

  function buildGradeSheetData() {
    const assignment =
      submission.assignment ||
      submission.assignmentDetails ||
      {};

    const dynamicRubricCriteria =
      rubricCriteria.map(
        (criterion, index) => {
          const entry =
            getScoreEntry(
              rubricScores,
              criterion.id
            );

          const selectedBand =
            safeArray(
              criterion.bands
            ).find(
              (band) =>
                String(band.id) ===
                String(
                  entry.bandId || ""
                )
            );

          return {
            ...criterion,

            reportKey:
              `${criterion.id || "criterion"}::${index}`,

            scoreEntry: {
              criterionId:
                criterion.id,

              criterionName:
                criterion.name,

              maxPoints:
                Number(
                  criterion.points ||
                    0
                ),

              bandId:
                entry.bandId ||
                "",

              bandLabel:
                entry.bandLabel ||
                selectedBand?.label ||
                "",

              score:
                entry.score === "" ||
                entry.score === null ||
                entry.score ===
                  undefined
                  ? null
                  : Number(
                      entry.score
                    ),

              comment:
                entry.comment ||
                "",

              description:
                criterion.description ||
                "",

              selectedBandDescription:
                selectedBand?.description ||
                "",
            },
          };
        }
      );

    const rubricTotalFromCriteria =
      rubricCriteria.reduce(
        (sum, criterion) =>
          sum +
          Number(
            criterion.points ||
              0
          ),
        0
      );

    const manualMaximum =
      Number(
        submission.rubricTotal ??
          submission.maxScore ??
          submission.pointsPossible ??
          assignment.rubricTotal ??
          assignment.totalPoints ??
          assignment.maxScore ??
          assignment.pointsPossible ??
          0
      ) || null;

    const resolvedRubricTotal =
      currentRubric
        ? Number(
            rubricTotal ||
              rubricTotalFromCriteria ||
              0
          ) || null
        : manualMaximum;

    const displayedFinalScore =
      currentRubric
        ? finalOverrideEnabled &&
          finalOverride !== ""
          ? Number(
              finalOverride
            )
          : gradedCriteriaCount > 0
          ? rubricScoreTotal
          : hasGradeSheetValue(
              submission.score
            )
          ? Number(
              submission.score
            )
          : null
        : manualScore !== ""
        ? Number(
            manualScore
          )
        : hasGradeSheetValue(
            submission.score
          )
        ? Number(
            submission.score
          )
        : null;

    const selfAssessmentScore =
      submission.selfRubricTotal ??
      submission.selfGradeScore ??
      submission.selfAssessmentScore ??
      null;

    const selfAssessmentMax =
      submission.selfRubricMax ??
      submission.selfGradeMax ??
      resolvedRubricTotal ??
      null;

    const selfAssessmentPercentage =
      submission.selfRubricPercentage ??
      submission.selfGradePercentage ??
      (hasGradeSheetValue(
        selfAssessmentScore
      ) &&
      Number(
        selfAssessmentMax
      ) > 0
        ? Math.round(
            (Number(
              selfAssessmentScore
            ) /
              Number(
                selfAssessmentMax
              )) *
              100
          )
        : null);

    const finalText =
      String(
        submissionText || ""
      );

    const actualFeedbackChecks =
      Math.max(
        Number(
          feedbackChecksUsed || 0
        ),
        studentAiFeedbackHistory.length
      );

    return {
      submission: {
        ...submission,

        content:
          finalText,

        finalText:
          finalText,

        submittedText:
          finalText,

        text:
          finalText,

        annotations:
          annotationsRef.current,
      },

      studentName:
        submission.studentName ||
        "Student",

      studentEmail:
        submission.studentEmail ||
        "",

      assignmentTitle:
        assignment.title ||
        submission.assignmentTitle ||
        "Assignment",

      assignmentInstructions:
        assignment.instructions ||
        assignment.description ||
        assignment.prompt ||
        submission.assignmentPrompt ||
        "",

      deadline:
        assignment.dueDate ||
        assignment.deadline ||
        assignment.dueAt ||
        submission.dueDate ||
        null,

      status:
        submission.status ||
        "Submitted",

      submittedAt:
        submission.resubmittedAt ||
        submission.submittedAt ||
        submission.createdAt ||
        null,

      reviewedAt:
        submission.reviewedAt ||
        null,

      attemptNumber:
        Number(
          submission.attemptNumber ||
            1
        ),

      isCurrent:
        submission.isCurrent !==
        false,

      wordCount:
        Number(
          submission.wordCount
        ) ||
        countWords(
          finalText
        ),

      finalScore:
        displayedFinalScore,

      rubricTotal:
        resolvedRubricTotal,

      rubricTitle:
        currentRubric?.title ||
        submission.rubricTitle ||
        "Rubric",

      rubricCriteria:
        dynamicRubricCriteria,

      rubricScores,

      gradedCriteriaCount,

      feedback:
        feedback || "",

      selfAssessmentScore,
      selfAssessmentMax,
      selfAssessmentPercentage,

      selfAssessmentSummary:
        hasGradeSheetValue(
          selfAssessmentScore
        )
          ? `${selfAssessmentScore}${
              hasGradeSheetValue(
                selfAssessmentMax
              )
                ? ` / ${selfAssessmentMax}`
                : ""
            }${
              hasGradeSheetValue(
                selfAssessmentPercentage
              )
                ? ` · ${selfAssessmentPercentage}%`
                : ""
            }`
          : null,

      annotations:
        annotationsRef.current,

      planningChatMessages,
      studentAiFeedbackHistory,
      writingReplayEvents,
      writingEvents,
      copyPasteLogs,
      focusLossLogs,
      integrityLogs,

      pasteAttemptCount,
      focusLossCount,
      aiFlagCount,
      integrityFlagCount,

      feedbackChecksUsed:
        actualFeedbackChecks,

      aiSuggestion,

      honorConfirmed:
        Boolean(
          submission.honorConfirmed
        ),

      generatedAt:
        new Date().toISOString(),
    };
  }

  async function handleSave() {
    if (readOnly) {
      setSaveMessage(
        "Previous attempts are read-only. Review the current attempt instead."
      );
      return;
    }

    let finalScore = manualScore;
    let cleanedRubricScores = {};
    let calculatedRubricScore = rubricScoreTotal;

    if (currentRubric) {
      for (const criterion of rubricCriteria) {
        const entry = getScoreEntry(rubricScores, criterion.id);
        const hasExplicitScore =
          entry.score !== "" &&
          entry.score !== null &&
          entry.score !== undefined;

        if (!hasExplicitScore) {
          setSaveMessage(
            `Select a score for "${criterion.name}" before saving the final review.`
          );
          setReviewMode("grading");
          return;
        }

        const numericValue = Number(entry.score);

        const isHalfStepScore =
          Math.abs(
            numericValue * 2 -
              Math.round(numericValue * 2)
          ) < 1e-9;

        if (
          Number.isNaN(numericValue) ||
          numericValue < 0 ||
          numericValue > Number(criterion.points)
        ) {
          setSaveMessage(
            `Score for "${criterion.name}" must be between 0 and ${criterion.points}.`
          );
          setReviewMode("grading");
          return;
        }

        if (!isHalfStepScore) {
          setSaveMessage(
            `Score for "${criterion.name}" must use 0.5 increments.`
          );
          setReviewMode("grading");
          return;
        }

        cleanedRubricScores[criterion.id] = {
          criterionId: criterion.id,
          criterionName: criterion.name,
          maxPoints: Number(criterion.points || 0),
          bandId: entry.bandId || "",
          bandLabel: entry.bandLabel || "",
          score: numericValue,
          comment: entry.comment || "",
        };
      }

      calculatedRubricScore = Object.values(cleanedRubricScores).reduce(
        (sum, item) => sum + Number(item.score || 0),
        0
      );

      if (finalOverrideEnabled && finalOverride !== "") {
        const overrideValue = Number(finalOverride);
        const isHalfStepOverride =
          Math.abs(
            overrideValue * 2 -
              Math.round(overrideValue * 2)
          ) < 1e-9;

        if (
          Number.isNaN(overrideValue) ||
          overrideValue < 0 ||
          overrideValue > rubricTotal
        ) {
          setSaveMessage(
            `Final score override must be between 0 and ${rubricTotal}.`
          );
          setReviewMode("grading");
          return;
        }

        if (!isHalfStepOverride) {
          setSaveMessage(
            "Final score override must use 0.5 increments."
          );
          setReviewMode("grading");
          return;
        }

        finalScore = overrideValue;
      } else {
        finalScore = calculatedRubricScore;
      }
    } else {
      if (manualScore === "") {
        setSaveMessage(
          "Enter a score before saving the final review."
        );
        return;
      }

      const numericScore = Number(manualScore);

      if (
        Number.isNaN(numericScore) ||
        numericScore < 0 ||
        numericScore > 100
      ) {
        setSaveMessage("Score must be between 0 and 100.");
        return;
      }

      finalScore = numericScore;
    }

    const annotationsToSave = Array.isArray(annotationsRef.current)
      ? annotationsRef.current
      : annotations;

    let saveAccepted;
    try {
      saveAccepted = await onSaveReview(submission.id, {
        status: "Graded",
        feedback,
        score: finalScore,
        annotations: annotationsToSave,

        rubricId: currentRubric?.id || null,
        rubricTitle: currentRubric?.title || null,
        rubricScores: currentRubric ? cleanedRubricScores : {},
        rubricTotal: currentRubric?.totalPoints || null,
        rubricCalculatedScore: currentRubric ? calculatedRubricScore : null,
        rubricOverride: currentRubric ? finalOverrideEnabled : false,

        aiTeacherReviewSuggestion: aiSuggestion || null,
        aiTeacherReviewGenerated: Boolean(aiSuggestion),
        aiTeacherReviewUsed:
          aiRubricApplied || aiFeedbackApplied,
        aiRubricSuggestionApplied:
          aiRubricApplied,
        aiFeedbackSuggestionApplied:
          aiFeedbackApplied,

        reviewedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Review save failed:", error);
      setSaveMessage(
        error?.message ||
          "The review could not be saved. Please refresh and try again."
      );
      return;
    }

    if (saveAccepted === false) {
      setSaveMessage(
        "This assignment is reopened. The student must resubmit it before a new instructor review can be saved."
      );
      return;
    }

    setSaveMessage("Review, grade, and annotations saved successfully.");
    setAnnotationMessage("");
  }

  return (
    <div className="h-full min-h-0 animate-fade-in-up">
      <div className="flex h-full min-h-0 flex-col gap-3">
        {readOnly && (
          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-600">
            Previous attempt  -  read-only. Grades, feedback, annotations, and AI review actions cannot be changed.
          </div>
        )}
        

        <ReviewModeSwitch
          reviewMode={reviewMode}
          setReviewMode={setReviewMode}
          planningMessageCount={planningChatMessages.length}
          studentAiFeedbackCount={studentAiFeedbackHistory.length}
          writingReplayCount={writingReplayEvents.length}
        />

        {reviewMode === "planning" ? (
            <PlanningAndAiFeedbackWorkspace
              planningMessages={planningChatMessages}
              aiFeedbackHistory={studentAiFeedbackHistory}
            />
          ) : reviewMode === "writing" ? (
            <WritingBehaviourWorkspace
              submission={submission}
              writingEvents={writingReplayEvents}
              copyPasteLogs={copyPasteLogs}
              focusLossLogs={focusLossLogs}
              integrityLogs={integrityLogs}
            />
          ) : (
            <div className="grid grid-cols-1 items-start gap-2 xl:grid-cols-[minmax(0,1.95fr)_minmax(290px,0.62fr)] 2xl:grid-cols-[minmax(0,2.05fr)_minmax(300px,0.58fr)]">
              <div className="min-w-0 space-y-2">
                <StudentTextReviewPanel
                  studentTextRef={studentTextRef}
                  captureSelectedText={captureSelectedText}
                  submission={submission}
                  wordCount={wordCount}
                  annotationMessage={annotationMessage}
                  submissionText={submissionText}
                  annotations={annotations}
                  deleteAnnotation={deleteAnnotation}
                />

                <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="h-4 w-4 shrink-0 text-blue-700" />
                      <div className="min-w-0">
                        <h2 className="truncate font-serif text-base font-bold text-slate-950">Rubric</h2>
                        <p className="mt-0.5 text-[11px] text-slate-500">Score each criterion in one horizontal row to reduce scrolling.</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#F8FAFC] p-2.5">
                    {currentRubric ? (
                      <RubricScorePanel
                        rubric={currentRubric}
                        rubricCriteria={rubricCriteria}
                        rubricScores={rubricScores}
                        rubricScoreTotal={rubricScoreTotal}
                        rubricTotal={rubricTotal}
                        gradedCriteriaCount={gradedCriteriaCount}
                        selectBand={selectBand}
                        adjustCriterionScore={adjustCriterionScore}
                        updateCriterionScore={updateCriterionScore}
                        updateCriterionComment={updateCriterionComment}
                        finalOverrideEnabled={finalOverrideEnabled}
                        setFinalOverrideEnabled={setFinalOverrideEnabled}
                        finalOverride={finalOverride}
                        setFinalOverride={setFinalOverride}
                        aiSuggestion={aiSuggestion}
                        applyAiRubricScores={applyAiRubricScores}
                      />
                    ) : (
                      <ManualScorePanel
                        manualScore={manualScore}
                        setManualScore={setManualScore}
                        aiSuggestion={aiSuggestion}
                        applyAiRubricScores={applyAiRubricScores}
                      />
                    )}
                  </div>
                </section>
              </div>

              <UnifiedFeedbackPanel
                aiReviewLoading={aiReviewLoading}
                aiReviewError={aiReviewError}
                aiSuggestion={aiSuggestion}
                onRunAiCheck={handleAiCheck}
                applyAiRubricScores={applyAiRubricScores}
                applyAiFeedback={applyAiFeedback}
                rubricTotal={rubricTotal}
                feedback={feedback}
                setFeedback={setFeedback}
                currentRubric={currentRubric}
                finalDisplayedScore={finalDisplayedScore}
                saveMessage={saveMessage}
              />
            </div>
          )}
      </div>

      {selectedText && selectionToolbar && reviewMode === "grading" && (
        <FloatingAnnotationToolbar
          position={selectionToolbar}
          selectedText={selectedText}
          annotationComment={annotationComment}
          setAnnotationComment={setAnnotationComment}
          addAnnotation={addAnnotation}
          onClose={clearSelectionState}
        />
      )}
    </div>
  );
});

function StudentTextReviewPanel({
  studentTextRef,
  captureSelectedText,
  submission,
  wordCount,
  annotationMessage,
  submissionText,
  annotations,
  deleteAnnotation,
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-blue-700" />
            <div>
              <h2 className="font-serif text-base font-bold text-slate-950">Student Text</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Select text to reveal annotation tools.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2 py-1 text-[9px] font-mono font-bold text-slate-600">
              <Calendar className="h-3 w-3 text-slate-400" />
              {formatSubmittedDateTime(submission.resubmittedAt || submission.submittedAt || submission.createdAt)}
            </span>
            <span className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-2 py-1 text-[9px] font-mono font-bold text-slate-600">
              {wordCount} words
            </span>
          </div>
        </div>
        {annotationMessage && <p className="mt-2 text-[10px] font-mono font-bold text-blue-700">{annotationMessage}</p>}
      </div>
      <div
        ref={studentTextRef}
        onMouseUp={captureSelectedText}
        className="bg-[#F8FAFC] px-5 py-5 text-[13px] font-mono leading-7 text-slate-700 whitespace-pre-wrap select-text cursor-text"
      >
        {renderAnnotatedText(submissionText, annotations, deleteAnnotation)}
      </div>
    </section>
  );
}

function UnifiedFeedbackPanel({
  aiReviewLoading,
  aiReviewError,
  aiSuggestion,
  onRunAiCheck,
  applyAiRubricScores,
  applyAiFeedback,
  rubricTotal,
  feedback,
  setFeedback,
  saveMessage,
}) {
  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm xl:max-w-[340px] xl:justify-self-end">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <BrainCircuit className="h-4 w-4 shrink-0 text-violet-700" />
            <div>
              <h2 className="font-serif text-base font-bold text-slate-950">AI &amp; Instructor Feedback</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Review AI guidance, then write the final comment.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRunAiCheck}
            disabled={aiReviewLoading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
          >
            {aiReviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {aiReviewLoading ? "Analyzing" : aiSuggestion ? "Run again" : "Run AI check"}
          </button>
        </div>
      </div>

      <div className="space-y-3 bg-[#F8FAFC] p-3">
        {aiReviewError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[11px] leading-5 text-red-800">
            <strong className="block">AI check could not run</strong>
            {aiReviewError}
          </div>
        )}

        {!aiSuggestion && !aiReviewLoading && !aiReviewError && (
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
            <div className="flex items-start gap-2">
              <Bot className="mt-0.5 h-4 w-4 shrink-0 text-violet-700" />
              <p className="text-[11px] leading-5 text-violet-900">AI can suggest rubric scores and feedback. Nothing is applied or saved automatically.</p>
            </div>
          </div>
        )}

        {aiReviewLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3 text-[11px] font-bold text-violet-800">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing the submission and rubric…
          </div>
        )}

        {aiSuggestion && (
          <div className="rounded-xl border border-violet-200 bg-white p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-violet-700">AI suggestion</p>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-700">{aiSuggestion.summary}</p>
              </div>
              <span className="shrink-0 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 font-mono text-xs font-black text-violet-900">
                {aiSuggestion.finalScore}/{rubricTotal || 100}
              </span>
            </div>
            {aiSuggestion.feedback && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-violet-50/60 p-2 text-[11px] leading-5 text-slate-700">{aiSuggestion.feedback}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={applyAiRubricScores} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-blue-700">Apply rubric scores</button>
              {aiSuggestion.feedback && <button type="button" onClick={applyAiFeedback} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-bold text-violet-800 hover:bg-violet-100">Use as feedback</button>}
            </div>
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <ReviewPanelHeader />
          <div className="mt-3">
            <FeedbackPanel feedback={feedback} setFeedback={setFeedback} />
          </div>
        </div>

        <ReviewActionBar saveMessage={saveMessage} />
      </div>
    </section>
  );
}

function EmptyEvidenceState({ title, description }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-[#F8FAFC] p-8 text-center">
      <Info className="w-7 h-7 text-slate-300 mx-auto" />
      <h3 className="font-serif text-base font-bold text-slate-900 mt-3">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{description}</p>
    </div>
  );
}

function PlanningAndAiFeedbackWorkspace({ planningMessages, aiFeedbackHistory }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-700 shrink-0" />
          <div>
            <h2 className="font-serif text-base font-bold text-slate-950">Planning Chat & Student AI Feedback</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Review the student’s planning conversation and the AI feedback available during drafting.</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 bg-[#F8FAFC] p-4">
        <div className="grid min-h-0 w-full flex-1 grid-cols-1 gap-4 2xl:grid-cols-2">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Planning chat</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Conversation used to plan and brainstorm the assignment.</p>
              </div>
              <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2 py-1 text-[10px] font-mono font-bold text-cyan-700">{planningMessages.length} messages</span>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {planningMessages.length === 0 ? (
                <EmptyEvidenceState title="No planning chat saved" description="No planning or brainstorming conversation was attached to this submission." />
              ) : (
                planningMessages.map((message, index) => {
                  const role = String(message.role || "student").toLowerCase();
                  const isStudent = ["student", "user", "learner"].includes(role);
                  return (
                    <div key={message.id || index} className={`flex ${isStudent ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[88%] rounded-2xl border px-3 py-2.5 ${isStudent ? "border-blue-200 bg-blue-50 text-blue-950" : "border-slate-200 bg-[#F8FAFC] text-slate-800"}`}>
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span className="text-[9px] font-mono font-black uppercase tracking-wider opacity-60">{isStudent ? "Student" : "AI coach"}</span>
                          {message.createdAt && <span className="text-[9px] font-mono opacity-50">{formatDateTime(message.createdAt)}</span>}
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Student AI draft checks</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Each saved AI response shown to the student while reviewing the draft.</p>
              </div>
              <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-1 text-[10px] font-mono font-bold text-violet-700">{aiFeedbackHistory.length} checks</span>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {aiFeedbackHistory.length === 0 ? (
                <EmptyEvidenceState title="No AI feedback history" description="The student did not request AI draft feedback, or no feedback history was saved." />
              ) : (
                aiFeedbackHistory.map((item, index) => (
                  <StudentAiFeedbackCard
                    key={item.id || index}
                    item={item}
                    index={index}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function getAiFeedbackIssueTone(severity = "medium") {
  const normalized = String(severity).toLowerCase();

  if (normalized === "major") {
    return {
      badge:
        "border-red-200 bg-red-50 text-red-700",
      panel:
        "border-red-100 bg-red-50/60",
    };
  }

  if (normalized === "minor") {
    return {
      badge:
        "border-amber-200 bg-amber-50 text-amber-700",
      panel:
        "border-amber-100 bg-amber-50/60",
    };
  }

  return {
    badge:
      "border-orange-200 bg-orange-50 text-orange-700",
    panel:
      "border-orange-100 bg-orange-50/60",
  };
}

function CompactAiFeedbackSection({
  title,
  count,
  icon: Icon,
  tone,
  open,
  onToggle,
  children,
}) {
  const toneClasses = {
    emerald: {
      icon: "border-emerald-200 bg-emerald-50 text-emerald-700",
      count: "bg-emerald-100 text-emerald-700",
    },
    orange: {
      icon: "border-orange-200 bg-orange-50 text-orange-700",
      count: "bg-orange-100 text-orange-700",
    },
    blue: {
      icon: "border-blue-200 bg-blue-50 text-blue-700",
      count: "bg-blue-100 text-blue-700",
    },
  };

  const classes =
    toneClasses[tone] || toneClasses.blue;

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg border ${classes.icon}`}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>

          <span className="text-[11px] font-bold text-slate-900">
            {title}
          </span>

          <span
            className={`rounded-full px-1.5 py-0.5 text-[8px] font-mono font-black ${classes.count}`}
          >
            {count}
          </span>
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="border-t border-slate-100 p-3">
          {children}
        </div>
      )}
    </section>
  );
}

function CompactAiIssue({
  issue,
  index,
  open,
  onToggle,
}) {
  const tone = getAiFeedbackIssueTone(
    issue.severity
  );

  const preview =
    issue.problem ||
    issue.suggestion ||
    issue.excerpt ||
    `Issue ${index + 1}`;

  return (
    <div
      className={`overflow-hidden rounded-lg border ${tone.panel}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-900">
              Issue {index + 1}
            </span>

            <span
              className={`rounded-full border px-1.5 py-0.5 text-[7px] font-mono font-black uppercase ${tone.badge}`}
            >
              {issue.severity || "medium"}
            </span>
          </div>

          <p className="mt-1 line-clamp-1 text-[10px] text-slate-600">
            {preview}
          </p>
        </div>

        <ChevronDown
          className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/80 px-3 py-2.5">
          {issue.excerpt && (
            <div className="rounded-lg bg-white/90 px-2.5 py-2">
              <p className="font-mono text-[7px] font-black uppercase text-slate-400">
                Draft excerpt
              </p>

              <p className="mt-1 line-clamp-3 text-[10px] font-semibold leading-4 text-slate-700">
                “{issue.excerpt}”
              </p>
            </div>
          )}

          {issue.problem && (
            <div>
              <p className="font-mono text-[7px] font-black uppercase text-orange-600">
                Problem
              </p>

              <p className="mt-1 text-[10px] leading-4 text-slate-700">
                {issue.problem}
              </p>
            </div>
          )}

          {issue.suggestion && (
            <div className="rounded-lg bg-white/80 px-2.5 py-2">
              <p className="font-mono text-[7px] font-black uppercase text-blue-600">
                AI suggestion
              </p>

              <p className="mt-1 text-[10px] leading-4 text-slate-700">
                {issue.suggestion}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StudentAiFeedbackCard({ item, index }) {
  const [expanded, setExpanded] =
    useState(false);

  const [openSection, setOpenSection] =
    useState("issues");

  const [openIssueIndex, setOpenIssueIndex] =
    useState(null);

  const overall = String(
    item.overall || ""
  ).trim();

  const strengths = safeArray(
    item.strengths
  );

  const issues = safeArray(item.issues);

  const nextSteps = safeArray(
    item.nextSteps
  );

  const rawText = String(
    item.rawText || ""
  ).trim();

  const hasStructuredDetails =
    strengths.length > 0 ||
    issues.length > 0 ||
    nextSteps.length > 0;

  const summaryText =
    overall ||
    rawText ||
    "The AI draft check was recorded, but no readable response was found.";

  const visibleSummary =
    summaryText.length > 330
      ? `${summaryText
          .slice(0, 330)
          .trim()}…`
      : summaryText;

  function toggleSection(section) {
    setOpenSection((current) =>
      current === section ? "" : section
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
      <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700">
              <Bot className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <p className="truncate font-mono text-[9px] font-black uppercase tracking-wider text-violet-700">
                AI draft check #{index + 1}
              </p>

              <p className="mt-0.5 truncate text-[9px] text-slate-500">
                Feedback shown to the student.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1">
            {item.draftWordCount !== null &&
              item.draftWordCount !==
                undefined && (
                <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[8px] font-mono font-bold text-slate-500">
                  {item.draftWordCount} words
                </span>
              )}

            {item.saved && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700">
                Saved
              </span>
            )}

            {item.createdAt && (
              <span className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[8px] font-mono text-slate-400">
                {formatDateTime(
                  item.createdAt
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3">
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-violet-700" />

            <p className="font-mono text-[8px] font-black uppercase tracking-wider text-violet-600">
              Overall AI feedback
            </p>
          </div>

          <p className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-[11px] leading-5 text-slate-700">
            {visibleSummary}
          </p>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[8px] font-bold text-emerald-700">
            <CheckSquare className="h-3 w-3" />
            {strengths.length} strengths
          </span>

          <span className="inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[8px] font-bold text-orange-700">
            <AlertTriangle className="h-3 w-3" />
            {issues.length} issues
          </span>

          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[8px] font-bold text-blue-700">
            <BookOpen className="h-3 w-3" />
            {nextSteps.length} next steps
          </span>

          <button
            type="button"
            onClick={() =>
              setExpanded(
                (value) => !value
              )
            }
            className="ml-auto inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-2.5 py-1.5 text-[9px] font-bold text-violet-700 transition-colors hover:bg-violet-50"
          >
            {expanded
              ? "Hide details"
              : "View details"}

            <ChevronDown
              className={`h-3 w-3 transition-transform ${
                expanded
                  ? "rotate-180"
                  : ""
              }`}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 border-t border-violet-100 bg-[#FBFAFF] p-3">
          {strengths.length > 0 && (
            <CompactAiFeedbackSection
              title="Strengths"
              count={strengths.length}
              icon={CheckSquare}
              tone="emerald"
              open={openSection === "strengths"}
              onToggle={() =>
                toggleSection("strengths")
              }
            >
              <div className="space-y-1.5">
                {strengths.map(
                  (strength, strengthIndex) => (
                    <div
                      key={`strength_${strengthIndex}`}
                      className="flex items-start gap-2 rounded-lg bg-emerald-50/70 px-2.5 py-2"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[7px] font-black text-white">
                        {strengthIndex + 1}
                      </span>

                      <p className="text-[10px] leading-4 text-slate-700">
                        {strength}
                      </p>
                    </div>
                  )
                )}
              </div>
            </CompactAiFeedbackSection>
          )}

          {issues.length > 0 && (
            <CompactAiFeedbackSection
              title="Areas to improve"
              count={issues.length}
              icon={AlertTriangle}
              tone="orange"
              open={openSection === "issues"}
              onToggle={() =>
                toggleSection("issues")
              }
            >
              <div className="space-y-1.5">
                {issues.map(
                  (issue, issueIndex) => (
                    <CompactAiIssue
                      key={
                        issue.id ||
                        `issue_${issueIndex}`
                      }
                      issue={issue}
                      index={issueIndex}
                      open={
                        openIssueIndex ===
                        issueIndex
                      }
                      onToggle={() =>
                        setOpenIssueIndex(
                          (current) =>
                            current === issueIndex
                              ? null
                              : issueIndex
                        )
                      }
                    />
                  )
                )}
              </div>
            </CompactAiFeedbackSection>
          )}

          {nextSteps.length > 0 && (
            <CompactAiFeedbackSection
              title="Next steps"
              count={nextSteps.length}
              icon={BookOpen}
              tone="blue"
              open={openSection === "nextSteps"}
              onToggle={() =>
                toggleSection("nextSteps")
              }
            >
              <div className="space-y-1.5">
                {nextSteps.map(
                  (step, stepIndex) => (
                    <div
                      key={`next_step_${stepIndex}`}
                      className="flex items-start gap-2 rounded-lg bg-blue-50/70 px-2.5 py-2"
                    >
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[7px] font-black text-white">
                        {stepIndex + 1}
                      </span>

                      <p className="text-[10px] leading-4 text-slate-700">
                        {step}
                      </p>
                    </div>
                  )
                )}
              </div>
            </CompactAiFeedbackSection>
          )}

          {!hasStructuredDetails &&
            rawText &&
            rawText !== overall && (
              <section className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="font-mono text-[8px] font-black uppercase tracking-wider text-slate-400">
                  Raw AI response
                </p>

                <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-4 text-slate-700">
                  {rawText}
                </p>
              </section>
            )}
        </div>
      )}
    </div>
  );
}

function formatDuration(totalSeconds = 0) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

const WP_LONG_PAUSE_MIN_MS = 2000;
const WP_THINKING_PAUSE_MAX_MS = 120000;
const WP_MIN_WORDS_FOR_STATUS = 80;
const WP_PASTE_FLAG_LIMIT = 220;

const WP_STATUS = {
  TYPICAL: "typical_process",
  REVIEW: "review_suggested",
  CLOSE: "close_review_needed",
  INSUFFICIENT: "not_enough_writing_data",
};

const WP_STATUS_LABELS = {
  [WP_STATUS.TYPICAL]: "Typical process",
  [WP_STATUS.REVIEW]: "Review suggested",
  [WP_STATUS.CLOSE]: "Close review needed",
  [WP_STATUS.INSUFFICIENT]: "Not enough writing data",
};

const WP_STATUS_REASONS = {
  [WP_STATUS.TYPICAL]:
    "The writing process is broadly consistent with normal drafting and revision.",
  [WP_STATUS.REVIEW]:
    "At least one process pattern differs from typical for this level - worth a closer look before grading.",
  [WP_STATUS.CLOSE]:
    "Multiple independent signals are unusual together. Look at the timeline, peer comparison, paste evidence, and playback before deciding.",
  [WP_STATUS.INSUFFICIENT]:
    "There is not enough typed writing here to interpret the process reliably.",
};

const WP_METRIC_DEFINITIONS = {
  typingRate: {
    label: "Typing rate",
    help: "Characters typed per active minute. Typing speed is affected by proficiency, keyboard skill, and device.",
  },
  longPauses: {
    label: "Long thinking pauses",
    help: "Pauses of 2 seconds to 2 minutes per 100 words. Longer gaps are treated as idle/away time.",
  },
  localRevisions: {
    label: "Local revisions",
    help: "Medium edits per 100 words, such as deleting or rewriting part of a sentence.",
  },
  productProcessRatio: {
    label: "Text survival",
    help: "Final characters divided by typed characters. Near 1.00 means most typed text survived unchanged.",
  },
};

const WP_PRELIMINARY_COHORTS = {
  A0: { n: 12, typingRate: [45, 115], longPauses: [18, 58], localRevisions: [2, 18], productProcessRatio: [0.62, 0.94], pasteShare: [0, 0.18] },
  A1: { n: 18, typingRate: [55, 125], longPauses: [15, 52], localRevisions: [3, 20], productProcessRatio: [0.60, 0.94], pasteShare: [0, 0.18] },
  A2: { n: 31, typingRate: [70, 145], longPauses: [10, 42], localRevisions: [4, 24], productProcessRatio: [0.58, 0.93], pasteShare: [0, 0.16] },
  B1: { n: 47, typingRate: [85, 170], longPauses: [6, 32], localRevisions: [6, 30], productProcessRatio: [0.55, 0.92], pasteShare: [0, 0.14] },
  B2: { n: 29, typingRate: [105, 205], longPauses: [4, 26], localRevisions: [8, 35], productProcessRatio: [0.52, 0.91], pasteShare: [0, 0.12] },
  C1: { n: 16, typingRate: [120, 235], longPauses: [3, 20], localRevisions: [10, 40], productProcessRatio: [0.50, 0.90], pasteShare: [0, 0.10] },
  C2: { n: 10, typingRate: [130, 255], longPauses: [2, 18], localRevisions: [12, 45], productProcessRatio: [0.48, 0.90], pasteShare: [0, 0.10] },
};

const WP_COHORT_DEVIATION_SIGNALS = {
  typingRate: {
    below: { code: "cohort_typing_slow", label: "Typing pace below peer range", detail: "Typed more slowly than similar-level students - can be careful human writing, but worth checking against the timeline and other signals." },
    above: { code: "cohort_typing_fast", label: "Typing pace above peer range", detail: "Typed faster than similar-level students - check the timeline and paste evidence." },
  },
  longPauses: {
    below: { code: "cohort_pauses_few", label: "Fewer thinking pauses than peers", detail: "Fewer longer pauses than similar-level students - some text may have been planned or composed before typing." },
    above: { code: "cohort_pauses_many", label: "More thinking pauses than peers", detail: "More thinking pauses than similar-level students - usually careful composing; worth checking the timeline pattern." },
  },
  localRevisions: {
    below: { code: "cohort_revision_low", label: "Less in-line revision than peers", detail: "Fewer local edits than similar-level students - writers typically rework text they are actively composing." },
    above: { code: "cohort_revision_high", label: "More in-line revision than peers", detail: "More local edits than similar-level students - suggests active, effortful composition." },
  },
  productProcessRatio: {
    below: { code: "cohort_survival_low", label: "More text deleted than peers", detail: "More of the typed text was deleted than in similar-level students - suggests heavy rewriting." },
    above: { code: "cohort_survival_high", label: "More typed text survived than peers", detail: "Less typed text was deleted than in similar-level students - most of what was typed made it to the final." },
  },
};

function wpRound(value, places = 1) {
  if (!Number.isFinite(Number(value))) return 0;
  const factor = 10 ** places;
  return Math.round(Number(value) * factor) / factor;
}

function wpNormalizeLevel(level = "B1") {
  const normalized = String(level || "B1").trim().toUpperCase();
  return WP_PRELIMINARY_COHORTS[normalized] ? normalized : "B1";
}

function wpGetCohort(level = "B1") {
  const normalized = wpNormalizeLevel(level);
  return {
    level: normalized,
    preliminary: true,
    ...WP_PRELIMINARY_COHORTS[normalized],
  };
}

function wpCompareToRange(value, range = []) {
  const [low, high] = range;
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "unknown";
  if (Number(value) < low) return "below";
  if (Number(value) > high) return "above";
  return "within";
}

function wpGetEventGaps(events = []) {
  const times = safeArray(events)
    .map(getEventTimeMs)
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);

  const gaps = [];
  for (let index = 1; index < times.length; index += 1) {
    gaps.push(times[index] - times[index - 1]);
  }
  return gaps;
}

function wpCalculateActiveDurationMs(events = [], submission = {}) {
  const gaps = wpGetEventGaps(events).filter((gap) => Number.isFinite(gap) && gap > 0);
  if (gaps.length) {
    return gaps.reduce((sum, gap) => sum + Math.min(gap, WP_THINKING_PAUSE_MAX_MS), 0);
  }

  const start = Date.parse(submission?.startedAt || submission?.started_at || submission?.updatedAt || submission?.updated_at || "");
  const end = Date.parse(submission?.submittedAt || submission?.submitted_at || submission?.updatedAt || submission?.updated_at || "");
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return Math.min(end - start, WP_THINKING_PAUSE_MAX_MS);
  }
  return 0;
}

function wpGroupDeletionEvents(events = []) {
  const groups = [];
  let current = null;

  for (const event of events) {
    const type = String(event?.type || "").toLowerCase();
    if (type !== "delete" && type !== "replace") continue;

    const eventTime = getEventTimeMs(event) || 0;
    const gap = current ? eventTime - current.lastTime : Infinity;
    const sameArea = current && Math.abs(Number(event?.start || 0) - Number(current.lastStart || 0)) <= 3;

    if (current && gap < 700 && sameArea) {
      current.totalChars += String(event?.removedText || "").length || Math.abs(Number(event?.delta || 0));
      current.lastTime = eventTime;
      current.lastStart = event?.start;
    } else {
      if (current) groups.push(current);
      current = {
        firstTime: eventTime,
        lastTime: eventTime,
        lastStart: event?.start,
        totalChars: String(event?.removedText || "").length || Math.abs(Number(event?.delta || 0)),
      };
    }
  }

  if (current) groups.push(current);
  return groups;
}

function wpCalculateRevisionMetrics(events = [], finalWords = 0) {
  const deletionGroups = wpGroupDeletionEvents(events);
  const words = Math.max(1, finalWords);
  const localRevisions = deletionGroups.filter((group) => group.totalChars >= 4 && group.totalChars <= 50).length;

  return {
    localRevisions,
    localRevisionsPer100w: wpRound((localRevisions / words) * 100),
  };
}

function wpCalculatePauseMetrics(events = [], finalWords = 0) {
  const gaps = wpGetEventGaps(events);
  const longPauses = gaps.filter((gap) => gap >= WP_LONG_PAUSE_MIN_MS && gap <= WP_THINKING_PAUSE_MAX_MS);
  const idleGaps = gaps.filter((gap) => gap > WP_THINKING_PAUSE_MAX_MS);
  const words = Math.max(1, finalWords);

  return {
    longPauseCount: longPauses.length,
    longPausesPer100w: wpRound((longPauses.length / words) * 100),
    ignoredIdlePauseCount: idleGaps.length,
  };
}

function wpNormalizeMatchText(text = "") {
  return String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function wpGetOutlineText(submission = {}) {
  const outline = submission?.outline || {};
  return [
    outline.partOne,
    outline.partTwo,
    outline.partThree,
    outline.topicSentence,
    outline.concludingSentence,
    outline.chatOutlineText,
  ]
    .filter(Boolean)
    .join(" ");
}

function wpIsOwnOutlinePaste(event = {}, submission = {}) {
  const inserted = wpNormalizeMatchText(event?.insertedText || "");
  const outline = wpNormalizeMatchText(wpGetOutlineText(submission));
  if (inserted.length < 20 || outline.length < 20) return false;
  return outline.includes(inserted) || inserted.includes(outline);
}

function wpBuildEvidence(metrics = {}, externalPasteEvents = []) {
  const evidence = [];
  const largestPasteChars = Math.max(0, ...externalPasteEvents.map((event) => String(event?.insertedText || "").length));

  if (largestPasteChars >= WP_PASTE_FLAG_LIMIT || metrics.pasteShare >= 0.3) {
    evidence.push({
      code: "large_paste_or_bulk_insert",
      label: "Large paste or bulk entry",
      severity: metrics.pasteShare >= 0.6 ? 2 : 1,
      detail: `${largestPasteChars} characters inserted in the largest paste-like event.`,
    });
  }

  if (metrics.productProcessRatio >= 0.92 && metrics.localRevisionsPer100w < 1 && metrics.finalWords >= 120) {
    evidence.push({
      code: "linear_low_revision",
      label: "Very little revision",
      severity: 1,
      detail: "Most typed text appears to survive into the final version with few local revisions.",
    });
  }

  if (metrics.longPausesPer100w < 1 && metrics.finalWords >= 150) {
    evidence.push({
      code: "few_long_pauses",
      label: "Few long pauses",
      severity: 1,
      detail: "There are very few longer thinking pauses for the length of the final text.",
    });
  }

  return evidence;
}

function wpBuildCohortEvidence(positions = {}, cohort = {}) {
  if (!cohort?.n) return [];

  const evidence = [];
  const keys = ["typingRate", "longPauses", "localRevisions", "productProcessRatio"];

  for (const key of keys) {
    const signal = WP_COHORT_DEVIATION_SIGNALS[key]?.[positions[key]];
    if (signal) evidence.push({ ...signal, severity: 0.5 });
  }

  return evidence;
}

function wpChooseStatus(finalWords, evidence = []) {
  if (finalWords < WP_MIN_WORDS_FOR_STATUS) return WP_STATUS.INSUFFICIENT;
  const severity = evidence.reduce((sum, item) => sum + Number(item?.severity || 1), 0);
  if (severity >= 3 || evidence.length >= 3) return WP_STATUS.CLOSE;
  if (severity >= 1) return WP_STATUS.REVIEW;
  return WP_STATUS.TYPICAL;
}

function wpBuildUnknownPositions() {
  return {
    typingRate: "unknown",
    longPauses: "unknown",
    localRevisions: "unknown",
    productProcessRatio: "unknown",
    pasteShare: "unknown",
  };
}

function wpCalculateTimeline(events = [], submission = {}, bucketCount = 12) {
  const times = events.map(getEventTimeMs).filter((time) => Number.isFinite(time));
  const fallbackStart = Date.parse(submission?.startedAt || submission?.started_at || submission?.updatedAt || submission?.updated_at || "");
  const fallbackEnd = Date.parse(submission?.submittedAt || submission?.submitted_at || submission?.updatedAt || submission?.updated_at || "");
  const start = times[0] ?? (Number.isFinite(fallbackStart) ? fallbackStart : Date.now());
  const end = times.at(-1) ?? (Number.isFinite(fallbackEnd) ? fallbackEnd : start);
  const duration = Math.max(1, end - start);
  const count = Math.max(1, bucketCount);

  const buckets = Array.from({ length: count }, (_, index) => ({
    index,
    startMs: start + (duration * index) / count,
    endMs: start + (duration * (index + 1)) / count,
    typedChars: 0,
    pasteChars: 0,
    phase: "",
  }));

  events.forEach((event) => {
    const time = getEventTimeMs(event);
    const index = Number.isFinite(time)
      ? Math.min(count - 1, Math.max(0, Math.floor(((time - start) / duration) * count)))
      : 0;

    const bucket = buckets[index];
    const insertedLength = String(event?.insertedText || "").length;
    bucket.typedChars += insertedLength;
    bucket.phase = bucket.phase || event?.phase || "draft";
    if (isPasteLikeWritingEvent(event)) bucket.pasteChars += insertedLength;
  });

  const maxTyped = Math.max(1, ...buckets.map((bucket) => bucket.typedChars));
  return buckets.map((bucket) => ({
    ...bucket,
    intensity: wpRound(bucket.typedChars / maxTyped, 2),
    label: `${Math.round((bucket.startMs - start) / 60000)}-${Math.round((bucket.endMs - start) / 60000)} min`,
  }));
}

function wpGetCoachBaseline(allWritingEvents = []) {
  const outlineEvents = safeArray(allWritingEvents)
    .filter((event) => String(event?.phase || "") === "coach_outline")
    .sort((a, b) => (getEventTimeMs(a) || 0) - (getEventTimeMs(b) || 0));

  if (!outlineEvents.length) {
    return { available: false, typingRate: null, localRevisionsPer100w: null };
  }

  const activeMinutes = Math.max(0.25, wpCalculateActiveDurationMs(outlineEvents) / 60000);
  const insertedChars = outlineEvents.reduce((sum, event) => sum + String(event?.insertedText || "").length, 0);
  const words = countWords(outlineEvents.map((event) => event?.insertedText || "").join(" "));
  const revisions = wpCalculateRevisionMetrics(outlineEvents, words);

  return {
    available: insertedChars >= 80 || words >= 15,
    typingRate: Math.round(insertedChars / activeMinutes),
    localRevisionsPer100w: revisions.localRevisionsPer100w,
  };
}

function wpAnalyzeWritingProcess({
  submission,
  assignmentLevel,
  finalText,
  replayEvents,
  allWritingEvents,
}) {
  const finalWords = countWords(finalText);
  const finalChars = String(finalText || "").length;
  const insertedChars = replayEvents.reduce((sum, event) => sum + String(event?.insertedText || "").length, 0);
  const removedChars = replayEvents.reduce((sum, event) => sum + String(event?.removedText || "").length, 0);
  const pasteEvents = replayEvents
    .filter(isPasteLikeWritingEvent)
    .map((event) => ({
      ...event,
      source: wpIsOwnOutlinePaste(event, submission) ? "own_outline" : "external_or_unknown",
    }));

  const externalPasteEvents = pasteEvents.filter((event) => event.source !== "own_outline");
  const pasteChars = externalPasteEvents.reduce((sum, event) => sum + String(event?.insertedText || "").length, 0);
  const activeMinutes = Math.max(0.25, wpCalculateActiveDurationMs(replayEvents, submission) / 60000);
  const typingRate = Math.round(insertedChars / activeMinutes);
  const productProcessRatio = insertedChars ? wpRound(finalChars / insertedChars, 2) : 0;
  const pasteShare = finalChars ? wpRound(Math.min(1, pasteChars / finalChars), 2) : 0;
  const revisionMetrics = wpCalculateRevisionMetrics(replayEvents, finalWords);
  const pauseMetrics = wpCalculatePauseMetrics(replayEvents, finalWords);

  const metrics = {
    finalWords,
    finalChars,
    insertedChars,
    removedChars,
    typingRate,
    activeMinutes: wpRound(activeMinutes),
    productProcessRatio,
    pasteShare,
    pasteEventCount: pasteEvents.length,
    localRevisions: revisionMetrics.localRevisions,
    localRevisionsPer100w: revisionMetrics.localRevisionsPer100w,
    longPausesPer100w: pauseMetrics.longPausesPer100w,
    ignoredIdlePauseCount: pauseMetrics.ignoredIdlePauseCount,
  };

  const cohort = wpGetCohort(assignmentLevel);
  const positions = {
    typingRate: wpCompareToRange(metrics.typingRate, cohort.typingRate),
    longPauses: wpCompareToRange(metrics.longPausesPer100w, cohort.longPauses),
    localRevisions: wpCompareToRange(metrics.localRevisionsPer100w, cohort.localRevisions),
    productProcessRatio: wpCompareToRange(metrics.productProcessRatio, cohort.productProcessRatio),
    pasteShare: wpCompareToRange(metrics.pasteShare, cohort.pasteShare),
  };

  const rawEvidence = [...wpBuildEvidence(metrics, externalPasteEvents), ...wpBuildCohortEvidence(positions, cohort)];
  const status = wpChooseStatus(finalWords, rawEvidence);
  const evidence = status === WP_STATUS.INSUFFICIENT ? [] : rawEvidence;
  const cohortPositions = status === WP_STATUS.INSUFFICIENT ? wpBuildUnknownPositions() : positions;

  return {
    status,
    statusLabel: WP_STATUS_LABELS[status],
    reason: WP_STATUS_REASONS[status],
    evidence,
    metrics,
    timeline: wpCalculateTimeline(replayEvents, submission),
    coachBaseline: wpGetCoachBaseline(allWritingEvents),
    cohortComparison: {
      level: cohort.level,
      n: cohort.n,
      ranges: {
        typingRate: cohort.typingRate,
        longPauses: cohort.longPauses,
        localRevisions: cohort.localRevisions,
        productProcessRatio: cohort.productProcessRatio,
        pasteShare: cohort.pasteShare,
      },
      positions: cohortPositions,
    },
  };
}

function wpStatusPillClasses(status) {
  if (status === WP_STATUS.CLOSE) return "border-rose-300 bg-rose-50 text-rose-700";
  if (status === WP_STATUS.REVIEW) return "border-amber-300 bg-amber-50 text-amber-800";
  if (status === WP_STATUS.INSUFFICIENT) return "border-slate-300 bg-slate-50 text-slate-600";
  return "border-emerald-300 bg-emerald-50 text-emerald-700";
}

function wpMetricTag(position) {
  if (position === "within") return "like peers";
  if (position === "below") return "below peers";
  if (position === "above") return "above peers";
  return "no peer data";
}

function wpMetricTagClasses(position) {
  if (position === "within") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (position === "below" || position === "above") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-slate-200 bg-slate-50 text-slate-500";
}

function wpFormatMetricValue(key, value) {
  if (value === null || value === undefined || value === "unknown") return "-";
  if (key === "productProcessRatio" || key === "pasteShare") return `${Math.round(Number(value) * 100)}%`;
  if (key === "typingRate") return `${value} chars/min`;
  if (key === "longPauses") return `${value}/100w`;
  if (key === "localRevisions") return `${value}/100w`;
  return String(value);
}

function getEventSnapshot(event, fallback = "") {
  return (
    event?.snapshot ||
    event?.draftText ||
    event?.text ||
    event?.content ||
    event?.details?.draftSnapshot ||
    fallback ||
    ""
  );
}

function getEventLabel(event) {
  const safeEvent = event || {};

  const type = String(
    safeEvent.type || safeEvent.action || "event"
  ).toLowerCase();

  if (type.includes("paste")) return "Paste event";
  if (type.includes("focus")) return "Focus changed";
  if (type.includes("delete")) return "Text deleted";
  if (type.includes("replace")) return "Text revised";
  if (type.includes("insert")) return "Text added";
  if (type.includes("save")) return "Draft saved";
  if (type.includes("submit")) return "Submitted";

  return safeEvent.type || safeEvent.action || "Writing event";
}


function isPasteReplayEvent(event) {
  const type = String(
    event?.type || event?.action || event?.eventGroup || ""
  ).toLowerCase();

  return type.includes("paste");
}

const PLAYBACK_INTRA_EVENT_DELAY_MS = 60;
const PLAYBACK_MAX_FRAME_DELAY_MS = 1200;
const LARGE_PASTE_LIMIT = 80;

function clampNumber(value, minimum, maximum) {
  return Math.min(
    maximum,
    Math.max(minimum, Number(value || 0))
  );
}

function getEventTimeMs(event) {
  const parsed = Date.parse(
    event?.timestamp || event?.createdAt || ""
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function getStableEventKey(event, index = 0) {
  return String(
    event?.id ||
      [
        event?.timestamp || event?.createdAt || "no-time",
        event?.type || event?.action || "event",
        event?.start ?? "",
        event?.end ?? "",
        String(event?.insertedText || "").length,
        String(event?.removedText || "").length,
        index,
      ].join(":")
  );
}

function getEventSemanticSignature(event) {
  return [
    event?.timestamp || event?.createdAt || "",
    event?.type || event?.action || "",
    event?.start ?? event?.position ?? "",
    event?.end ?? "",
    event?.insertedText || "",
    event?.removedText || "",
  ].join("|");
}

function dedupeReplayEvents(events = []) {
  const seenIds = new Set();
  const seenSignatures = new Set();

  return safeArray(events).filter((event, index) => {
    if (!event) return false;

    const id = event.id ? String(event.id) : "";
    const signature = getEventSemanticSignature(event);

    if (id && seenIds.has(id)) return false;
    if (signature && seenSignatures.has(signature)) return false;

    if (id) seenIds.add(id);
    if (signature) seenSignatures.add(signature);

    event.__replayKey = getStableEventKey(event, index);
    return true;
  });
}

function isLargeSingleInsertEvent(event) {
  return (
    String(event?.type || "").toLowerCase() === "insert" &&
    String(event?.insertedText || "").length >=
      LARGE_PASTE_LIMIT &&
    !String(event?.removedText || "")
  );
}

function isPasteLikeWritingEvent(event) {
  const type = String(
    event?.type ||
      event?.action ||
      event?.eventGroup ||
      ""
  ).toLowerCase();

  return Boolean(
    type.includes("paste") ||
      event?.flagged ||
      isLargeSingleInsertEvent(event)
  );
}

function hasStructuredPlaybackOperation(event) {
  const start = Number(
    event?.start ?? event?.position
  );

  return (
    Number.isFinite(start) &&
    (
      String(event?.insertedText || "").length > 0 ||
      String(event?.removedText || "").length > 0
    )
  );
}

function countPlaybackOperations(event) {
  if (!event) return 1;

  if (
    isPasteLikeWritingEvent(event) ||
    String(event.type || "").toLowerCase() === "delete"
  ) {
    return 1;
  }

  if (
    String(event.type || "").toLowerCase() === "replace"
  ) {
    return Math.max(
      1,
      1 + String(event.insertedText || "").length
    );
  }

  return Math.max(
    1,
    String(event.removedText || "").length +
      String(event.insertedText || "").length
  );
}

function getIntraEventDelayMs(
  event,
  nextEventTimeMs,
  eventTimeMs
) {
  const operationCount = countPlaybackOperations(event);

  if (operationCount <= 1) return 0;

  if (
    Number.isFinite(nextEventTimeMs) &&
    Number.isFinite(eventTimeMs) &&
    nextEventTimeMs > eventTimeMs
  ) {
    return Math.max(
      0,
      Math.min(
        PLAYBACK_INTRA_EVENT_DELAY_MS,
        (nextEventTimeMs - eventTimeMs) /
          operationCount
      )
    );
  }

  return PLAYBACK_INTRA_EVENT_DELAY_MS;
}

function createPlaybackFramePusher(
  frames,
  firstEventTime
) {
  return ({
    text,
    label,
    timeMs,
    caret,
    event,
    pasteRange = null,
  }) => {
    frames.push({
      id: `frame_${frames.length}_${event?.__replayKey || "start"}`,
      text: String(text || ""),
      label: label || "Writing event",
      timeMs: Number.isFinite(timeMs)
        ? timeMs
        : frames.at(-1)?.timeMs || firstEventTime,
      caret: Number.isFinite(caret)
        ? caret
        : String(text || "").length,
      sourceEventId:
        event?.id || event?.__replayKey || null,
      sourceEventKey:
        event?.__replayKey || null,
      eventType:
        event?.type || event?.action || "event",
      eventGroup:
        event?.eventGroup || "Writing",
      pasteRange,
    });
  };
}

function applyPlaybackDeletion({
  event,
  text,
  eventTimeMs,
  operationIndex,
  intraEventDelayMs,
  pushFrame,
}) {
  const start = clampNumber(
    event.start ?? event.position,
    0,
    text.length
  );

  const recordedEnd = Number(event.end);
  const fallbackEnd =
    start + String(event.removedText || "").length;

  const end = clampNumber(
    Number.isFinite(recordedEnd) &&
      recordedEnd > start
      ? recordedEnd
      : fallbackEnd,
    start,
    text.length
  );

  const nextText =
    text.slice(0, start) + text.slice(end);

  pushFrame({
    text: nextText,
    label: `Deleted ${String(
      event.removedText || ""
    ).length} characters`,
    timeMs:
      eventTimeMs +
      operationIndex * intraEventDelayMs,
    caret: start,
    event,
  });

  return nextText;
}

function applyPlaybackBulkInsert({
  event,
  text,
  eventTimeMs,
  operationIndex,
  intraEventDelayMs,
  pushFrame,
}) {
  const insertedText = String(
    event.insertedText || ""
  );

  const start = clampNumber(
    event.start ?? event.position,
    0,
    text.length
  );

  const nextText =
    text.slice(0, start) +
    insertedText +
    text.slice(start);

  pushFrame({
    text: nextText,
    label: `Pasted ${insertedText.length} characters`,
    timeMs:
      eventTimeMs +
      operationIndex * intraEventDelayMs,
    caret: start + insertedText.length,
    event,
    pasteRange: {
      start,
      end: start + insertedText.length,
    },
  });

  return nextText;
}

function applyPlaybackCharacterInsertions({
  event,
  text,
  eventTimeMs,
  operationIndex,
  intraEventDelayMs,
  pushFrame,
}) {
  const insertedText = String(
    event.insertedText || ""
  );

  const start = clampNumber(
    event.start ?? event.position,
    0,
    text.length
  );

  let nextText = text;

  for (
    let index = 0;
    index < insertedText.length;
    index += 1
  ) {
    const character = insertedText[index];

    const insertIndex = clampNumber(
      start + index,
      0,
      nextText.length
    );

    nextText =
      nextText.slice(0, insertIndex) +
      character +
      nextText.slice(insertIndex);

    pushFrame({
      text: nextText,
      label: getEventLabel(event),
      timeMs:
        eventTimeMs +
        (operationIndex + index) *
          intraEventDelayMs,
      caret: insertIndex + 1,
      event,
    });
  }

  return nextText;
}

function applyPlaybackEvent({
  event,
  eventTimeMs,
  intraEventDelayMs,
  text,
  pushFrame,
}) {
  if (!event) return text;

  if (!hasStructuredPlaybackOperation(event)) {
    const snapshot = getEventSnapshot(event, "");

    if (snapshot && snapshot !== text) {
      pushFrame({
        text: snapshot,
        label: getEventLabel(event),
        timeMs: eventTimeMs,
        caret: snapshot.length,
        event,
      });

      return snapshot;
    }

    return text;
  }

  let nextText = text;
  let operationIndex = 0;

  if (String(event.removedText || "")) {
    nextText = applyPlaybackDeletion({
      event,
      text: nextText,
      eventTimeMs,
      operationIndex,
      intraEventDelayMs,
      pushFrame,
    });

    operationIndex += 1;
  }

  if (!String(event.insertedText || "")) {
    return nextText;
  }

  if (isPasteLikeWritingEvent(event)) {
    return applyPlaybackBulkInsert({
      event,
      text: nextText,
      eventTimeMs,
      operationIndex,
      intraEventDelayMs,
      pushFrame,
    });
  }

  return applyPlaybackCharacterInsertions({
    event,
    text: nextText,
    eventTimeMs,
    operationIndex,
    intraEventDelayMs,
    pushFrame,
  });
}

function finalizePlaybackFrameDelays(frames) {
  const startTime = Number(frames[0]?.timeMs) || 0;

  return frames.map((frame, index) => {
    const currentTime = Number(frame.timeMs);
    const nextTime = Number(frames[index + 1]?.timeMs);

    return {
      ...frame,
      elapsedMs: Number.isFinite(currentTime)
        ? Math.max(0, currentTime - startTime)
        : 0,
      delayMs:
        Number.isFinite(currentTime) &&
        Number.isFinite(nextTime)
          ? Math.max(0, nextTime - currentTime)
          : 0,
    };
  });
}

function buildPlaybackFrames(
  writingEvents,
  finalText = ""
) {
  const events = dedupeReplayEvents(
    safeArray(writingEvents)
      .filter(
        (event) =>
          event?.phase !== "coach_outline"
      )
      .sort(
        (a, b) =>
          (getEventTimeMs(a) || 0) -
          (getEventTimeMs(b) || 0)
      )
  );

  const firstEventTime =
    events
      .map(getEventTimeMs)
      .find((time) => Number.isFinite(time)) ||
    Date.now();

  let text = "";

  const frames = [
    {
      id: "frame_start",
      text: "",
      label: "Start",
      timeMs: firstEventTime,
      caret: 0,
      sourceEventId: null,
      sourceEventKey: null,
      eventType: "start",
      eventGroup: "Writing",
      pasteRange: null,
    },
  ];

  const pushFrame =
    createPlaybackFramePusher(
      frames,
      firstEventTime
    );

  events.forEach((event, eventIndex) => {
    const eventTimeMs =
      getEventTimeMs(event) ??
      frames.at(-1)?.timeMs ??
      firstEventTime;

    const nextEventTimeMs = events
      .slice(eventIndex + 1)
      .map(getEventTimeMs)
      .find((time) => Number.isFinite(time));

    const intraEventDelayMs =
      getIntraEventDelayMs(
        event,
        nextEventTimeMs,
        eventTimeMs
      );

    text = applyPlaybackEvent({
      event,
      eventTimeMs,
      intraEventDelayMs,
      text,
      pushFrame,
    });

    /*
     * Every editor event also carries the complete draft after that edit.
     * Treat it as the authoritative checkpoint so a delayed, duplicated, or
     * partially persisted operation can never make later replay frames lose
     * text that the student had already written.
     */
    const recordedSnapshot = String(getEventSnapshot(event, "") || "");
    if (recordedSnapshot && recordedSnapshot !== text) {
      text = recordedSnapshot;
      pushFrame({
        text,
        label: getEventLabel(event),
        timeMs:
          eventTimeMs +
          Math.max(1, countPlaybackOperations(event)) *
            intraEventDelayMs,
        caret: text.length,
        event,
      });
    }
  });

  if (finalText && finalText !== text) {
    pushFrame({
      text: finalText,
      label: "Current final version",
      timeMs:
        frames.at(-1)?.timeMs || firstEventTime,
      caret: finalText.length,
      event: {
        id: "final_version",
        __replayKey: "final_version",
        type: "final",
        eventGroup: "Submission",
      },
    });
  }

  return {
    events,
    frames: finalizePlaybackFrameDelays(
      frames
    ),
  };
}

function formatPlaybackDuration(milliseconds) {
  const totalSeconds = Math.max(
    0,
    Math.round(
      Number(milliseconds || 0) / 1000
    )
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function PlaybackFrameText({ frame }) {
  const text = String(frame?.text || "");
  const caret = Number(frame?.caret);
  const pasteRange = frame?.pasteRange;

  const hasPasteRange =
    pasteRange &&
    Number.isFinite(pasteRange.start) &&
    Number.isFinite(pasteRange.end);

  const beforePaste = hasPasteRange
    ? text.slice(0, pasteRange.start)
    : text;

  const pastedText = hasPasteRange
    ? text.slice(
        pasteRange.start,
        pasteRange.end
      )
    : "";

  const afterPaste = hasPasteRange
    ? text.slice(pasteRange.end)
    : "";

  function renderWithCaret(
    value,
    offset = 0
  ) {
    const localCaret =
      Number.isFinite(caret)
        ? caret - offset
        : -1;

    if (
      localCaret < 0 ||
      localCaret > value.length
    ) {
      return value;
    }

    return (
      <>
        {value.slice(0, localCaret)}
        <span
          aria-hidden="true"
          className="mx-[1px] inline-block h-[1.2em] w-[2px] animate-pulse bg-amber-600 align-middle"
        />
        {value.slice(localCaret)}
      </>
    );
  }

  if (!hasPasteRange) {
    return <>{renderWithCaret(text)}</>;
  }

  return (
    <>
      {renderWithCaret(beforePaste, 0)}

      <mark className="rounded bg-violet-200 px-0.5 text-violet-950 ring-2 ring-violet-300/70">
        {renderWithCaret(
          pastedText,
          pasteRange.start
        )}
      </mark>

      {renderWithCaret(
        afterPaste,
        pasteRange.end
      )}
    </>
  );
}

function WritingBehaviourWorkspace({
  submission,
  writingEvents,
  copyPasteLogs,
  focusLossLogs,
  integrityLogs,
}) {
  const finalText = getSubmissionText(submission);
  const finalWordCount = countWords(finalText);

  const playbackData = useMemo(
    () =>
      buildPlaybackFrames(
        writingEvents,
        finalText
      ),
    [writingEvents, finalText]
  );

  const replayEvents = playbackData.events;
  const replayTimeline = useMemo(
    () => buildReplayTimeline(replayEvents),
    [replayEvents]
  );
  const frames = playbackData.frames;

  const [frameIndex, setFrameIndex] =
    useState(0);

  const [isPlaying, setIsPlaying] =
    useState(false);

  const [playbackSpeed, setPlaybackSpeed] =
    useState(5);

  const [processCheckOpen, setProcessCheckOpen] =
    useState(false);

  const [processHelpOpen, setProcessHelpOpen] =
    useState(false);

  const processHelpRef = useRef(null);

  const [timelineOpen, setTimelineOpen] =
    useState(true);
  const [replayFallbackStartMs] = useState(() => Date.now());

  useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(false);
    setProcessHelpOpen(false);
  }, [submission?.id, frames.length]);

  useEffect(() => {
    if (!processHelpOpen) return undefined;

    function closeProcessHelp(event) {
      if (!processHelpRef.current?.contains(event.target)) {
        setProcessHelpOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeProcessHelp);
    return () => document.removeEventListener("pointerdown", closeProcessHelp);
  }, [processHelpOpen]);

  useEffect(() => {
    if (
      !isPlaying ||
      frames.length <= 1
    ) {
      return undefined;
    }

    if (frameIndex >= frames.length - 1) {
      setIsPlaying(false);
      return undefined;
    }

    const rawDelay = Math.max(
      0,
      Number(
        frames[frameIndex]?.delayMs || 0
      )
    );

    const delay = Math.max(
      15,
      Math.min(
        rawDelay,
        PLAYBACK_MAX_FRAME_DELAY_MS
      ) / Math.max(1, playbackSpeed)
    );

    const timer = window.setTimeout(() => {
      setFrameIndex((current) => {
        if (current >= frames.length - 1) {
          setIsPlaying(false);
          return current;
        }

        return current + 1;
      });
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    isPlaying,
    frameIndex,
    playbackSpeed,
    frames,
  ]);

  const activeFrame =
    frames[frameIndex] || frames[0];

  const activeEvent =
    replayEvents.find(
      (event) =>
        String(
          event.id ||
            event.__replayKey
        ) ===
        String(
          activeFrame?.sourceEventId ||
            activeFrame?.sourceEventKey
        )
    ) || null;

  const firstTimestamp =
    replayEvents[0]?.timestamp ||
    replayEvents[0]?.createdAt;

  const lastTimestamp =
    replayEvents.at(-1)?.timestamp ||
    replayEvents.at(-1)?.createdAt;

  const calculatedDurationSeconds =
    firstTimestamp && lastTimestamp
      ? Math.max(
          0,
          Math.floor(
            (new Date(lastTimestamp).getTime() -
              new Date(firstTimestamp).getTime()) /
              1000
          )
        )
      : 0;

  const activeWritingSeconds = Number(
    submission?.writingSessionDurationSeconds ||
      submission?.activeWritingSeconds ||
      calculatedDurationSeconds ||
      0
  );

  const editEvents = replayEvents.filter(
    (event) => {
      const type = String(
        event.type || event.action || ""
      ).toLowerCase();

      return (
        type.includes("insert") ||
        type.includes("delete") ||
        type.includes("replace") ||
        type.includes("edit") ||
        type.includes("paste")
      );
    }
  );

  const deletionCount = editEvents.reduce(
    (sum, event) =>
      sum +
      Number(
        event.deletedChars ||
          String(
            event.removedText || ""
          ).length
      ),
    0
  );

  const insertionCount = editEvents.reduce(
    (sum, event) =>
      sum +
      Number(
        event.addedChars ||
          String(
            event.insertedText || ""
          ).length
      ),
    0
  );

  const revisionCount = editEvents.filter(
    (event) =>
      String(event.removedText || "") ||
      String(event.type || "")
        .toLowerCase()
        .includes("replace")
  ).length;

  const pasteEvents = dedupeReplayEvents([
    ...safeArray(copyPasteLogs),
    ...replayEvents.filter(
      isPasteLikeWritingEvent
    ),
  ]);

  const focusEvents = dedupeReplayEvents(
    safeArray(focusLossLogs)
  );

  const integrityEventList =
    dedupeReplayEvents(
      safeArray(integrityLogs)
    );

  const assignmentLevel =
    submission?.assignment?.languageLevel ||
    submission?.assignment?.language_level ||
    submission?.assignmentDetails?.languageLevel ||
    submission?.assignmentDetails?.language_level ||
    submission?.languageLevel ||
    submission?.language_level ||
    "B1";

  const processAnalysis = useMemo(
    () =>
      wpAnalyzeWritingProcess({
        submission,
        assignmentLevel,
        finalText,
        replayEvents,
        allWritingEvents: writingEvents,
      }),
    [
      submission,
      assignmentLevel,
      finalText,
      replayEvents,
      writingEvents,
    ]
  );

  const totalElapsedMs =
    frames.at(-1)?.elapsedMs || 0;

  const replayStartMs =
    getEventTimeMs(replayEvents[0]) ||
    replayFallbackStartMs;

  const activeAbsoluteMs =
    replayStartMs +
    Number(activeFrame?.elapsedMs || 0);

  const visibleProcessTimeline = useMemo(() => {
    const timeline =
      processAnalysis?.timeline || [];

    const firstActive = timeline.findIndex(
      (bucket) =>
        Number(bucket?.typedChars || 0) > 0 ||
        Number(bucket?.pasteChars || 0) > 0
    );

    return firstActive > 0
      ? timeline.slice(firstActive)
      : timeline;
  }, [processAnalysis]);

  function findFrameForEvent(event) {
    const eventId = String(
      event?.id ||
        event?.__replayKey ||
        ""
    );

    const index = frames.findIndex(
      (frame) =>
        String(
          frame.sourceEventId ||
            frame.sourceEventKey ||
            ""
        ) === eventId
    );

    return index >= 0 ? index : 0;
  }

  function jumpToEvent(event) {
    setFrameIndex(
      findFrameForEvent(event)
    );
    setIsPlaying(false);
  }

  function stepFrame(direction) {
    setIsPlaying(false);

    setFrameIndex((current) =>
      clampNumber(
        current + direction,
        0,
        frames.length - 1
      )
    );
  }

  const processMetricCards = [
    {
      key: "typingRate",
      value:
        processAnalysis?.metrics?.typingRate,
      coachValue:
        processAnalysis?.coachBaseline
          ?.typingRate,
      range:
        processAnalysis
          ?.cohortComparison?.ranges
          ?.typingRate,
      position:
        processAnalysis
          ?.cohortComparison?.positions
          ?.typingRate,
    },
    {
      key: "longPauses",
      value:
        processAnalysis?.metrics
          ?.longPausesPer100w,
      coachValue: null,
      range:
        processAnalysis
          ?.cohortComparison?.ranges
          ?.longPauses,
      position:
        processAnalysis
          ?.cohortComparison?.positions
          ?.longPauses,
    },
    {
      key: "localRevisions",
      value:
        processAnalysis?.metrics
          ?.localRevisionsPer100w,
      coachValue:
        processAnalysis?.coachBaseline
          ?.localRevisionsPer100w,
      range:
        processAnalysis
          ?.cohortComparison?.ranges
          ?.localRevisions,
      position:
        processAnalysis
          ?.cohortComparison?.positions
          ?.localRevisions,
    },
    {
      key: "productProcessRatio",
      value:
        processAnalysis?.metrics
          ?.productProcessRatio,
      coachValue: null,
      range:
        processAnalysis
          ?.cohortComparison?.ranges
          ?.productProcessRatio,
      position:
        processAnalysis
          ?.cohortComparison?.positions
          ?.productProcessRatio,
    },
  ];

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-2">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

            <div>
              <h2 className="font-serif text-base font-bold text-slate-950">
                Writing Journey & Replay
              </h2>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Exact assignment-specific writing operations recorded from the student draft.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EvidencePill
              icon={Clock3}
              label={formatDuration(
                activeWritingSeconds
              )}
            />

            <EvidencePill
              icon={FileText}
              label={`${finalWordCount} final words`}
            />

            <EvidencePill
              icon={Activity}
              label={`${editEvents.length} edits`}
            />

            <EvidencePill
              icon={Copy}
              label={`${pasteEvents.length} paste`}
              alert={pasteEvents.length > 0}
            />

            <EvidencePill
              icon={MousePointerClick}
              label={`${focusEvents.length} focus`}
            />
          </div>
        </div>
      </div>

      <div className="bg-[#F8FAFC] p-4">
        {replayEvents.length === 0 ? (
          <EmptyEvidenceState
            title="No writing journey data"
            description="New student drafting activity will appear here after Step 2 saves structured writing events."
          />
        ) : (
          <div className="w-full space-y-4">
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[390px_minmax(0,1fr)]">
              <div className="space-y-4 2xl:contents">
                <div className="relative rounded-2xl border border-slate-200 bg-white 2xl:col-start-1 2xl:row-start-1">
                  <div className="flex items-center transition-colors hover:bg-slate-50">
                    <button
                      type="button"
                      aria-expanded={processCheckOpen}
                      onClick={() =>
                        setProcessCheckOpen((current) => !current)
                      }
                      className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left"
                    >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                        <Gauge className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                          Writing process check
                        </h3>

                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          Evidence summary, not an automatic misconduct decision.
                        </p>
                      </div>
                    </div>

                      <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-1 text-[9px] font-mono font-bold ${wpStatusPillClasses(
                          processAnalysis.status
                        )}`}
                      >
                        {
                          processAnalysis.statusLabel
                        }
                      </span>

                      {processCheckOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                      </div>
                    </button>

                    <div ref={processHelpRef} className="relative mr-4 shrink-0">
                      <button
                        type="button"
                        aria-label="What do these labels mean?"
                        aria-expanded={processHelpOpen}
                        onClick={() => setProcessHelpOpen((current) => !current)}
                        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-500 hover:bg-slate-50"
                        title="What do these labels mean?"
                      >
                        ?
                      </button>

                      {processHelpOpen && (
                        <div className="absolute right-0 top-full z-[100] mt-1.5 w-[min(360px,85vw)] rounded-[10px] border border-slate-200 bg-white px-3.5 py-3 text-[0.8rem] leading-[1.55] text-slate-800 shadow-[0_4px_16px_rgba(0,0,0,0.10)]">
                          <p className="mb-1.5 font-semibold">
                            How this label is determined
                          </p>
                          <p className="mb-2">
                            This single label combines every process signal into one of four bands: keystroke checks (pastes, fluency, revision) plus any metric that sits clearly outside the peer range for this level. The chips below the label show which signals contributed.
                          </p>
                          <p className="mb-1">
                            <strong>Typical process</strong> — no unusual patterns; the writing looks like normal drafting with revisions and pauses.
                          </p>
                          <p className="mb-1">
                            <strong>Review suggested</strong> — one moderate signal worth checking (e.g. a large paste, very little revision, or unusual pause distribution).
                          </p>
                          <p className="mb-1">
                            <strong>Close review needed</strong> — three or more independent signals are unusual together. Look at the timeline, paste evidence, and playback before deciding.
                          </p>
                          <p className="mb-2">
                            <strong>Not enough writing data</strong> — fewer than 80 final words, so process signals can't be interpreted reliably.
                          </p>
                          <p className="italic text-slate-500">
                            This panel is one signal — always interpret alongside the playback. No single indicator is conclusive.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {processCheckOpen && (
                    <div className="border-t border-slate-100 p-4">
                      <p className="text-[10px] leading-relaxed text-slate-600">
                        {
                          processAnalysis.reason
                        }
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {processAnalysis.evidence.length >
                        0 ? (
                          processAnalysis.evidence.map(
                            (
                              evidence,
                              evidenceIndex
                            ) => (
                              <span
                                key={`${evidence.code || "evidence"}-${evidenceIndex}`}
                                title={
                                  evidence.detail
                                }
                                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-mono font-bold text-slate-700"
                              >
                                {
                                  evidence.label
                                }
                              </span>
                            )
                          )
                        ) : processAnalysis.status ===
                          WP_STATUS.INSUFFICIENT ? (
                          <p className="text-[10px] text-slate-500">
                            Process comparison chips are hidden until there is enough typed writing (80+ final words).
                          </p>
                        ) : (
                          <p className="text-[10px] text-slate-500">
                            No specific process signals were flagged.
                          </p>
                        )}
                      </div>

                      {processAnalysis.metrics
                        ?.ignoredIdlePauseCount >
                        0 && (
                        <p className="mt-2 text-[10px] text-slate-500">
                          {
                            processAnalysis
                              .metrics
                              .ignoredIdlePauseCount
                          }{" "}
                          longer gap
                          {processAnalysis.metrics
                            .ignoredIdlePauseCount ===
                          1
                            ? ""
                            : "s"}{" "}
                          over 2 minutes treated as idle or away time, not thinking pauses.
                        </p>
                      )}

                      {visibleProcessTimeline.length >
                        0 && (
                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] text-slate-500">
                            <span>
                              Activity timeline
                            </span>
                            <span>
                              Blue bars = typed chars, pink dot = paste event
                            </span>
                          </div>
                          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${visibleProcessTimeline.length}, minmax(8px, 1fr))` }}>
                            {visibleProcessTimeline.map(
                              (
                                bucket,
                                bucketIndex
                              ) => {
                                const bucketHeight = Math.max(
                                  8,
                                  Math.round(
                                    58 *
                                      Number(
                                        bucket.intensity ||
                                          0
                                      )
                                  )
                                );

                                const bucketActive =
                                  activeAbsoluteMs >=
                                    Number(
                                      bucket.startMs
                                    ) &&
                                  activeAbsoluteMs <=
                                    Number(
                                      bucket.endMs
                                    );

                                const hasPaste =
                                  Number(
                                    bucket.pasteChars ||
                                      0
                                  ) > 0;

                                return (
                                  <div
                                    key={`bucket_${bucketIndex}`}
                                    title={`${bucket.label} - ${bucket.typedChars} typed chars${hasPaste ? ` - ${bucket.pasteChars} paste chars` : ""}`}
                                    className={`relative flex items-end justify-center rounded-md border px-0.5 pb-1 pt-2 ${
                                      bucketActive
                                        ? "border-amber-300 bg-amber-50"
                                        : "border-slate-200 bg-white"
                                    }`}
                                  >
                                    {hasPaste && (
                                      <span className="absolute left-1/2 top-0.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-400" />
                                    )}
                                    <span
                                      className="w-full rounded-sm bg-blue-500"
                                      style={{ height: `${bucketHeight}px` }}
                                    />
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>
                      )}

                      <div className="mt-3">
                        <p className="text-[10px] font-bold text-slate-700">
                          Writing-style detail
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-500">
                          {processAnalysis.status ===
                          WP_STATUS.INSUFFICIENT
                            ? "Peer comparison is paused until there is enough typed writing data."
                            : "Peer comparison for each measure. Deviations from peer range feed the check above."}
                        </p>
                        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {processMetricCards.map(
                            (metric) => {
                              const range =
                                Array.isArray(
                                  metric.range
                                ) &&
                                metric.range.length ===
                                  2
                                  ? metric.range
                                  : [0, 1];

                              const metricValue = Number(
                                metric.value || 0
                              );

                              const low =
                                Number(range[0]);
                              const high =
                                Number(range[1]);

                              const leftPercent =
                                high > low
                                  ? Math.max(
                                      0,
                                      Math.min(
                                        100,
                                        ((metricValue -
                                          low) /
                                          (high -
                                            low)) *
                                          100
                                      )
                                    )
                                  : 50;

                              const definition =
                                WP_METRIC_DEFINITIONS[
                                  metric.key
                                ];

                              return (
                                <div
                                  key={metric.key}
                                  className="rounded-xl border border-slate-200 bg-white p-3"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
                                        {
                                          definition?.label
                                        }
                                      </p>
                                      <p className="mt-1 text-sm font-mono font-black text-slate-900">
                                        {wpFormatMetricValue(
                                          metric.key,
                                          metric.value
                                        )}
                                      </p>
                                    </div>
                                    <span className={`rounded-full border px-2 py-1 text-[8px] font-mono font-black uppercase ${wpMetricTagClasses(metric.position)}`}>
                                      {wpMetricTag(
                                        metric.position
                                      )}
                                    </span>
                                  </div>

                                  <div className="mt-2">
                                    <div className="relative h-2 rounded-full bg-slate-100">
                                      <div
                                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 shadow"
                                        style={{ left: `calc(${leftPercent}% - 6px)` }}
                                      />
                                    </div>
                                    <div className="mt-1 flex justify-between text-[8px] font-mono text-slate-400">
                                      <span>
                                        {wpFormatMetricValue(
                                          metric.key,
                                          low
                                        )}
                                      </span>
                                      <span>
                                        {wpFormatMetricValue(
                                          metric.key,
                                          high
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  <p className="mt-2 text-[9px] leading-relaxed text-slate-500">
                                    {definition?.help}
                                  </p>
                                  <p className="mt-1 text-[9px] leading-relaxed text-slate-500">
                                    Coach/outline baseline:{" "}
                                    {metric.coachValue ===
                                      null ||
                                    metric.coachValue ===
                                      undefined
                                      ? "not enough data yet"
                                      : wpFormatMetricValue(
                                          metric.key,
                                          metric.coachValue
                                        )}
                                  </p>
                                </div>
                              );
                            }
                          )}
                        </div>
                      </div>

                      <p className="mt-3 text-[9px] text-slate-500">
                        Reference ranges are preliminary for{" "}
                        {
                          processAnalysis
                            .cohortComparison
                            ?.level
                        }
                        {" "}
                        (n=
                        {
                          processAnalysis
                            .cohortComparison?.n
                        }
                        ) and should be interpreted with playback and instructor judgment.
                      </p>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white 2xl:col-span-2 2xl:row-start-2">
                  <button
                    type="button"
                    aria-expanded={timelineOpen}
                    onClick={() =>
                      setTimelineOpen((current) => !current)
                    }
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-700">
                        <Activity className="h-4 w-4" />
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900">
                          Activity timeline
                        </h3>

                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          Select any event, including paste events, to jump to its replay frame.
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-mono font-bold text-slate-600">
                        {replayTimeline.length} activities
                      </span>

                      {timelineOpen ? (
                        <ChevronDown className="h-4 w-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {timelineOpen && (
                    <div className="grid grid-cols-1 gap-1.5 border-t border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
                      {replayTimeline.map(
                        (event, index) => {
                          const eventFrameIndex =
                            findFrameForEvent(event);

                          const isActive =
                            event.timelineEventKeys?.includes(
                              String(
                                activeFrame?.sourceEventKey ||
                                  activeFrame?.sourceEventId ||
                                  ""
                              )
                            );

                          const isPaste =
                            isPasteLikeWritingEvent(event);

                          return (
                            <button
                              key={`${event.__replayKey}-${index}`}
                              type="button"
                              onClick={() =>
                                jumpToEvent(event)
                              }
                              className={`w-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                                isActive
                                  ? isPaste
                                    ? "border-violet-300 bg-violet-50 ring-2 ring-violet-500/10"
                                    : "border-amber-300 bg-amber-50 ring-2 ring-amber-500/10"
                                  : isPaste
                                  ? "border-violet-100 bg-violet-50/50 hover:border-violet-200 hover:bg-violet-50"
                                  : "border-slate-200 bg-[#F8FAFC] hover:border-amber-200 hover:bg-white"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="truncate text-[11px] font-bold text-slate-900">
                                      {event.timelineLabel ||
                                        getEventLabel(event)}
                                    </p>

                                    {isPaste && (
                                      <span className="rounded-full border border-violet-200 bg-white px-1.5 py-0.5 text-[8px] font-mono font-black uppercase text-violet-700">
                                        Paste
                                      </span>
                                    )}
                                  </div>

                                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                                    {event.timelinePreview ||
                                      event.preview ||
                                      `${event.wordCount || 0} words recorded`}
                                  </p>
                                </div>

                                <div className="shrink-0 text-right">
                                  <span className="block text-[9px] font-mono text-slate-400">
                                    {formatTime(
                                      event.timestamp ||
                                        event.createdAt
                                    )}
                                  </span>

                                  <span className="mt-0.5 block text-[8px] font-mono text-slate-300">
                                    frame {eventFrameIndex + 1}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white 2xl:col-start-2 2xl:row-start-1">
                <div className="border-b border-slate-100 px-4 py-3">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Character-by-character replay
                      </h3>

                      <p className="mt-0.5 text-[10px] text-slate-500">
                        Typing appears one character at a time. Paste appears in one highlighted burst.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFrameIndex(0);
                          setIsPlaying(false);
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                        title="Start"
                      >
                        <SkipBack className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          stepFrame(-1)
                        }
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                      >
                        Back
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isPlaying) {
                            setIsPlaying(false);
                            return;
                          }

                          if (
                            frameIndex >=
                            frames.length - 1
                          ) {
                            setFrameIndex(0);
                          }

                          setIsPlaying(true);
                        }}
                        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 text-[10px] font-bold text-white hover:bg-amber-700"
                      >
                        {isPlaying ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}

                        {isPlaying
                          ? "Pause"
                          : "Play"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          stepFrame(1)
                        }
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                      >
                        Next
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setFrameIndex(
                            frames.length - 1
                          );
                          setIsPlaying(false);
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-bold text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                        title="Final frame"
                      >
                        <SkipForward className="h-3.5 w-3.5" />
                      </button>

                      <label className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                        Speed

                        <select
                          value={playbackSpeed}
                          onChange={(event) =>
                            setPlaybackSpeed(
                              Number(
                                event.target.value
                              )
                            )
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 outline-none"
                        >
                          {[1, 2, 5, 10, 15].map(
                            (speed) => (
                              <option
                                key={speed}
                                value={speed}
                              >
                                {speed}×
                              </option>
                            )
                          )}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-mono text-slate-500">
                    <span>
                      Frame {frameIndex + 1} /{" "}
                      {frames.length}
                    </span>

                    <span>
                      {formatPlaybackDuration(
                        activeFrame?.elapsedMs || 0
                      )}{" "}
                      /{" "}
                      {formatPlaybackDuration(
                        totalElapsedMs
                      )}{" "}
                      recorded
                    </span>
                  </div>

                  <input
                    type="range"
                    min="0"
                    max={Math.max(
                      0,
                      frames.length - 1
                    )}
                    value={frameIndex}
                    onChange={(event) => {
                      setFrameIndex(
                        Number(
                          event.target.value
                        )
                      );
                      setIsPlaying(false);
                    }}
                    className="mt-2 w-full accent-amber-600"
                  />
                </div>

                <div className="flex min-h-0 flex-1 flex-col p-4">
                  <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-[10px] font-mono font-black uppercase tracking-wider text-amber-700">
                          {activeFrame?.eventGroup ||
                            "Writing"}{" "}
                          ·{" "}
                          {activeFrame?.label ||
                            "Start"}
                        </p>

                        <p className="mt-1 text-[10px] text-slate-500">
                          {activeEvent
                            ? getEventLabel(
                                activeEvent
                              )
                            : "Replay begins with an empty draft."}
                        </p>
                      </div>

                      <span className="text-[10px] font-mono text-slate-500">
                        {countWords(
                          activeFrame?.text || ""
                        )}{" "}
                        words
                      </span>
                    </div>
                  </div>

                  <pre className="mt-3 min-h-[420px] flex-1 whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-white p-5 font-mono text-[12px] leading-7 text-slate-700">
                    <PlaybackFrameText
                      frame={activeFrame}
                    />
                  </pre>
                </div>
              </div>
            </div>

            {integrityEventList.length > 0 && (
              <p className="text-[9px] font-mono text-slate-400">
                {integrityEventList.length} unique integrity event
                {integrityEventList.length === 1
                  ? ""
                  : "s"}{" "}
                retained after deduplication.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function EvidencePill({ icon: Icon, label, alert = false }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[9px] font-mono font-bold ${
        alert
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-[#F8FAFC] text-slate-600"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}


function AiCheckWorkspace({
  aiReviewLoading,
  aiReviewError,
  aiSuggestion,
  onRunAiCheck,
  applyAiRubricScores,
  applyAiFeedback,
  rubricCriteria,
  rubricTotal,
  currentRubric,
  onCancel,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm min-w-0 flex flex-col min-h-0 overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BrainCircuit className="w-4 h-4 text-violet-700 shrink-0" />

            <div className="min-w-0">
              <h2 className="font-serif text-base font-bold text-slate-950">
                AI Check Workspace
                {currentRubric?.title && (
                  <span className="font-sans text-xs font-bold text-slate-400 ml-2">
                    · {currentRubric.title}
                  </span>
                )}
              </h2>

              <p className="text-[11px] text-slate-500 mt-0.5">
                Analyze the submission, suggest rubric scores, and generate feedback.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRunAiCheck}
            disabled={aiReviewLoading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {aiReviewLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            {aiReviewLoading ? "Analyzing..." : aiSuggestion ? "Run Again" : "Run AI Check"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto bg-[#F8FAFC] p-4">
        {aiReviewLoading ? (
          <div className="h-full min-h-[420px] flex items-center justify-center">
            <div className="max-w-lg rounded-3xl border border-violet-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-700">
                <Loader2 className="w-7 h-7 animate-spin" />
              </div>

              <h3 className="font-serif text-xl font-bold text-slate-950 mt-4">
                Analyzing submission and rubric
              </h3>

              <p className="text-sm text-slate-500 leading-relaxed mt-2">
                Praxis is checking the student text against the assignment rubric and preparing an instructor-only suggestion.
              </p>

              <p className="text-[11px] text-violet-700 font-bold mt-4">
                AI suggestion only. Instructor must review before applying.
              </p>
            </div>
          </div>
        ) : aiReviewError ? (
          <div className="max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />

              <div>
                <h3 className="font-serif text-lg font-bold text-red-900">
                  AI Check could not run
                </h3>

                <p className="text-sm text-red-700 leading-relaxed mt-2">
                  {aiReviewError}
                </p>

                <button
                  type="button"
                  onClick={onRunAiCheck}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100"
                >
                  <Bot className="w-4 h-4" />
                  Try Again
                </button>
              </div>
            </div>
          </div>
        ) : !aiSuggestion ? (
          <div className="flex h-full min-h-[420px] items-center justify-center p-5">
            <div className="w-full max-w-lg rounded-3xl border border-violet-200 bg-white p-7 text-center shadow-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-200 bg-violet-50 text-violet-700">
                <Sparkles className="h-7 w-7" />
              </div>

              <h3 className="mt-4 font-serif text-xl font-bold text-slate-950">
                Use AI Review?
              </h3>

              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                AI will analyze this student submission and suggest rubric
                scores and feedback. Nothing is applied or saved automatically.
              </p>

              <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/70 px-4 py-3 text-left">
                <p className="text-[11px] leading-relaxed text-violet-800">
                  You remain responsible for reviewing, editing, and approving
                  every AI suggestion before saving the final review.
                </p>
              </div>

              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={onRunAiCheck}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/20 transition-colors hover:bg-violet-700"
                >
                  <Sparkles className="h-4 w-4" />
                  Start AI Review
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-[1100px] mx-auto space-y-4">
            <div className="rounded-2xl border border-violet-200 bg-white p-4">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-violet-700" />

                    <h3 className="font-serif text-lg font-bold text-slate-950">
                      AI Review Result
                    </h3>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mt-2">
                    {aiSuggestion.summary}
                  </p>

                  <p className="text-[11px] font-bold text-violet-700 mt-3">
                    AI suggestion only. Instructor must review before applying.
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-right shrink-0">
                  <p className="text-[10px] font-mono font-black uppercase tracking-wider text-violet-700">
                    Suggested Score
                  </p>

                  <p className="text-2xl font-mono font-black text-violet-900 mt-1">
                    {aiSuggestion.finalScore}
                    <span className="text-sm text-violet-500">
                      {" "}
                      / {rubricTotal || 100}
                    </span>
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={applyAiRubricScores}
                  className="rounded-xl border border-blue-200 bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Apply AI rubric scores
                </button>

              </div>
            </div>

            {aiSuggestion.feedback && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-700" />

                  <h3 className="font-serif text-base font-bold text-slate-950">
                    Suggested Feedback
                  </h3>
                </div>

                <p className="text-sm text-slate-700 leading-relaxed mt-3 whitespace-pre-wrap">
                  {aiSuggestion.feedback}
                </p>

                <button
                  type="button"
                  onClick={applyAiFeedback}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100"
                >
                  <MessageSquare className="w-4 h-4" />
                  Apply AI feedback as comment
                </button>
              </div>
            )}

            {(aiSuggestion.strengths.length > 0 ||
              aiSuggestion.improvements.length > 0) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <AiPointList
                  title="Strengths"
                  tone="green"
                  items={aiSuggestion.strengths}
                />

                <AiPointList
                  title="Suggested Improvements"
                  tone="amber"
                  items={aiSuggestion.improvements}
                />
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-700" />

                  <h3 className="font-serif text-base font-bold text-slate-950">
                    AI Rubric Grading
                  </h3>
                </div>

              </div>

              {aiSuggestion.criteriaScores.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] p-5 text-center">
                  <p className="text-sm text-slate-500">
                    AI did not return criterion-level scores. Use the final score and feedback as a suggestion.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {aiSuggestion.criteriaScores.map((item, index) => {
                    const criterion =
                      rubricCriteria.find(
                        (entry) =>
                          String(entry.id) === String(item.criterionId)
                      ) || {};

                    return (
                      <div
                        key={`${item.criterionId || index}`}
                        className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900">
                              {item.criterionName ||
                                criterion.name ||
                                `Criterion ${index + 1}`}
                            </p>

                            <p className="text-[11px] text-slate-500 mt-1">
                              {item.bandLabel || "Suggested level"}
                            </p>
                          </div>

                          <span className="shrink-0 text-[11px] font-mono font-black text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">
                            {item.score} / {criterion.points || item.maxPoints || " - "}
                          </span>
                        </div>

                        {item.comment && (
                          <p className="text-[11px] text-slate-600 leading-relaxed mt-2">
                            {item.comment}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AiPointList({ title, tone, items }) {
  if (!items || items.length === 0) return null;

  const classes =
    tone === "green"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-amber-200 bg-amber-50 text-amber-800";

  return (
    <div className={`rounded-2xl border p-4 ${classes}`}>
      <p className="text-[10px] font-mono font-black uppercase tracking-wider">
        {title}
      </p>

      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        {items.slice(0, 5).map((item, index) => (
          <li key={index}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function AnnotationHighlight({ annotation, children, onDelete }) {
  const highlightRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const tone = getAnnotationTone(annotation);
  const tooltipText = getAnnotationTooltipText(annotation);

  function showTooltip(sticky = false) {
    const element = highlightRef.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const width = 310;
    const margin = 12;

    let left = rect.left;
    let top = rect.bottom + 10;

    if (left + width > window.innerWidth - margin) {
      left = window.innerWidth - width - margin;
    }

    if (left < margin) {
      left = margin;
    }

    if (top > window.innerHeight - 170) {
      top = Math.max(margin, rect.top - 145);
    }

    setTooltip({
      top,
      left,
      width,
      sticky,
    });
  }

  function hideTooltip() {
    setTooltip((current) => {
      if (current?.sticky) return current;
      return null;
    });
  }

  function closeTooltip() {
    setTooltip(null);
  }

  return (
    <>
      <span
        ref={highlightRef}
        data-code={annotation.code || "NOTE"}
        onMouseEnter={() => showTooltip(false)}
        onMouseLeave={hideTooltip}
        onFocus={() => showTooltip(false)}
        onBlur={hideTooltip}
        onClick={(event) => {
          event.stopPropagation();
          showTooltip(true);
        }}
        tabIndex={0}
        title={`${tooltipText.code}  -  ${tooltipText.label}: ${tooltipText.comment}`}
        className={`relative rounded px-0.5 cursor-help transition-all outline-none focus:ring-4 focus:ring-blue-500/10 after:content-[attr(data-code)] after:inline-flex after:ml-1 after:align-middle after:rounded after:px-1 after:py-0.5 after:text-[8px] after:font-mono after:font-black after:uppercase after:tracking-wide ${tone.highlight}`}
      >
        {children}
      </span>

      {tooltip &&
        createPortal(
          <div
            className={`fixed z-[2147483647] rounded-xl border bg-white px-3 py-2 shadow-2xl ${tone.tooltip}`}
            style={{
              top: `${tooltip.top}px`,
              left: `${tooltip.left}px`,
              width: `${tooltip.width}px`,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-[10px] font-mono font-black uppercase tracking-wider border px-2 py-0.5 rounded ${tone.chip}`}
                >
                  {tooltipText.code}
                </span>

                <span className="text-xs font-bold text-slate-900 truncate">
                  {tooltipText.label}
                </span>
              </div>

              {tooltip.sticky && (
                <button
                  type="button"
                  onClick={closeTooltip}
                  className="w-6 h-6 rounded-lg border border-slate-200 bg-[#F8FAFC] text-slate-400 hover:text-slate-900 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed mt-2">
              {tooltipText.comment}
            </p>

            {tooltip.sticky && (
              <button
                type="button"
                onClick={() => {
                  if (typeof onDelete === "function") {
                    onDelete(annotation.id);
                  }
                  closeTooltip();
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] font-bold text-red-700 hover:bg-red-100 transition-all"
              >
                <Trash2 className="w-3 h-3" />
                Remove mark
              </button>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

function FloatingAnnotationToolbar({
  position,
  selectedText,
  annotationComment,
  setAnnotationComment,
  addAnnotation,
  onClose,
}) {
  const [showNoteInput, setShowNoteInput] = useState(false);

  const noteCode =
    ANNOTATION_CODES.find((item) => item.code === "NOTE") || {
      code: "NOTE",
      label: "Note",
      type: "note",
    };

  const markCodes = ANNOTATION_CODES.filter(
    (item) => item.code !== "NOTE"
  );

  function handleAddNote() {
    if (!annotationComment.trim()) {
      setShowNoteInput(true);
      return;
    }

    addAnnotation(noteCode);
  }

  return createPortal(
    <div
      className="fixed z-[2147483647] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
        transform:
          position.top < window.innerHeight / 2
            ? "translateY(0)"
            : "translateY(-100%)",
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-black uppercase tracking-wider text-blue-700">
            Annotate selection
          </p>

          <p className="mt-0.5 truncate text-[11px] text-slate-500">
            “{selectedText}”
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-[#F8FAFC] text-slate-400 hover:border-slate-300 hover:text-slate-900"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {markCodes.map((codeItem) => (
          <MiniAnnotationButton
            key={codeItem.code}
            codeItem={codeItem}
            addAnnotation={addAnnotation}
          />
        ))}

        <button
          type="button"
          onClick={() => setShowNoteInput((value) => !value)}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all ${
            showNoteInput
              ? "border-sky-200 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-[#F8FAFC] text-slate-600 hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
          }`}
        >
          <MessageSquare className="h-3 w-3" />
          Note
        </button>
      </div>

      {showNoteInput && (
        <div className="mt-2 space-y-2 rounded-xl border border-sky-100 bg-sky-50/60 p-2.5">
          <textarea
            autoFocus
            rows={3}
            value={annotationComment}
            onChange={(event) =>
              setAnnotationComment(event.target.value)
            }
            placeholder="Write the instructor note for this selected text..."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAnnotationComment("");
                setShowNoteInput(false);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={!annotationComment.trim()}
              onClick={handleAddNote}
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add note
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

function MiniAnnotationButton({ codeItem, addAnnotation }) {
  const isPositive = codeItem.code === "GOOD";
  const isNote = codeItem.code === "NOTE";

  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => addAnnotation(codeItem)}
      title={`${codeItem.code}  -  ${codeItem.label}`}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold transition-all ${
        isPositive
          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
          : isNote
          ? "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
          : "bg-[#F8FAFC] text-slate-700 border-slate-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      <span
        className={`font-mono text-[9px] px-1.5 py-0.5 rounded ${
          isPositive
            ? "bg-emerald-100 text-emerald-700"
            : isNote
            ? "bg-amber-100 text-amber-700"
            : "bg-blue-50 text-blue-700"
        }`}
      >
        {codeItem.code === "GOOD" ? "✓" : codeItem.code}
      </span>

      <span className="hidden xl:inline">{codeItem.label}</span>
    </button>
  );
}

function ReviewModeSwitch({
  reviewMode,
  setReviewMode,
  planningMessageCount,
  studentAiFeedbackCount,
  writingReplayCount,
}) {
  const tabs = [
    {
      id: "grading",
      label: "Review & Grade",
      icon: BookOpen,
      summary: "Text · Rubric · AI",
      tone: "blue",
      onClick: () => setReviewMode("grading"),
    },
    {
      id: "planning",
      label: "Planning & AI",
      icon: MessageSquare,
      summary: planningMessageCount + studentAiFeedbackCount,
      tone: "cyan",
      onClick: () => setReviewMode("planning"),
    },
    {
      id: "writing",
      label: "Writing Replay",
      icon: Activity,
      summary: writingReplayCount,
      tone: "amber",
      onClick: () => setReviewMode("writing"),
    },
  ];

  const activeStyles = {
    blue:
      "border-blue-300 bg-blue-50 text-blue-800 ring-2 ring-blue-500/10",
    cyan:
      "border-cyan-300 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-500/10",
    amber:
      "border-amber-300 bg-amber-50 text-amber-800 ring-2 ring-amber-500/10",
    violet:
      "border-violet-300 bg-violet-50 text-violet-800 ring-2 ring-violet-500/10",
  };

  return (
    <div className="grid grid-cols-1 gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm sm:grid-cols-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = reviewMode === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={tab.onClick}
            className={`min-w-0 rounded-xl border px-2.5 py-1.5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60 ${
              isActive
                ? activeStyles[tab.tone]
                : tab.tone === "violet"
                ? "border-violet-200 bg-violet-50/70 text-violet-800 hover:bg-violet-100"
                : "border-slate-200 bg-[#F8FAFC] text-slate-600 hover:border-blue-200 hover:bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Icon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    tab.spinning ? "animate-spin" : ""
                  }`}
                />

                <span className="truncate text-[11px] font-bold">
                  {tab.label}
                </span>
              </div>

              <span className="shrink-0 rounded-md bg-white/70 px-1 py-0.5 text-[8px] font-mono font-bold">
                {tab.summary}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
function ReviewPanelHeader() {
  return (
    <div className="flex items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Pencil className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0">
        <h2 className="font-serif text-sm font-bold text-slate-950">
          Instructor Feedback
        </h2>

        <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
          Write the final comment the student will receive.
        </p>
      </div>
    </div>
  );
}

function ReviewTabs({
  activeReviewTab,
  setActiveReviewTab,
  annotationCount,
  hasSignals,
  hasAiSuggestion,
}) {
  return (
    <div className="grid grid-cols-1 gap-2 mt-4">
      {REVIEW_TABS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeReviewTab === tab.id;

        let badge = null;

        if (tab.id === "annotations" && annotationCount > 0) {
          badge = annotationCount;
        }

        if (tab.id === "signals" && hasSignals) {
          badge = "!";
        }

        if (tab.id === "feedback" && hasAiSuggestion) {
          badge = "AI";
        }

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveReviewTab(tab.id)}
            className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
              isActive
                ? "bg-blue-50 border-blue-300 ring-4 ring-blue-500/10 text-blue-800"
                : "bg-[#F8FAFC] border-slate-200 hover:bg-white hover:border-blue-200 text-slate-600"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-3.5 h-3.5 shrink-0" />

                <span className="text-[11px] font-bold truncate">
                  {tab.label}
                </span>
              </div>

              {badge !== null && (
                <span
                  className={`text-[9px] font-mono font-bold rounded-full px-1.5 py-0.5 ${
                    tab.id === "signals" && hasSignals
                      ? "bg-red-100 text-red-700"
                      : tab.id === "feedback" && hasAiSuggestion
                      ? "bg-violet-100 text-violet-700"
                      : "bg-white text-blue-700 border border-blue-100"
                  }`}
                >
                  {badge}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function SavedAnnotationsPanel({ annotations, deleteAnnotation }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
        <Highlighter className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />

        <div>
          <p className="text-xs font-bold text-blue-900">Saved inline marks</p>

          <p className="text-[11px] text-blue-800 mt-1 leading-relaxed">
            Marks appear inside the student text. Hover or click a mark to see
            the explanation or remove it.
          </p>
        </div>
      </div>

      {annotations.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] p-4 text-center">
          <p className="text-xs text-slate-400">
            No marks yet. Select text on the left to add one.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {annotations.map((annotation, index) => {
            const tone = getAnnotationTone(annotation);

            return (
              <div
                key={annotation.id}
                className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span
                      className={`text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${tone.chip}`}
                    >
                      {annotation.code || annotation.type || "comment"}
                    </span>

                    <p className="text-[10px] text-slate-500 mt-1">
                      {annotation.label || annotation.type || "Instructor note"}
                    </p>

                    <p className="text-[10px] text-slate-400 font-mono mt-1">
                      Mark {index + 1}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => deleteAnnotation(annotation.id)}
                    className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-400 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center"
                    title="Delete annotation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-slate-600 font-mono leading-relaxed bg-white border border-slate-200 rounded p-2">
                  “{annotation.selectedText}”
                </p>

                <p className="text-[11px] text-slate-700 leading-relaxed">
                  {annotation.comment}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RubricScorePanel({
  rubric,
  rubricCriteria,
  rubricScores,
  rubricScoreTotal,
  rubricTotal,
  gradedCriteriaCount,
  selectBand,
  adjustCriterionScore,
  updateCriterionScore,
  updateCriterionComment,
  finalOverrideEnabled,
  setFinalOverrideEnabled,
  finalOverride,
  setFinalOverride,
  aiSuggestion,
  applyAiRubricScores,
}) {
  const firstUngradedIndex = rubricCriteria.findIndex((criterion) => {
    const entry = getScoreEntry(rubricScores, criterion.id);
    return entry.score === "" || entry.score === null;
  });

  const defaultCriterionKey =
    rubricCriteria.length > 0
      ? `${rubricCriteria[0].id || "criterion"}::0`
      : null;

  const firstUngradedKey =
    firstUngradedIndex >= 0
      ? `${rubricCriteria[firstUngradedIndex].id || "criterion"}::${firstUngradedIndex}`
      : defaultCriterionKey;

  const [openCriterionKey, setOpenCriterionKey] = useState(
    firstUngradedKey
  );

  useEffect(() => {
    if (!rubricCriteria.length) {
      return;
    }

    const currentStillExists = rubricCriteria.some(
      (criterion, index) =>
        `${criterion.id || "criterion"}::${index}` === openCriterionKey
    );

    if (!currentStillExists) {
      setOpenCriterionKey(firstUngradedKey || defaultCriterionKey);
    }
  }, [rubricCriteria, openCriterionKey, firstUngradedKey, defaultCriterionKey]);

  const activeIndex = Math.max(
    0,
    rubricCriteria.findIndex(
      (criterion, index) =>
        `${criterion.id || "criterion"}::${index}` === openCriterionKey
    )
  );

  const activeCriterion = rubricCriteria[activeIndex] || null;
  const activeEntry = activeCriterion
    ? getScoreEntry(rubricScores, activeCriterion.id)
    : null;

  function handleBandSelection(criterion, band) {
    selectBand(criterion, band);

    const currentIndex = rubricCriteria.findIndex(
      (item) => String(item.id) === String(criterion.id)
    );

    const nextUngradedIndex = rubricCriteria.findIndex(
      (item, index) => {
        if (index <= currentIndex) return false;
        const entry = getScoreEntry(rubricScores, item.id);
        return entry.score === "" || entry.score === null;
      }
    );

    if (nextUngradedIndex >= 0) {
      const nextKey = `${rubricCriteria[nextUngradedIndex].id || "criterion"}::${nextUngradedIndex}`;
      window.setTimeout(() => {
        setOpenCriterionKey(nextKey);
      }, 120);
    }
  }

  return (
    <div className="w-full space-y-2">
      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
        <div className="mb-2 flex flex-col gap-2 border-b border-slate-100 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 shrink-0 text-blue-600" />

              <h3 className="truncate text-sm font-bold text-slate-900">
                {rubric?.title || "Rubric Grading Workspace"}
              </h3>
            </div>

            <p className="mt-1 text-[10px] text-slate-500">
              {gradedCriteriaCount}/{rubricCriteria.length} graded
              <span className="mx-1.5 text-slate-300">·</span>
              {rubricScoreTotal}/{rubricTotal}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {aiSuggestion && (
              <button
                type="button"
                onClick={applyAiRubricScores}
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-bold text-violet-800 hover:bg-violet-100"
              >
                <Bot className="h-3.5 w-3.5" />
                Apply AI
              </button>
            )}

            <span className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1.5 font-mono text-xs font-black text-blue-700">
              {rubricScoreTotal}/{rubricTotal}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {rubricCriteria.map((criterion, index) => {
              const criterionKey = `${criterion.id || "criterion"}::${index}`;
              const selected = getScoreEntry(rubricScores, criterion.id);
              const selectedBand = safeArray(criterion.bands).find(
                (band) => String(band.id) === String(selected?.bandId)
              );
              const isActive = criterionKey === openCriterionKey;

              return (
                <button
                  key={criterionKey}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setOpenCriterionKey(criterionKey)}
                  className={`min-w-[180px] flex-1 rounded-xl border px-3 py-2 text-left transition-all ${
                    isActive
                      ? "border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-500/10"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-[11px] font-bold leading-4 text-slate-900">
                        {criterion.name}
                      </p>
                      <p
                        className={`mt-0.5 text-[8px] font-semibold ${
                          selectedBand ? "text-emerald-700" : "text-slate-400"
                        }`}
                      >
                        {selectedBand ? selectedBand.label : "Not assessed"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-mono font-bold text-slate-500">
                      {criterion.points} pts
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {activeCriterion && activeEntry && (
            <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
              <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-2.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-mono font-black uppercase tracking-wider text-blue-600">
                      Criterion {activeIndex + 1} of {rubricCriteria.length}
                    </p>
                    <h3 className="mt-0.5 text-sm font-bold text-slate-950">
                      {activeCriterion.name}
                    </h3>
                    {activeCriterion.description && (
                      <p className="mt-0.5 line-clamp-2 max-w-5xl text-[10px] leading-4 text-slate-500">
                        {activeCriterion.description}
                      </p>
                    )}
                  </div>

                  <span className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-mono font-bold text-blue-700">
                    {activeCriterion.points} points
                  </span>
                </div>
              </div>

              <div className="grid gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {safeArray(activeCriterion.bands).map((band) => {
                  const isSelected =
                    String(activeEntry.bandId || "") === String(band.id);

                  return (
                    <button
                      key={band.id}
                      type="button"
                      onClick={() => handleBandSelection(activeCriterion, band)}
                      className={`h-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                        isSelected
                          ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/10"
                          : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                      }`}
                    >
                      <div className="flex h-full items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900">
                            {band.label}
                          </p>
                          {band.description && (
                            <p
                              className="mt-1 line-clamp-6 text-[9px] leading-[1.45] text-slate-500"
                              title={band.description}
                            >
                              {band.description}
                            </p>
                          )}
                        </div>
                        <span className="shrink-0 font-mono text-xs font-black text-blue-700">
                          {band.points}/{activeCriterion.points}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-slate-200 bg-[#F8FAFC] p-2.5">
                <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)]">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => adjustCriterionScore(activeCriterion, -0.5)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>

                    <input
                      type="number"
                      min="0"
                      max={activeCriterion.points}
                      step="0.5"
                      value={activeEntry.score}
                      onChange={(event) =>
                        updateCriterionScore(activeCriterion, event.target.value)
                      }
                      className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-2 text-center text-xs font-bold focus:border-blue-500 focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() => adjustCriterionScore(activeCriterion, 0.5)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <input
                    value={activeEntry.comment}
                    onChange={(event) =>
                      updateCriterionComment(activeCriterion.id, event.target.value)
                    }
                    placeholder="Optional criterion comment..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="mt-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2">
          <label className="flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-[11px] font-bold text-slate-900">
                Final score override
              </span>

              <span className="block text-[10px] text-slate-500">
                Optional manual adjustment.
              </span>
            </span>

            <input
              type="checkbox"
              checked={finalOverrideEnabled}
              onChange={(event) =>
                setFinalOverrideEnabled(event.target.checked)
              }
              className="accent-blue-600"
            />
          </label>

          {finalOverrideEnabled && (
            <input
              type="number"
              min="0"
              max={rubricTotal}
              value={finalOverride}
              onChange={(event) => setFinalOverride(event.target.value)}
              placeholder="Final score"
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:border-blue-500 focus:outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
function CriterionAccordion({
  index,
  criterion,
  entry,
  selectBand,
  adjustCriterionScore,
  updateCriterionScore,
  updateCriterionComment,
}) {
  const selectedBand = criterion.bands?.find(
    (band) => String(band.id) === String(entry.bandId)
  );

  const hasScore = entry.score !== "" && entry.score !== null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2.5">
      <div className="grid grid-cols-1 gap-2 xl:grid-cols-[minmax(0,210px)_minmax(0,1fr)_minmax(0,300px)] xl:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-[10px] font-mono font-black ${
              hasScore
                ? "border-blue-100 bg-white text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            {index + 1}
          </span>

          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900">
              {criterion.name}
            </p>

            <p className="mt-0.5 truncate text-[10px] text-slate-500">
              {selectedBand
                ? selectedBand.label
                : hasScore
                ? "Custom score"
                : "Not graded"}
            </p>
          </div>

          <span
            className={`ml-auto shrink-0 rounded-lg border px-2 py-1 text-[10px] font-mono font-bold ${
              hasScore
                ? "border-blue-100 bg-white text-blue-700"
                : "border-slate-200 bg-slate-50 text-slate-400"
            }`}
          >
            {hasScore ? entry.score : " - "} / {criterion.points}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 2xl:grid-cols-3">
          {criterion.bands?.map((band) => {
            const isSelected =
              String(entry.bandId || "") === String(band.id);

            return (
              <button
                key={band.id}
                type="button"
                onClick={() => selectBand(criterion, band)}
                title={band.description || band.label}
                className={`rounded-lg border px-2.5 py-1.5 text-left transition-all ${
                  isSelected
                    ? "border-blue-300 bg-blue-50 ring-2 ring-blue-500/10"
                    : "border-slate-200 bg-[#F8FAFC] hover:border-blue-200 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-bold text-slate-900">
                    {band.label}
                  </span>

                  <span className="shrink-0 rounded-md border border-blue-100 bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold text-blue-700">
                    {band.points}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[140px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[140px_minmax(0,1fr)]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjustCriterionScore(criterion, -0.5)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>

            <input
              type="number"
              min="0"
              max={criterion.points}
              step="0.5"
              value={entry.score}
              onChange={(event) =>
                updateCriterionScore(criterion, event.target.value)
              }
              className="w-20 rounded-lg border border-slate-200 bg-[#F8FAFC] px-2 py-2 text-center text-xs font-bold focus:border-blue-500 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => adjustCriterionScore(criterion, 0.5)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-200 hover:text-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <input
            value={entry.comment}
            onChange={(event) =>
              updateCriterionComment(criterion.id, event.target.value)
            }
            placeholder="Optional criterion comment..."
            className="w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[11px] focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
function ManualScorePanel({
  manualScore,
  setManualScore,
  aiSuggestion,
  applyAiRubricScores,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 max-w-lg">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
        <Pencil className="w-4 h-4 text-blue-600" />

        <h3 className="text-xs font-bold text-slate-900">Manual Score</h3>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="100"
          value={manualScore}
          onChange={(event) => setManualScore(event.target.value)}
          placeholder="Score"
          className="w-24 bg-[#F8FAFC] border border-slate-200 text-center rounded-xl py-2 text-xs font-bold focus:outline-none focus:border-blue-500"
        />

        <span className="text-xs font-bold text-slate-400">/ 100</span>
      </div>

      {aiSuggestion && (
        <button
          type="button"
          onClick={applyAiRubricScores}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-800 hover:bg-violet-100"
        >
          <Bot className="w-3.5 h-3.5" />
          Apply AI score
        </button>
      )}
    </div>
  );
}

function FeedbackPanel({ feedback, setFeedback }) {
  const characterCount = String(feedback || "").length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-1.5 text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
          Overall Feedback
        </label>

        <span className="text-[9px] font-mono text-slate-400">
          {characterCount} characters
        </span>
      </div>

      <textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="Write clear, actionable feedback for the student..."
        className="mt-2 flex-1 min-h-[210px] w-full resize-none rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs leading-6 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
      />

      <div className="mt-2 flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-600" />

        <p className="text-[10px] leading-relaxed text-slate-500">
          The student sees this message only after you save the review.
        </p>
      </div>
    </div>
  );
}

function ReviewSignalsPanel({
  submission,
  hasAiFlags,
  aiFlags,
  integrityLogs,
  copyPasteLogs,
  focusLossLogs,
  writingEvents,
  pasteAttemptCount,
  focusLossCount,
  feedbackChecksUsed,
}) {
  const blockedPasteCount = copyPasteLogs.filter(
    (log) => String(log.type).toLowerCase() === "paste_blocked"
  ).length;

  const recentSignals = [
    ...copyPasteLogs.map((log) => ({
      ...log,
      signalSource: "Paste",
    })),
    ...writingEvents.map((log) => ({
      ...log,
      signalSource: "Writing",
    })),
  ]
    .sort((a, b) => {
      const aTime = new Date(a.timestamp || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.createdAt || 0).getTime();

      return bTime - aTime;
    })
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />

        <p className="text-[11px] text-amber-800 leading-relaxed">
          Instructor-only context. Signals support review, not automatic grading.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <PlaybackCard
          icon={ShieldAlert}
          label="Paste Attempts"
          value={`${pasteAttemptCount || 0} total`}
          detail={
            blockedPasteCount > 0
              ? `${blockedPasteCount} blocked`
              : "No blocked paste"
          }
          hasAlert={pasteAttemptCount > 0}
        />



        <PlaybackCard
          icon={Activity}
          label="Writing Playback"
          value={`${writingEvents.length || 0} events`}
          detail="Drafting progress and autosave events."
        />

        <PlaybackCard
          icon={MessageSquare}
          label="AI Feedback Checks"
          value={`${feedbackChecksUsed || 0} used`}
          detail="AI draft feedback requests."
        />



        <PlaybackCard
          icon={hasAiFlags ? AlertTriangle : ShieldCheck}
          label="AI / External Flags"
          value={hasAiFlags ? `${aiFlags} detected` : "0 clean"}
          detail="Use as review context only."
          hasAlert={hasAiFlags}
        />
      </div>

      {recentSignals.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <h4 className="text-xs font-bold text-slate-900 mb-3">
            Recent activity
          </h4>

          <div className="space-y-2">
            {recentSignals.map((signal, index) => (
              <SignalRow key={signal.id || index} signal={signal} />
            ))}
          </div>
        </div>
      )}

      {integrityLogs.length === 0 &&
        copyPasteLogs.length === 0 &&
        writingEvents.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-[#F8FAFC] p-4 text-center">
            <p className="text-[11px] font-mono text-slate-400">
              No integrity or writing activity logs were saved.
            </p>
          </div>
        )}
    </div>
  );
}

function SignalRow({ signal }) {
  const type = String(signal.type || "").toLowerCase();

  if (
    type === "focus_loss" ||
    type === "large_insertion"
  ) {
    return null;
  }

  let title = signal.signalSource || "Activity";
  let description = "Writing activity recorded.";
  let tone = "bg-slate-50 border-slate-200 text-slate-700";

  if (type === "paste" || type === "paste_blocked") {
    title = type === "paste_blocked" ? "Paste blocked" : "Paste detected";
    description = `${signal.wordCount || 0} words · ${
      signal.charCount || 0
    } characters`;
    tone =
      type === "paste_blocked"
        ? "bg-red-50 border-red-200 text-red-800"
        : "bg-amber-50 border-amber-200 text-amber-800";
  }

  if (type === "focus_loss") {
    title = "Focus loss / tab switch";
    description =
      signal.details?.message ||
      "Student left the writing tab or window. No text was captured.";
    tone = "bg-amber-50 border-amber-200 text-amber-800";
  }

  if (type === "draft_update") {
    title = "Draft edited";
    description = `${signal.wordCount || 0} words · ${
      signal.charCount || 0
    } characters saved`;
  }

  return (
    <div className={`rounded-xl border px-3 py-2 text-[11px] ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{title}</p>

          <p className="mt-1 opacity-80 leading-relaxed">{description}</p>

          {signal.preview && type !== "focus_loss" && (
            <p className="mt-1 font-mono opacity-70 truncate">
              “{signal.preview}”
            </p>
          )}
        </div>

        <span className="font-mono opacity-70 shrink-0">
          {formatTime(signal.timestamp || signal.createdAt)}
        </span>
      </div>
    </div>
  );
}

function ReviewActionBar({ saveMessage }) {
  if (!saveMessage) return null;

  const normalizedMessage = saveMessage.toLowerCase();

  const isSuccess =
    normalizedMessage.includes("successfully") ||
    normalizedMessage.includes("saved");

  const isAiInfo =
    normalizedMessage.includes("ai suggested") ||
    normalizedMessage.includes("ai check") ||
    normalizedMessage.includes("ai review");

  const isWarning =
    normalizedMessage.includes("review before saving") ||
    normalizedMessage.includes("must be between") ||
    normalizedMessage.includes("choose") ||
    normalizedMessage.includes("please") ||
    normalizedMessage.includes("reopened") ||
    normalizedMessage.includes("resubmit");

  const tone = isSuccess
    ? {
        wrapper: "border-emerald-200 bg-emerald-50",
        icon: "text-emerald-700",
        title: "Saved",
        text: "text-emerald-800",
      }
    : isAiInfo
    ? {
        wrapper: "border-violet-200 bg-violet-50",
        icon: "text-violet-700",
        title: "AI suggestion applied",
        text: "text-violet-800",
      }
    : isWarning
    ? {
        wrapper: "border-amber-200 bg-amber-50",
        icon: "text-amber-700",
        title: "Review needed",
        text: "text-amber-800",
      }
    : {
        wrapper: "border-red-200 bg-red-50",
        icon: "text-red-700",
        title: "Action needed",
        text: "text-red-800",
      };

  return (
    <div className="shrink-0 border-t border-slate-100 bg-white p-3">
      <div className={`rounded-xl border px-3 py-2.5 ${tone.wrapper}`}>
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/80">
            {isAiInfo ? (
              <Sparkles className={`h-3.5 w-3.5 ${tone.icon}`} />
            ) : (
              <CheckSquare className={`h-3.5 w-3.5 ${tone.icon}`} />
            )}
          </div>

          <div className="min-w-0">
            <p className={`text-[10px] font-bold ${tone.text}`}>
              {tone.title}
            </p>

            <p className={`mt-0.5 text-[10px] leading-relaxed ${tone.text}`}>
              {saveMessage}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
function PlaybackCard({ icon: Icon, label, value, detail, hasAlert }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${
          hasAlert
            ? "bg-red-50 text-red-600 border-red-200"
            : "bg-blue-50 text-blue-700 border-blue-100"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      <div className="min-w-0 space-y-0.5">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block truncate">
          {label}
        </span>

        <p
          className={`text-sm font-mono font-black ${
            hasAlert ? "text-red-600" : "text-slate-800"
          }`}
        >
          {value}
        </p>

        {detail && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

export default SubmissionDetails;
