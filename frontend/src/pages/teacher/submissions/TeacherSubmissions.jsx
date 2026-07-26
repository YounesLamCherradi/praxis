import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  CheckCircle2,
  CheckSquare,
  Printer,
  ClipboardList,
  MessageSquare,
  Bot,
  Activity,
  Highlighter,
  BookOpen,
  ShieldCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
  X,
  XCircle,
  ChevronDown,
} from "lucide-react";
import { getSubmissionDetails } from "../../../services/teacherApi";

import { useTeacherWorkspace } from "../../../hooks/useTeacherWorkspace";
import { getPraxisData } from "../../../services/praxisMockStore";
import SubmissionDetails from "./SubmissionDetails";

// --- Static Helpers Outside Component Lifecycle ---

function normalizeStatus(status) {
  const value = String(status || "Not Started").toLowerCase();
  if (value === "graded") return "Graded";
  if (value === "submitted") return "Submitted";
  if (value === "late") return "Late";
  if (value === "missing") return "Missing";
  if (value === "reopened") return "Reopened";
  if (value === "draft") return "In Progress";
  return "Not Started";
}

function getStatusStyles(status) {
  const normalized = normalizeStatus(status);
  switch (normalized) {
    case "Graded": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Submitted": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Late": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Missing": return "bg-red-50 text-red-700 border-red-200";
    case "Reopened": return "bg-sky-50 text-sky-700 border-sky-200";
    case "In Progress": return "bg-purple-50 text-purple-700 border-purple-200";
    default: return "bg-slate-50 text-slate-500 border-slate-200";
  }
}

function sameClass(enrollment, assignment) {
  const sameClassId = enrollment.classId && assignment.classId && String(enrollment.classId) === String(assignment.classId);
  const sameClassCode = enrollment.classCode?.toUpperCase() === assignment.classCode?.toUpperCase();
  return sameClassId || sameClassCode;
}

function assignmentMatchesClass(assignment, cls) {
  if (!assignment || !cls) return false;
  const sameClassId = assignment.classId && cls.id && String(assignment.classId) === String(cls.id);
  const sameClassCode = assignment.classCode?.toUpperCase() === cls.code?.toUpperCase();
  return sameClassId || sameClassCode;
}

function getSubmissionTime(submission) {
  return new Date(
    submission?.resubmittedAt ||
      submission?.submittedAt ||
      submission?.updatedAt ||
      submission?.savedAt ||
      submission?.createdAt ||
      0
  ).getTime();
}

function getReadableDate(submission) {
  const value = submission?.resubmittedAt || submission?.submittedAt || null;
  if (!value) return " - ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeSubmissionSources(primary = [], secondary = []) {
  const merged = new Map();

  safeArray(secondary).forEach((submission, index) => {
    const key = String(
      submission?.id ||
        [
          submission?.assignmentId || "assignment",
          submission?.studentEmail || "student",
          submission?.attemptNumber || index,
        ].join("::")
    );

    merged.set(key, submission);
  });

  safeArray(primary).forEach((submission, index) => {
    const key = String(
      submission?.id ||
        [
          submission?.assignmentId || "assignment",
          submission?.studentEmail || "student",
          submission?.attemptNumber || index,
        ].join("::")
    );

    const previous = merged.get(key) || {};

    merged.set(key, {
      ...previous,
      ...submission,
    });
  });

  return Array.from(merged.values());
}

function getSubmissionText(submission) {
  return String(
    submission?.submittedText ||
      submission?.submissionText ||
      ""
  ).trim();
}

function hasSubmissionEvidence(submission) {
  const submittedTimestamp =
    submission?.submittedAt ||
    submission?.resubmittedAt ||
    null;
  return Boolean(submittedTimestamp && getSubmissionText(submission));
}

const QUICK_STATUS_CONTROLS = [
  {
    label: "Submitted",
    value: "Submitted",
    icon: CheckCircle2,
    requireText: true,
  },
  {
    label: "Late",
    value: "Late",
    icon: Clock,
    requireText: true,
  },
  {
    label: "Missing",
    value: "Missing",
    icon: XCircle,
    requireText: false,
  },
  {
    label: "Reopen",
    value: "Reopened",
    icon: RotateCcw,
    requireText: true,
  },
];

function CompactStatusActions({
  selectedItem,
  selectedSubmission,
  onChangeStatus,
}) {
  const submission =
    selectedSubmission ||
    selectedItem?.submission ||
    null;

  const submissionText =
    getSubmissionText(submission);
  const hasRealSubmission = Boolean(
    submissionText
  );
  const currentStatus =
    normalizeStatus(
      submission?.status ||
      selectedItem?.status
    );

  const isCurrentAttempt =
    submission?.isCurrent !== false;

  const activeStyles = {
    Submitted:
      "border-emerald-300 bg-emerald-50 text-emerald-800 shadow-sm",
    Late:
      "border-amber-300 bg-amber-50 text-amber-800 shadow-sm",
    Missing:
      "border-red-300 bg-red-50 text-red-800 shadow-sm",
    Reopened:
      "border-blue-300 bg-blue-50 text-blue-800 shadow-sm",
  };

  return (
    <div className="grid h-10 shrink-0 grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {QUICK_STATUS_CONTROLS.map((control) => {
        const Icon = control.icon;
        const isActive = currentStatus === control.value;

        const isDisabled =
          !isCurrentAttempt ||
          (control.value === "Missing"
            ? hasRealSubmission
            : control.value === "Reopened"
            ? !hasRealSubmission ||
              !["Submitted", "Late", "Graded"].includes(
                currentStatus
              )
            : !hasRealSubmission);

        return (
          <button
            key={control.value}
            type="button"
            disabled={isDisabled}
            aria-pressed={isActive}
            onClick={() => {
              if (!isDisabled && !isActive) {
                onChangeStatus(control.value);
              }
            }}
            className={`inline-flex h-8 w-[72px] items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-2 text-[10px] font-bold leading-none transition-colors ${
              isActive
                ? activeStyles[control.value]
                : "border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900"
            } ${
              isDisabled
                ? "cursor-not-allowed opacity-30"
                : isActive
                ? "cursor-default"
                : "cursor-pointer"
            }`}
            title={
              isActive
                ? `${control.label} is the current status`
                : isDisabled
                ? !isCurrentAttempt
                  ? "Previous attempts are read-only. Change the current attempt instead."
                  : control.value === "Missing"
                  ? "Missing is only available when no submitted text exists"
                  : control.value === "Reopened"
                  ? "Reopen is available for the current submitted, late, or graded attempt"
                  : `${control.label} requires an actual student submission with text`
                : `Mark submission as ${control.label}`
            }
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span>{control.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isPasteLikeEvent(event = {}) {
  const type = String(
    event.type ||
      event.eventType ||
      event.action ||
      event.kind ||
      ""
  ).toLowerCase();

  const group = String(
    event.eventGroup ||
      event.group ||
      ""
  ).toLowerCase();

  return type.includes("paste") || group === "paste";
}

function getPasteReplayEvents(source = {}) {
  const copyPasteLogs = safeArray(source.copyPasteLogs);

  if (copyPasteLogs.length > 0) {
    return copyPasteLogs;
  }

  let replayEvents = safeArray(source.writingReplayEvents);

  if (replayEvents.length === 0) {
    replayEvents = safeArray(source.writingReplay);
  }

  if (replayEvents.length === 0) {
    replayEvents = safeArray(source.writingEvents);
  }

  return replayEvents.filter(isPasteLikeEvent);
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

function buildAiRevisionSummary(issueCount = 0) {
  if (!issueCount) {
    return "";
  }

  return `AI identified ${issueCount} revision point${issueCount === 1 ? "" : "s"}.`;
}

function getGradeSheetAiFeedbackStructured(item = {}) {
  const directIssues = safeArray(item.issues);
  const directSummaryRaw = String(item.overall || item.summary || "").trim();
  const directSummaryFallback = buildAiRevisionSummary(directIssues.length);

  const directSummary =
    directSummaryFallback &&
    (
      !directSummaryRaw ||
      !!tryParseJsonPayload(directSummaryRaw) ||
      looksLikeStructuredJsonText(directSummaryRaw)
    )
      ? directSummaryFallback
      : directSummaryRaw;

  const direct = {
    summary: directSummary,
    strengths: safeArray(item.strengths),
    issues: directIssues,
    nextSteps: safeArray(item.nextSteps),
  };

  if (
    direct.summary ||
    direct.strengths.length > 0 ||
    direct.issues.length > 0 ||
    direct.nextSteps.length > 0
  ) {
    return direct;
  }

  const rawText = String(
    item.rawText ||
      item.feedback ||
      item.response ||
      item.content ||
      item.message ||
      item.aiResponse ||
      ""
  ).trim();

  const parsed = tryParseJsonPayload(rawText);

  if (!parsed) {
    return {
      summary: rawText,
      strengths: [],
      issues: [],
      nextSteps: [],
    };
  }

  if (Array.isArray(parsed)) {
    return {
      summary: buildAiRevisionSummary(parsed.length),
      strengths: [],
      issues: parsed,
      nextSteps: [],
    };
  }

  const nested =
    (parsed.review && typeof parsed.review === "object" && parsed.review) ||
    (parsed.feedback && typeof parsed.feedback === "object" && parsed.feedback) ||
    (parsed.response && typeof parsed.response === "object" && parsed.response) ||
    parsed;

  const issues = safeArray(
    nested.issues || nested.improvements || nested.areasToImprove || nested.items
  );

  const nestedSummaryRaw = String(
    nested.overall ||
      nested.summary ||
      nested.overallFeedback ||
      nested.feedbackSummary ||
      ""
  ).trim();

  const nestedSummaryFallback = buildAiRevisionSummary(issues.length);

  const summary =
    nestedSummaryFallback &&
    (
      !nestedSummaryRaw ||
      !!tryParseJsonPayload(nestedSummaryRaw) ||
      looksLikeStructuredJsonText(nestedSummaryRaw)
    )
      ? nestedSummaryFallback
      : nestedSummaryRaw;

  return {
    summary,
    strengths: safeArray(nested.strengths || nested.positivePoints),
    issues,
    nextSteps: safeArray(nested.nextSteps || nested.recommendations || nested.actionItems),
  };
}

function formatGradeSheetDate(value) {
  if (!value) return " - ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getMessageRole(message = {}) {
  const role = String(
    message.role || message.sender || message.author || message.type || ""
  ).toLowerCase();
  return role.includes("assistant") || role.includes("coach") || role.includes("ai")
    ? "Coach"
    : "Student";
}

function getMessageText(message = {}) {
  return (
    message.content ||
    message.text ||
    message.message ||
    message.response ||
    message.feedback ||
    ""
  );
}


function countGradeSheetWords(text = "") {
  const value = String(text || "").trim();
  return value
    ? value.split(/\s+/).filter(Boolean).length
    : 0;
}

function hasGradeSheetValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== ""
  );
}

function formatGradeSheetScore(score, maximum) {
  if (!hasGradeSheetValue(score)) {
    return "Not graded";
  }

  if (!hasGradeSheetValue(maximum)) {
    return String(score);
  }

  return `${score} / ${maximum}`;
}

function buildSelfAssessmentLabel(data = {}) {
  if (data.selfAssessmentSummary) {
    return data.selfAssessmentSummary;
  }

  const score = data.selfAssessmentScore;
  const maximum = data.selfAssessmentMax;
  const percentage = data.selfAssessmentPercentage;

  if (!hasGradeSheetValue(score)) {
    return "Not completed";
  }

  const scoreText =
    formatGradeSheetScore(
      score,
      maximum
    );

  return hasGradeSheetValue(percentage)
    ? `${scoreText} · ${percentage}%`
    : scoreText;
}

function getGradeSheetAiFeedbackText(item = {}) {
  const structured = getGradeSheetAiFeedbackStructured(item);
  return String(structured.summary || "").trim();
}

// ... Keep other static grade sheet helpers exactly as they are ...
function getGradeSheetEventType(event = {}) {
  return String(
    event.type ||
      event.eventType ||
      event.action ||
      event.kind ||
      "Writing event"
  );
}

function getGradeSheetEventSummary(event = {}) {
  return String(
    event.summary ||
      event.description ||
      event.preview ||
      event.text ||
      event.content ||
      event.insertedText ||
      event.deletedText ||
      "Recorded writing activity"
  );
}

function GradeSheetModal({ open, onClose, data }) {
  if (!open || !data) return null;

  const submission =
    data.submission || {};

  const criteria =
    safeArray(data.rubricCriteria);

  const planningMessages =
    safeArray(data.planningChatMessages);

  const aiFeedback =
    safeArray(data.studentAiFeedbackHistory);

  const replayEvents =
    getPasteReplayEvents(data);

  const writingEvents =
    safeArray(data.writingEvents);

  const annotations =
    safeArray(data.annotations);

  const finalText =
    getSubmissionText(submission);

  const finalScore =
    hasGradeSheetValue(data.finalScore)
      ? data.finalScore
      : null;

  const rubricTotal =
    hasGradeSheetValue(data.rubricTotal)
      ? data.rubricTotal
      : null;

  const finalGradeLabel =
    formatGradeSheetScore(
      finalScore,
      rubricTotal
    );

  const selfAssessmentLabel =
    buildSelfAssessmentLabel(
      data
    );

  const totalEditingEvents =
    replayEvents.length;

  const insertionCount =
    replayEvents.filter((event) =>
      getGradeSheetEventType(event)
        .toLowerCase()
        .includes("insert")
    ).length;

  const deletionCount =
    replayEvents.filter((event) =>
      getGradeSheetEventType(event)
        .toLowerCase()
        .includes("delet")
    ).length;

  const feedbackChecksUsed =
    Math.max(
      Number(
        data.feedbackChecksUsed || 0
      ),
      aiFeedback.length
    );

  const planningCount =
    planningMessages.length;

  const replayCount =
    replayEvents.length;

  const annotationCount =
    annotations.length;

  const gradedCriteriaCount =
    Number(
      data.gradedCriteriaCount || 0
    );

  const integrityFlagCount =
    Number(
      data.integrityFlagCount || 0
    );

  const rubricMetric =
    criteria.length > 0
      ? `${gradedCriteriaCount}/${criteria.length}`
      : "No rubric";

  const integrityMetric =
    integrityFlagCount > 0
      ? `${integrityFlagCount} flag${
          integrityFlagCount === 1
            ? ""
            : "s"
        }`
      : "Clean";

  const wordCount =
    Number(data.wordCount) ||
    countGradeSheetWords(
      finalText
    );

  const generatedAt =
    data.generatedAt ||
    new Date().toISOString();

  const status =
    normalizeStatus(
      data.status
    );

  const hasTeacherSummary =
    hasGradeSheetValue(
      finalScore
    ) ||
    Boolean(
      String(
        data.feedback || ""
      ).trim()
    );

  return createPortal(
    <div
      id="praxis-grade-sheet-print-root"
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm print:static print:block print:bg-white print:p-0"
      onClick={(event) => event.stopPropagation()}
    >
      <style>{`
        @media print {
          body > *:not(#praxis-grade-sheet-print-root) {
            display: none !important;
          }

          #praxis-grade-sheet-print-root {
            display: block !important;
            position: static !important;
            inset: auto !important;
            background: white !important;
            padding: 0 !important;
          }

          #praxis-grade-sheet-print-root .grade-sheet-shell {
            width: 100% !important;
            max-width: none !important;
            height: auto !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
            border: 0 !important;
          }

          #praxis-grade-sheet-print-root .grade-sheet-scroll {
            overflow: visible !important;
          }

          #praxis-grade-sheet-print-root .grade-sheet-actions {
            display: none !important;
          }

          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `}</style>

      <div className="grade-sheet-shell flex h-[96vh] w-[min(96vw,1380px)] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#F6F8FC] shadow-2xl">
        <div className="grade-sheet-actions flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3">
          <div>
            <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-blue-700">
              Praxis assessment report
            </p>

            <h2 className="font-serif text-xl font-bold text-slate-950">
              Student Grade Sheet
            </h2>
          </div>

          <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <button
              type="button"
              onClick={() =>
                window.print()
              }
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              Print / Save as PDF
            </button>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grade-sheet-scroll flex-1 overflow-y-auto p-4 sm:p-6">
          <article className="mx-auto max-w-[1180px] space-y-5">
            <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
              <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.5fr_1fr] lg:px-8">
                <div>
                  <p className="font-mono text-[10px] font-black uppercase tracking-[0.22em] text-blue-300">
                    Student grade sheet
                  </p>

                  <h1 className="mt-2 font-serif text-3xl font-bold leading-tight">
                    {data.assignmentTitle ||
                      "Assignment"}
                  </h1>

                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
                    A consolidated report for the selected student submission attempt.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Student
                    </p>

                    <p className="mt-1 font-bold">
                      {data.studentName ||
                        "Student"}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-slate-400">
                      {data.studentEmail ||
                        " - "}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Attempt
                    </p>

                    <p className="mt-1 font-bold">
                      Attempt{" "}
                      {Number(
                        data.attemptNumber ||
                          1
                      )}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      {data.isCurrent
                        ? "Current submission"
                        : "Previous submission"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Submitted
                    </p>

                    <p className="mt-1 text-xs font-bold">
                      {formatGradeSheetDate(
                        data.submittedAt
                      )}
                    </p>

                    {data.reviewedAt && (
                      <p className="mt-1 text-[10px] text-slate-400">
                        Reviewed:{" "}
                        {formatGradeSheetDate(
                          data.reviewedAt
                        )}
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Status
                    </p>

                    <p className="mt-1 font-bold">
                      {status}
                    </p>

                    <p className="mt-0.5 text-xs text-slate-400">
                      Deadline:{" "}
                      {formatGradeSheetDate(
                        data.deadline
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </header>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-8">
              {[
                [
                  "Final grade",
                  finalGradeLabel,
                  BarChart3,
                  "text-blue-700 bg-blue-50 border-blue-200",
                ],
                [
                  "Self grade",
                  selfAssessmentLabel,
                  CheckSquare,
                  "text-indigo-700 bg-indigo-50 border-indigo-200",
                ],
                [
                  "Rubric",
                  rubricMetric,
                  ClipboardList,
                  "text-emerald-700 bg-emerald-50 border-emerald-200",
                ],
                [
                  "Integrity",
                  integrityMetric,
                  ShieldCheck,
                  integrityFlagCount
                    ? "text-red-700 bg-red-50 border-red-200"
                    : "text-emerald-700 bg-emerald-50 border-emerald-200",
                ],
                [
                  "AI checks",
                  String(
                    feedbackChecksUsed
                  ),
                  Bot,
                  "text-violet-700 bg-violet-50 border-violet-200",
                ],
                [
                  "Planning",
                  `${planningCount} message${
                    planningCount === 1
                      ? ""
                      : "s"
                  }`,
                  MessageSquare,
                  "text-sky-700 bg-sky-50 border-sky-200",
                ],
                [
                  "Replay",
                  `${replayCount} event${
                    replayCount === 1
                      ? ""
                      : "s"
                  }`,
                  Activity,
                  "text-amber-700 bg-amber-50 border-amber-200",
                ],
                [
                  "Marks",
                  String(
                    annotationCount
                  ),
                  Highlighter,
                  "text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200",
                ],
              ].map(
                ([
                  label,
                  value,
                  Icon,
                  tone,
                ]) => (
                  <div
                    key={label}
                    className={`rounded-2xl border p-3 ${tone}`}
                  >
                    <Icon className="h-4 w-4" />

                    <p className="mt-3 font-mono text-[9px] font-black uppercase tracking-wider opacity-70">
                      {label}
                    </p>

                    <p className="mt-1 break-words text-sm font-black">
                      {value}
                    </p>
                  </div>
                )
              )}
            </section>

            {(data.assignmentInstructions ||
              hasTeacherSummary) && (
              <section className="grid gap-4 lg:grid-cols-2">
                {data.assignmentInstructions && (
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-700" />

                      <h3 className="font-serif text-lg font-bold text-slate-950">
                        Assignment
                      </h3>
                    </div>

                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {
                        data.assignmentInstructions
                      }
                    </p>
                  </div>
                )}

                <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-blue-700" />

                      <h3 className="font-serif text-lg font-bold text-slate-950">
                        Instructor grade summary
                      </h3>
                    </div>

                    <span className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-black text-white">
                      {finalGradeLabel}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {String(
                      data.feedback || ""
                    ).trim() ||
                      "No overall instructor feedback has been added yet."}
                  </p>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-700" />

                  <div>
                    <h3 className="font-serif text-lg font-bold text-slate-950">
                      Rubric breakdown
                    </h3>

                    <p className="text-xs text-slate-500">
                      {data.rubricTitle ||
                        "No rubric title"}
                    </p>
                  </div>
                </div>

                <span className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-black text-blue-800">
                  {finalGradeLabel}
                </span>
              </div>

              {criteria.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  No rubric criteria are attached.
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                  <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_110px] gap-4 bg-slate-50 px-4 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-slate-400 md:grid">
                    <span>Criterion</span>
                    <span>
                      Selected band and evidence
                    </span>
                    <span className="text-right">
                      Score
                    </span>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {criteria.map(
                      (
                        criterion,
                        index
                      ) => {
                        const entry =
                          criterion.scoreEntry ||
                          {};

                        const criterionMaximum =
                          criterion.points ??
                          criterion.maxPoints ??
                          entry.maxPoints ??
                          null;

                        const criterionScore =
                          hasGradeSheetValue(
                            entry.score
                          )
                            ? entry.score
                            : null;

                        return (
                          <div
                            key={
                              criterion.reportKey ||
                              `${criterion.id || "criterion"}::${index}`
                            }
                            className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_110px] md:gap-4"
                          >
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                {
                                  criterion.name
                                }
                              </p>

                              {criterion.description && (
                                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                                  {
                                    criterion.description
                                  }
                                </p>
                              )}
                            </div>

                            <div>
                              <span className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                                {entry.bandLabel ||
                                  "Not selected"}
                              </span>

                              {(entry.comment ||
                                entry.selectedBandDescription) && (
                                <p className="mt-2 text-[11px] leading-5 text-slate-600">
                                  {entry.comment ||
                                    entry.selectedBandDescription}
                                </p>
                              )}
                            </div>

                            <p className="text-right font-mono text-base font-black text-slate-950">
                              {formatGradeSheetScore(
                                criterionScore,
                                criterionMaximum
                              )}
                            </p>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-sky-700" />

                    <h3 className="font-serif text-lg font-bold text-slate-950">
                      Planning conversation
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-slate-400">
                    {planningCount} message
                    {planningCount === 1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {planningMessages.length ===
                  0 ? (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      No planning conversation was recorded.
                    </p>
                  ) : (
                    planningMessages.map(
                      (
                        message,
                        index
                      ) => {
                        const role =
                          getMessageRole(
                            message
                          );

                        return (
                          <div
                            key={
                              message.id ||
                              index
                            }
                            className={`rounded-2xl border p-3 ${
                              role ===
                              "Coach"
                                ? "border-violet-200 bg-violet-50"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <p
                              className={`font-mono text-[9px] font-black uppercase tracking-wider ${
                                role ===
                                "Coach"
                                  ? "text-violet-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {role}
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {
                                getMessageText(
                                  message
                                )
                              }
                            </p>
                          </div>
                        );
                      }
                    )
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-violet-700" />

                    <h3 className="font-serif text-lg font-bold text-slate-950">
                      Student AI draft checks
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-violet-500">
                    {aiFeedback.length} record
                    {aiFeedback.length === 1
                      ? ""
                      : "s"}
                  </span>
                </div>

                <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {aiFeedback.length === 0 ? (
                    <p className="rounded-2xl bg-violet-50 p-4 text-sm text-violet-700">
                      No student AI feedback record was found.
                    </p>
                  ) : (
                    aiFeedback.map(
                      (item, index) => {
                        const feedbackText =
                          getGradeSheetAiFeedbackText(
                            item
                          );

                        const structuredFeedback =
                          getGradeSheetAiFeedbackStructured(item);

                        const strengths =
                          safeArray(
                            structuredFeedback.strengths
                          );

                        const issues =
                          safeArray(
                            structuredFeedback.issues
                          );

                        const nextSteps =
                          safeArray(
                            structuredFeedback.nextSteps
                          );

                        return (
                          <div
                            key={
                              item.id ||
                              index
                            }
                            className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-black text-violet-900">
                                Feedback check #
                                {index + 1}
                              </p>

                              <span className="font-mono text-[10px] text-violet-500">
                                {formatGradeSheetDate(
                                  item.createdAt ||
                                    item.timestamp ||
                                    item.date
                                )}
                              </span>
                            </div>

                            {(item.draft ||
                              item.draftText ||
                              item.beforeText) && (
                              <div className="mt-3">
                                <p className="font-mono text-[9px] font-black uppercase text-slate-400">
                                  Draft
                                </p>

                                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-xs leading-5 text-slate-600">
                                  {item.draft ||
                                    item.draftText ||
                                    item.beforeText}
                                </p>
                              </div>
                            )}

                            <div className="mt-3">
                              <p className="font-mono text-[9px] font-black uppercase text-violet-600">
                                AI feedback
                              </p>

                              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                                {feedbackText ||
                                  "No readable AI response was stored for this check."}
                              </p>
                            </div>

                            {(strengths.length > 0 ||
                              issues.length > 0 ||
                              nextSteps.length > 0) && (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
                                  {
                                    strengths.length
                                  }{" "}
                                  strengths
                                </span>

                                <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-1 text-[9px] font-bold text-orange-700">
                                  {
                                    issues.length
                                  }{" "}
                                  issues
                                </span>

                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[9px] font-bold text-blue-700">
                                  {
                                    nextSteps.length
                                  }{" "}
                                  next steps
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      }
                    )
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-amber-700" />

                <h3 className="font-serif text-lg font-bold text-slate-950">
                  Writing behaviour & replay
                </h3>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  [
                    "Insertions",
                    insertionCount,
                  ],
                  [
                    "Deletions",
                    deletionCount,
                  ],
                  [
                    "Paste attempts",
                    Number(
                      data.pasteAttemptCount ||
                        0
                    ),
                  ],
                  [
                    "Focus loss",
                    Number(
                      data.focusLossCount ||
                        0
                    ),
                  ],
                  [
                    "AI / external flags",
                    Number(
                      data.aiFlagCount ||
                        0
                    ),
                  ],
                  [
                    "Editing events",
                    totalEditingEvents,
                  ],
                ].map(
                  ([label, value]) => (
                    <div
                      key={label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <p className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                        {label}
                      </p>

                      <p className="mt-2 text-xl font-black text-slate-900">
                        {value}
                      </p>
                    </div>
                  )
                )}
              </div>

              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
                <div className="grid grid-cols-[150px_140px_1fr] gap-3 bg-slate-50 px-4 py-2 font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                  <span>Time</span>
                  <span>Event</span>
                  <span>Summary</span>
                </div>

                <div className="max-h-[300px] divide-y divide-slate-100 overflow-y-auto">
                  {replayEvents.length === 0 ? (
                    <p className="p-4 text-sm text-slate-500">
                      No replay events were recorded.
                    </p>
                  ) : (
                    replayEvents
                      .slice(0, 150)
                      .map(
                        (
                          event,
                          index
                        ) => (
                          <div
                            key={
                              event.id ||
                              index
                            }
                            className="grid grid-cols-[150px_140px_1fr] gap-3 px-4 py-3 text-xs"
                          >
                            <span className="font-mono text-slate-400">
                              {formatGradeSheetDate(
                                event.timestamp ||
                                  event.createdAt ||
                                  event.time
                              )}
                            </span>

                            <span className="font-bold text-slate-700">
                              {
                                getGradeSheetEventType(
                                  event
                                )
                              }
                            </span>

                            <span className="text-slate-600">
                              {
                                getGradeSheetEventSummary(
                                  event
                                )
                              }
                            </span>
                          </div>
                        )
                      )
                  )}
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-700" />

                    <h3 className="font-serif text-lg font-bold text-slate-950">
                      Final submission
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-slate-400">
                    {wordCount} words
                  </span>
                </div>

                <div className="mt-4 min-h-[240px] whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 font-mono text-[13px] leading-7 text-slate-700">
                  {finalText ||
                    "No final submission text is available."}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Highlighter className="h-4 w-4 text-fuchsia-700" />

                    <h3 className="font-serif text-lg font-bold text-slate-950">
                      Instructor annotations
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-slate-400">
                    {annotationCount}
                  </span>
                </div>

                <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                  {annotations.length === 0 ? (
                    <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
                      No instructor annotations were added.
                    </p>
                  ) : (
                    annotations.map(
                      (
                        annotation,
                        index
                      ) => (
                        <div
                          key={
                            annotation.id ||
                            index
                          }
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 font-mono text-[10px] font-black text-amber-700">
                              {annotation.code ||
                                annotation.type ||
                                "NOTE"}{" "}
                              {index + 1}
                            </span>

                            <span className="text-[10px] text-slate-400">
                              {formatGradeSheetDate(
                                annotation.createdAt
                              )}
                            </span>
                          </div>

                          <p className="mt-3 font-mono text-[9px] font-black uppercase text-slate-400">
                            Selected text
                          </p>

                          <p className="mt-1 rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-slate-700">
                            “
                            {annotation.selectedText ||
                              " - "}
                            ”
                          </p>

                          <p className="mt-3 font-mono text-[9px] font-black uppercase text-slate-400">
                            Comment
                          </p>

                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {annotation.comment ||
                              annotation.label ||
                              "No comment"}
                          </p>
                        </div>
                      )
                    )
                  )}
                </div>
              </div>
            </section>

            <footer className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
              <p>
                <span className="font-bold text-slate-700">
                  Generated by Praxis
                </span>{" "}
                · Instructor assessment report
              </p>

              <p className="font-mono">
                Generated{" "}
                {formatGradeSheetDate(
                  generatedAt
                )}
              </p>
            </footer>
          </article>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ... Keep other GradeSheet and Fallback data helper builders exactly as they are ...
function buildFallbackGradeSheetData({
  selectedSubmission,
  selectedAssignment,
  selectedItem,
}) {
  if (!selectedSubmission) {
    return null;
  }

  const assignment =
    selectedAssignment ||
    selectedSubmission.assignment ||
    selectedSubmission.assignmentDetails ||
    {};

  const rubric =
    selectedSubmission.rubricSchema ||
    assignment.rubricSchema ||
    selectedSubmission.rubric ||
    assignment.rubric ||
    null;

  const rubricCriteria =
    safeArray(
      rubric?.criteria
    ).length > 0
      ? safeArray(
          rubric.criteria
        )
      : safeArray(
          selectedSubmission.rubricCriteria
        );

  const rubricScores =
    selectedSubmission.rubricScores ||
    {};

  const dynamicCriteria =
    rubricCriteria.map(
      (criterion, index) => {
        const storedEntry =
          rubricScores?.[
            criterion.id
          ];

        const entry =
          storedEntry &&
          typeof storedEntry ===
            "object"
            ? storedEntry
            : {
                score:
                  storedEntry,
              };

        const selectedBand =
          safeArray(
            criterion.bands
          ).find(
            (band) =>
              String(band.id) ===
              String(
                entry?.bandId || ""
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
              criterion.points ??
              criterion.maxPoints ??
              null,
            bandId:
              entry?.bandId ||
              "",
            bandLabel:
              entry?.bandLabel ||
              selectedBand?.label ||
              "",
            score:
              hasGradeSheetValue(
                entry?.score
              )
                ? Number(
                    entry.score
                  )
                : null,
            comment:
              entry?.comment ||
              "",
            selectedBandDescription:
              selectedBand?.description ||
              "",
          },
        };
      }
    );

  const gradedCriteriaCount =
    dynamicCriteria.filter(
      (criterion) =>
        hasGradeSheetValue(
          criterion.scoreEntry
            ?.score
        )
    ).length;

  const rubricTotalFromCriteria =
    rubricCriteria.reduce(
      (sum, criterion) =>
        sum +
        Number(
          criterion.points ??
            criterion.maxPoints ??
            criterion.weight ??
            0
        ),
      0
    );

  const rubricTotal =
    Number(
      selectedSubmission.rubricTotal ??
        rubric?.totalPoints ??
        rubric?.maxPoints ??
        assignment.rubricTotal ??
        assignment.totalPoints ??
        assignment.maxScore ??
        assignment.pointsPossible ??
        0
    ) ||
    rubricTotalFromCriteria ||
    null;

  const finalScore =
    hasGradeSheetValue(
      selectedSubmission.score
    )
      ? selectedSubmission.score
      : hasGradeSheetValue(
          selectedSubmission.finalScore
        )
      ? selectedSubmission.finalScore
      : null;

  const selfAssessmentScore =
    selectedSubmission.selfRubricTotal ??
    selectedSubmission.selfGradeScore ??
    selectedSubmission.selfAssessmentScore ??
    null;

  const selfAssessmentMax =
    selectedSubmission.selfRubricMax ??
    selectedSubmission.selfGradeMax ??
    rubricTotal ??
    null;

  const selfAssessmentPercentage =
    selectedSubmission.selfRubricPercentage ??
    selectedSubmission.selfGradePercentage ??
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

  const planningChatMessages =
    safeArray(
      selectedSubmission.planningChatMessages
    ).length > 0
      ? safeArray(
          selectedSubmission.planningChatMessages
        )
      : safeArray(
          selectedSubmission.planningChat
        ).length > 0
      ? safeArray(
          selectedSubmission.planningChat
        )
      : safeArray(
          selectedSubmission.chatHistory
        ).length > 0
      ? safeArray(
          selectedSubmission.chatHistory
        )
      : safeArray(
          selectedSubmission.planningCoachHistory
        );

  const studentAiFeedbackHistory =
    safeArray(
      selectedSubmission.studentAiFeedbackHistory
    ).length > 0
      ? safeArray(
          selectedSubmission.studentAiFeedbackHistory
        )
      : safeArray(
          selectedSubmission.aiFeedbackHistory
        ).length > 0
      ? safeArray(
          selectedSubmission.aiFeedbackHistory
        )
      : safeArray(
          selectedSubmission.draftFeedbackHistory
        );

  const writingReplayEvents =
    getPasteReplayEvents(selectedSubmission);

  const writingEvents =
    safeArray(selectedSubmission.writingEvents);

  const copyPasteLogs =
    safeArray(
      selectedSubmission.copyPasteLogs
    );

  const focusLossLogs =
    safeArray(
      selectedSubmission.focusLossLogs
    );

  const integrityLogs =
    safeArray(
      selectedSubmission.integrityLogs
    );

  const pasteAttemptCount =
    Number(
      selectedSubmission.pasteAttemptCount ??
        copyPasteLogs.length
    );

  const focusLossCount =
    Number(
      selectedSubmission.focusLossCount ??
        focusLossLogs.length
    );

  const aiFlagCount =
    Number(
      selectedSubmission.aiFlags ??
        selectedSubmission.aiFlagCount ??
        0
    );

  const integrityFlagCount =
    Number(
      selectedSubmission.integrityFlagCount ??
        pasteAttemptCount +
          focusLossCount +
          aiFlagCount
    );

  const feedbackChecksUsed =
    Math.max(
      Number(
        selectedSubmission.feedbackChecksUsed ||
          0
      ),
      studentAiFeedbackHistory.length
    );

  const finalText =
    getSubmissionText(
      selectedSubmission
    );

  return {
    assignmentTitle:
      assignment.title ||
      selectedSubmission.assignmentTitle ||
      "Assignment",

    assignmentInstructions:
      assignment.instructions ||
      assignment.description ||
      assignment.prompt ||
      selectedSubmission.instructions ||
      selectedSubmission.assignmentPrompt ||
      "",

    studentName:
      selectedSubmission.studentName ||
      selectedItem?.studentName ||
      "Student",

    studentEmail:
      selectedSubmission.studentEmail ||
      selectedItem?.studentEmail ||
      "",

    status:
      normalizeStatus(
        selectedSubmission.status
      ),

    submittedAt:
      selectedSubmission.resubmittedAt ||
      selectedSubmission.submittedAt ||
      selectedSubmission.createdAt ||
      null,

    reviewedAt:
      selectedSubmission.reviewedAt ||
      null,

    deadline:
      assignment.dueDate ||
      assignment.deadline ||
      assignment.dueAt ||
      selectedSubmission.dueDate ||
      null,

    attemptNumber:
      Number(
        selectedSubmission.attemptNumber ||
          1
      ),

    isCurrent:
      selectedSubmission.isCurrent !==
      false,

    submission: {
      ...selectedSubmission,
      content:
        finalText,
      finalText,
      submittedText:
        finalText,
      text:
        finalText,
    },

    wordCount:
      Number(
        selectedSubmission.wordCount
      ) ||
      countGradeSheetWords(
        finalText
      ),

    finalScore,
    rubricTotal,

    rubricTitle:
      rubric?.title ||
      selectedSubmission.rubricTitle ||
      "Rubric",

    rubricCriteria:
      dynamicCriteria,

    rubricScores,

    gradedCriteriaCount,

    feedback:
      selectedSubmission.feedback ||
      "",

    selfAssessmentScore,
    selfAssessmentMax,
    selfAssessmentPercentage,

    selfAssessmentSummary:
      hasGradeSheetValue(
        selfAssessmentScore
      )
        ? `${formatGradeSheetScore(
            selfAssessmentScore,
            selfAssessmentMax
          )}${
            hasGradeSheetValue(
              selfAssessmentPercentage
            )
              ? ` · ${selfAssessmentPercentage}%`
              : ""
          }`
        : null,

    planningChatMessages,
    studentAiFeedbackHistory,
    writingReplayEvents,
    writingEvents,

    annotations:
      safeArray(
        selectedSubmission.annotations
      ),

    copyPasteLogs,
    focusLossLogs,
    integrityLogs,

    pasteAttemptCount,
    focusLossCount,
    aiFlagCount,
    integrityFlagCount,
    feedbackChecksUsed,

    honorConfirmed:
      Boolean(
        selectedSubmission.honorConfirmed
      ),

    generatedAt:
      new Date().toISOString(),
  };
}

function getReviewRubricSummary(submission, assignment) {
  const rubric =
    submission?.rubricSchema ||
    assignment?.rubricSchema ||
    submission?.rubric ||
    assignment?.rubric ||
    null;

  const criteria = safeArray(
    rubric?.criteria ||
      submission?.rubricCriteria ||
      assignment?.rubricCriteria
  );

  const total =
    Number(
      rubric?.totalPoints ||
        rubric?.maxPoints ||
        submission?.rubricTotal ||
        assignment?.rubricTotal ||
        0
    ) ||
    criteria.reduce(
      (sum, criterion) =>
        sum +
        Number(
          criterion?.points ??
            criterion?.maxPoints ??
            criterion?.weight ??
            0
        ),
      0
    );

  const scores = submission?.rubricScores || {};

  const gradedCount = criteria.filter((criterion) => {
    const entry = scores?.[criterion.id];

    if (entry && typeof entry === "object") {
      return (
        entry.score !== "" &&
        entry.score !== null &&
        entry.score !== undefined
      );
    }

    return entry !== "" && entry !== null && entry !== undefined;
  }).length;

  const calculatedScore = criteria.reduce((sum, criterion) => {
    const entry = scores?.[criterion.id];

    const value =
      entry && typeof entry === "object"
        ? entry.score
        : entry;

    return sum + Number(value || 0);
  }, 0);

  const savedScore =
    submission?.score !== null &&
    submission?.score !== undefined &&
    submission?.score !== ""
      ? Number(submission.score)
      : null;

  return {
    total,
    criteriaCount: criteria.length,
    gradedCount,
    score:
      gradedCount > 0
        ? calculatedScore
        : savedScore,
  };
}

function getSelfGradeSummary(submission, rubricTotal) {
  const rawScore =
    submission?.selfRubricTotal ??
    submission?.selfGradeScore ??
    submission?.selfAssessment?.score ??
    submission?.selfRubricAssessment?.score ??
    null;

  if (rawScore === null || rawScore === undefined || rawScore === "") {
    return null;
  }

  const score = Number(rawScore);

  const max =
    Number(
      submission?.selfRubricMax ??
        submission?.selfGradeMax ??
        submission?.selfAssessment?.maxScore ??
        rubricTotal ??
        0
    ) || 0;

  const explicitPercentage =
    submission?.selfRubricPercentage ??
    submission?.selfGradePercentage ??
    submission?.selfAssessment?.percentage;

  const percentage =
    explicitPercentage !== null &&
    explicitPercentage !== undefined &&
    explicitPercentage !== ""
      ? Math.round(Number(explicitPercentage))
      : max > 0
      ? Math.round((score / max) * 100)
      : null;

  return {
    score,
    max,
    percentage,
  };
}

function ReviewModalOverlay({
  isOpen,
  onClose,
  selectedItem,
  selectedSubmission,
  selectedAssignment,
  selectedIndex,
  rosterLength,
  selectedAttempts,
  selectedAttemptId,
  setSelectedAttemptId,
  onStatusChange,
  onPrevious,
  onNext,
  onSaveReview,
  submissionForReview,
}) {
  const submissionDetailsRef = useRef(null);
  const [gradeSheetOpen, setGradeSheetOpen] = useState(false);
  const [gradeSheetData, setGradeSheetData] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
    };
  }, [isOpen]);

  if (!isOpen || !selectedItem) return null;

  const submissionText = getSubmissionText(selectedSubmission);
  const rubricSummary = getReviewRubricSummary(
    selectedSubmission,
    selectedAssignment
  );
  const selfGradeSummary = getSelfGradeSummary(
    selectedSubmission,
    rubricSummary.total
  );

  const selectedSubmissionStatus = normalizeStatus(
    selectedSubmission?.status
  );

  const isReopenedAttempt =
    selectedSubmissionStatus === "Reopened";

  const isPreviousAttempt =
    selectedSubmission?.isCurrent === false;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483647] flex h-screen w-screen items-center justify-center overflow-hidden bg-slate-950/40 p-4 backdrop-blur-md sm:p-5"
      onClick={onClose}
    >

      <div
        className="relative z-10 flex h-[94vh] w-[min(96vw,1700px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#FBF9F6] shadow-2xl animate-fade-in-up"
        onClick={(event) => event.stopPropagation()}
      >
        
        {/* TOP COMPACT PROFILE LINE HEADER */}
        <div className="grid shrink-0 grid-cols-1 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          
          <div className="flex min-w-0 items-center gap-4 overflow-hidden xl:flex-nowrap">
            <div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <h3 className="font-serif text-base font-bold text-slate-900 truncate">
                  {selectedItem.studentName}
                </h3>
                <span className={`inline-flex min-w-[76px] items-center justify-center rounded-md border px-2 py-0.5 text-[10px] font-mono font-bold uppercase leading-none ${getStatusStyles(selectedSubmissionStatus)}`}>
                  {selectedSubmissionStatus}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate">
                {selectedItem.studentEmail}
              </p>
            </div>

            <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

            {/* ATTEMPT DROPDOWN SELECTOR */}
            <div className="relative inline-flex items-center">
              <select
                value={selectedAttemptId || ""}
                onChange={(e) => setSelectedAttemptId(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-xl pl-3 pr-8 py-2 focus:outline-none cursor-pointer transition-colors"
              >
                {selectedAttempts.map((attempt) => (
                  <option key={attempt.id} value={attempt.id}>
                    Attempt {attempt.attemptNumber || 1}  -  {normalizeStatus(attempt.status)}
                    {attempt.isCurrent ? " (Current)" : " (Previous)"}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-500 absolute right-2.5 pointer-events-none" />
            </div>

            <div className="h-6 w-[1px] bg-slate-200 hidden lg:block" />

            {/* Assignment- and attempt-specific score summaries */}
            <div className="hidden items-center gap-4 text-xs lg:flex">
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] font-bold uppercase text-slate-400">
                  Self-grade:
                </span>

                {selfGradeSummary ? (
                  <span className="font-mono font-bold text-slate-800">
                    {selfGradeSummary.score} / {selfGradeSummary.max || " - "}
                    {selfGradeSummary.percentage !== null && (
                      <span className="ml-1 font-sans text-[11px] font-normal text-slate-500">
                        ({selfGradeSummary.percentage}%)
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400">
                    Not available
                  </span>
                )}
              </div>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center gap-1.5">
                <span className="font-mono text-[9px] font-bold uppercase text-slate-400">
                  Rubric review:
                </span>

                {rubricSummary.score !== null &&
                rubricSummary.score !== undefined ? (
                  <span className="font-mono font-bold text-indigo-600">
                    {rubricSummary.score} / {rubricSummary.total || " - "}
                    <span className="ml-1 font-sans text-[11px] font-normal text-slate-500">
                      ({rubricSummary.gradedCount}/
                      {rubricSummary.criteriaCount} graded)
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-slate-400">
                    Not graded
                    {rubricSummary.criteriaCount > 0 && (
                      <span className="ml-1 font-normal">
                        (0/{rubricSummary.criteriaCount})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Quick Right Side Window Actions & Page Turning Carousel */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={
                !selectedSubmission ||
                !submissionText ||
                isReopenedAttempt ||
                isPreviousAttempt
              }
              onClick={() =>
                submissionDetailsRef.current?.saveReview()
              }
              className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-3.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
              title={
                isPreviousAttempt
                  ? "Previous attempts are read-only"
                  : isReopenedAttempt
                  ? "The student must resubmit this reopened attempt before a new review can be saved"
                  : "Save the current grade, feedback, annotations, and review"
              }
            >
              <CheckSquare className="h-4 w-4" />
              <span>
                {isPreviousAttempt
                  ? "Previous Attempt"
                  : isReopenedAttempt
                  ? "Awaiting Resubmission"
                  : "Save Review"}
              </span>
            </button>

            <button
              type="button"
              disabled={!selectedSubmission}
              onClick={() => {
                const liveReport =
                  submissionDetailsRef.current?.getGradeSheetData?.();

                const report =
                  liveReport ||
                  buildFallbackGradeSheetData({
                    selectedSubmission,
                    selectedAssignment,
                    selectedItem,
                  });

                if (!report) return;

                setGradeSheetData(report);
                setGradeSheetOpen(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-xs font-bold text-blue-800 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
              title="Open a detailed grade sheet for this student"
            >
              <Printer className="h-4 w-4" />
              <span>View Grade Sheet</span>
            </button>

            <div className="hidden md:block">
              <CompactStatusActions
                selectedItem={selectedItem}
                selectedSubmission={selectedSubmission}
                onChangeStatus={onStatusChange}
              />
            </div>

            <div className="h-6 w-[1px] bg-slate-200 hidden md:block" />

            <div className="flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                disabled={selectedIndex <= 0}
                onClick={onPrevious}
                className="p-1.5 rounded-lg bg-white border border-slate-200/40 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-500 px-2 min-w-[55px] text-center">
                {selectedIndex + 1} / {rosterLength}
              </span>
              <button
                type="button"
                disabled={selectedIndex >= rosterLength - 1}
                onClick={onNext}
                className="p-1.5 rounded-lg bg-white border border-slate-200/40 text-slate-700 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              title="Close Workspace"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Pane Viewport area */}
        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
          <div className="block md:hidden bg-white border border-slate-200 p-2.5 rounded-xl mb-3">
            <p className="text-[10px] font-mono font-bold uppercase text-slate-400 mb-1.5">Quick Status</p>
            <CompactStatusActions
                selectedItem={selectedItem}
                selectedSubmission={selectedSubmission}
                onChangeStatus={onStatusChange}
              />
          </div>

          {isReopenedAttempt && (
            <div className="mb-3 flex shrink-0 items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-200 bg-white text-sky-700">
                <RotateCcw className="h-4 w-4" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-bold">
                  Assignment reopened for revision
                </p>

                <p className="mt-0.5 text-[11px] leading-5 text-sky-800">
                  The student can access Steps 1–4 with the previous chat,
                  draft, and AI checks preserved. A new instructor review can
                  only be saved after the student resubmits this attempt.
                </p>
              </div>
            </div>
          )}

          {selectedSubmission?.isCurrent === false && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-3 shrink-0 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You are viewing a previous submission attempt.</span>
            </div>
          )}

          {!submissionText ? (
            <div className="h-full bg-white border border-slate-200 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-slate-900">
                No submission text available
              </h3>

              <p className="mt-1 max-w-md text-sm text-slate-400">
                {normalizeStatus(selectedSubmission?.status) === "Submitted"
                  ? "This record was marked Submitted without any student text. It is an old empty placeholder, not a real submission. Mark it Missing or delete/reset the placeholder, then submit the assignment from the student account."
                  : "This student has not submitted text for this assignment yet. Only Missing can be set before a real student submission exists."}
              </p>
            </div>
          ) : (
            <SubmissionDetails
              ref={submissionDetailsRef}
              submission={submissionForReview}
              onBack={onClose}
              onSaveReview={onSaveReview}
              readOnly={isPreviousAttempt}
            />
          )}
        </div>
      </div>

      <GradeSheetModal
        open={gradeSheetOpen}
        onClose={() => setGradeSheetOpen(false)}
        data={gradeSheetData}
      />
    </div>,
    document.body
  );
}

// --- Main Root Workspace Dashboard Layout ---

export default function TeacherSubmissions({
  activeCourse,
  activeAssignment,
  requestedStatusFilter = "All",
}) {
  const {
    assignments = [],
    submissions = [],
    setSubmissions,
    addSubmission,
    updateSubmissionReview,
    reopenSubmission,
    refreshTeacherWorkspace,
  } = useTeacherWorkspace();

  const [selectedRosterId, setSelectedRosterId] = useState(null);
  const [selectedAttemptId, setSelectedAttemptId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewSubmissionSnapshot, setReviewSubmissionSnapshot] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const dataSnapshot = useMemo(() => getPraxisData(), []);

  // 1. Resolve selected assignment from the active selection passed down as a prop
  const selectedAssignment = useMemo(() => {
    return activeAssignment || null;
  }, [activeAssignment]);

  // Reset local interactive views and apply the requested filter whenever
  // the selected assignment or shortcut request changes.
  useEffect(() => {
    setSelectedRosterId(null);
    setSelectedAttemptId(null);
    setReviewOpen(false);
    setSearchTerm("");
    setStatusFilter(requestedStatusFilter || "All");
  }, [selectedAssignment?.id, requestedStatusFilter]);

  // 2. Map and generate roster matching current selected active assignment
  const roster = useMemo(() => {
    if (!selectedAssignment) return [];
    const data = getPraxisData();
    const enrollments = data.enrollments || [];

    const latestSubmissions = mergeSubmissionSources(
      data.submissions,
      submissions
    );

    const classEnrollments = enrollments.filter((enrollment) =>
      sameClass(enrollment, selectedAssignment)
    );

    const assignmentSubmissions = latestSubmissions.filter(
      (submission) =>
        String(
          submission.assignmentId ||
            submission.assignment?.id ||
            submission.assignmentDetails?.id ||
            ""
        ) === String(selectedAssignment.id)
    );

    const rosterByEmail = new Map();

    classEnrollments.forEach((enrollment) => {
      const email = (enrollment.studentEmail || "student@aui.ma").toLowerCase();
      rosterByEmail.set(email, {
        id: `${selectedAssignment.id}_${enrollment.studentEmail || "student@aui.ma"}`,
        studentName: enrollment.studentName || "Student",
        studentEmail: enrollment.studentEmail || "student@aui.ma",
        assignment: selectedAssignment,
        submission: null,
        progressSubmission: null,
        progressRecords: [],
        attempts: [],
        status: "Not Started",
      });
    });

    assignmentSubmissions.forEach((submission) => {
      const resolvedStudentEmail =
        submission.studentEmail ||
        submission.userEmail ||
        submission.student?.email ||
        submission.profile?.email ||
        "student@aui.ma";

      const email = resolvedStudentEmail.toLowerCase();

      const existingRow = rosterByEmail.get(email) || {
        id: `${selectedAssignment.id}_${resolvedStudentEmail}`,
        studentName:
          submission.studentName ||
          submission.student?.name ||
          submission.profile?.name ||
          "Student",
        studentEmail: resolvedStudentEmail,
        assignment: selectedAssignment,
        submission: null,
        progressSubmission: null,
        progressRecords: [],
        attempts: [],
        status: "Not Started",
      };
      existingRow.studentName =
        submission.studentName ||
        submission.student?.name ||
        submission.profile?.name ||
        existingRow.studentName ||
        "Student";

      existingRow.studentEmail =
        resolvedStudentEmail ||
        existingRow.studentEmail;

      existingRow.progressRecords = [
        ...(existingRow.progressRecords || []),
        submission,
      ];
      if (hasSubmissionEvidence(submission)) {
        existingRow.attempts = [
          ...(existingRow.attempts || []),
          submission,
        ];
      }
      rosterByEmail.set(email, existingRow);
    });

    return Array.from(rosterByEmail.values()).map((row) => {
      const sortedAttempts = [
        ...(row.attempts || []),
      ].sort((a, b) => {
        const attemptDifference =
          Number(b.attemptNumber || 1) -
          Number(a.attemptNumber || 1);

        if (attemptDifference !== 0) {
          return attemptDifference;
        }

        return (
          getSubmissionTime(b) -
          getSubmissionTime(a)
        );
      });
      const sortedProgressRecords = [...(row.progressRecords || [])].sort(
        (a, b) => getSubmissionTime(b) - getSubmissionTime(a)
      );
      const currentAttempt =
        sortedAttempts.find((attempt) => attempt.isCurrent === true) ||
        sortedAttempts[0] || null;
      const currentProgress =
        sortedProgressRecords.find((record) => record.isCurrent === true) ||
        sortedProgressRecords[0] || null;
      const displayStatus = currentAttempt
        ? normalizeStatus(currentAttempt.status)
        : currentProgress
        ? normalizeStatus(currentProgress.status || "draft")
        : "Not Started";
      return {
        ...row,
        progressRecords: sortedProgressRecords,
        progressSubmission: currentProgress,
        attempts: sortedAttempts,
        submission: currentAttempt,
        status: displayStatus,
      };
    });
  }, [selectedAssignment, submissions]);

  // 3. Keep filters on the resulting list
  const filteredRoster = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    return roster.filter((item) => {
      const status = normalizeStatus(item.status);
      const matchesStatus =
        statusFilter === "All" ||
        (statusFilter === "Pending"
          ? ["Submitted", "Late"].includes(status) &&
            hasSubmissionEvidence(item.submission)
          : status === statusFilter);
      const matchesSearch = !cleanSearch || item.studentName?.toLowerCase().includes(cleanSearch) || item.studentEmail?.toLowerCase().includes(cleanSearch);
      return matchesStatus && matchesSearch;
    });
  }, [roster, statusFilter, searchTerm]);

  // 4. Compute active analytics indicators specifically for this assignment
  const submissionStats = useMemo(() => {
    const stats = { total: roster.length, submitted: 0, graded: 0, needsReview: 0, missing: 0 };
    roster.forEach((item) => {
      const status = normalizeStatus(item.status);
      if (status === "Submitted") stats.submitted += 1;
      if (status === "Graded") stats.graded += 1;
      if (
        ["Submitted", "Late"].includes(status) &&
        hasSubmissionEvidence(item.submission)
      ) {
        stats.needsReview += 1;
      }
      if (["Missing", "Not Started"].includes(status)) stats.missing += 1;
    });
    return stats;
  }, [roster]);

  useEffect(() => {
    if (roster.length === 0) {
      setSelectedRosterId(null);
      setSelectedAttemptId(null);
      setReviewOpen(false);
      return;
    }
    if (!roster.some((item) => item.id === selectedRosterId)) {
      setSelectedRosterId(null);
      setSelectedAttemptId(null);
      setReviewOpen(false);
    }
  }, [roster, selectedRosterId]);

  const selectedIndex = roster.findIndex((item) => item.id === selectedRosterId);
  const selectedItem = selectedIndex >= 0 ? roster[selectedIndex] : null;
  const selectedAttempts = selectedItem?.attempts || [];
  const currentAttempt = selectedAttempts.find((sub) => sub.isCurrent === true) || selectedAttempts[0] || null;
  const selectedSubmission =
    selectedAttempts.find(
      (sub) => String(sub.id) === String(selectedAttemptId)
    ) ||
    currentAttempt ||
    selectedItem?.submission ||
    null;
  const selectedSubmissionId = selectedSubmission?.id || null;

  useEffect(() => {
    let active = true;
    if (!selectedSubmission) {
      setReviewSubmissionSnapshot(null);
      return () => {
        active = false;
      };
    }
    setReviewSubmissionSnapshot(selectedSubmission);
    if (selectedSubmission.detailLoaded !== false) {
      return () => {
        active = false;
      };
    }
    getSubmissionDetails(selectedSubmission.id)
      .then((details) => {
        if (!active) return;
        const hydrated = {
          ...selectedSubmission,
          ...details,
          assignment: selectedSubmission.assignment,
          assignmentDetails: selectedSubmission.assignmentDetails,
          assignmentTitle: selectedSubmission.assignmentTitle,
          classId: selectedSubmission.classId,
          classCode: selectedSubmission.classCode,
          className: selectedSubmission.className,
          isCurrent: selectedSubmission.isCurrent,
        };
        setReviewSubmissionSnapshot(hydrated);
        if (typeof setSubmissions === "function") {
          setSubmissions((current) =>
            current.map((item) =>
              String(item.id) === String(hydrated.id) ? hydrated : item
            )
          );
        }
      })
      .catch((error) => {
        if (active) {
          console.error("Could not load full submission details:", error);
        }
      });
    return () => {
      active = false;
    };
    /*
     * Background polling replaces collection objects with fresh references.
     * Hydration is tied to the selected record identity so those harmless
     * summary refreshes cannot reset the open review snapshot or its UI state.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSubmissionId, setSubmissions]);

  const activeReviewSubmission =
    reviewSubmissionSnapshot &&
    String(reviewSubmissionSnapshot.id) === String(selectedSubmission?.id)
      ? reviewSubmissionSnapshot
      : selectedSubmission;

  function refreshRoster() {
    if (typeof refreshTeacherWorkspace === "function") refreshTeacherWorkspace();
    setSelectedAttemptId(null);
    setRefreshKey((curr) => curr + 1);
  }

  function openStudentReview(item) {
    const current =
      item.attempts?.find(
        (attempt) => attempt.isCurrent === true && hasSubmissionEvidence(attempt)
      ) || item.attempts?.find(hasSubmissionEvidence) || null;
    if (!current) return;
    setSelectedRosterId(item.id);
    setSelectedAttemptId(current.id);
    setReviewSubmissionSnapshot(current);
    setReviewOpen(true);
  }

  function createPlaceholderSubmission(item, nextStatus) {
    if (!selectedAssignment || !item) return null;
    const now = new Date().toISOString();
    const newSubmission = {
      id: "sub_" + Date.now(),
      assignmentId: selectedAssignment.id,
      assignmentTitle: selectedAssignment.title,
      assignment: selectedAssignment,
      assignmentDetails: selectedAssignment,
      rubricSchema: selectedAssignment.rubricSchema || null,
      rubricCriteria: selectedAssignment.rubricCriteria || [],
      studentName: item.studentName || "Student",
      studentEmail: item.studentEmail,
      classCode: selectedAssignment.classCode,
      className: selectedAssignment.className,
      submittedAt: null,
      resubmittedAt: null,
      status: nextStatus,
      score: null,
      feedback: "",
      reviewedAt: null,
      wordCount: 0,
      aiFlags: 0,
      content: "", draftText: "", submittedText: "", finalText: "", text: "",
      annotations: [], integrityLogs: [], copyPasteLogs: [], focusLossLogs: [], writingEvents: [],
      attemptNumber: 1, previousSubmissionId: null, isCurrent: true, createdAt: now,
    };

    if (typeof addSubmission === "function") {
      return addSubmission(newSubmission) || newSubmission;
    }

    return newSubmission;
  }

  async function handleStatusChange(nextStatus) {
    if (!selectedItem) return;

    const currentStatus = normalizeStatus(
      selectedSubmission?.status
    );

    const currentText = getSubmissionText(
      selectedSubmission
    );

    if (nextStatus === "Missing") {
      if (currentText) {
        window.alert(
          "A submission containing student text cannot be marked Missing. Use Submitted, Late, or Reopen."
        );
        return;
      }

      if (!selectedSubmission) {
        const created =
          createPlaceholderSubmission(
            selectedItem,
            "Missing"
          );

        if (created?.id) {
          setSelectedAttemptId(created.id);
          setReviewSubmissionSnapshot(
            created
          );
        }

        return;
      }

      const now =
        new Date().toISOString();

      const missingSubmission = {
        ...selectedSubmission,
        status: "Missing",
        submittedAt: null,
        resubmittedAt: null,
        updatedAt: now,
      };

      updateSubmissionReview(
        selectedSubmission.id,
        missingSubmission
      );

      setSelectedAttemptId(
        selectedSubmission.id
      );
      setReviewSubmissionSnapshot(
        missingSubmission
      );
      setRefreshKey(
        (current) => current + 1
      );
      return;
    }

    if (!selectedSubmission || !currentText) {
      window.alert(
        `"${nextStatus}" requires a real student submission with text.`
      );
      return;
    }

    if (
      currentStatus === "Reopened" &&
      nextStatus !== "Reopened"
    ) {
      window.alert(
        "This assignment is reopened for student revision. The student must resubmit it before the status can change."
      );
      return;
    }

    if (nextStatus === "Reopened") {
      if (
        typeof reopenSubmission !==
        "function"
      ) {
        window.alert(
          "The reopen workflow is not available in the instructor workspace context."
        );
        return;
      }

      const reopenedAttempt =
        await reopenSubmission(
          selectedSubmission.id,
          {
            reopenedBy: "Instructor",
          }
        );

      if (!reopenedAttempt?.id) {
        window.alert(
          "This attempt could not be reopened. Only the current submitted, late, or graded attempt can be reopened."
        );
        return;
      }

      setSelectedAttemptId(
        reopenedAttempt.id
      );
      setReviewSubmissionSnapshot(
        reopenedAttempt
      );
      setRefreshKey(
        (current) => current + 1
      );

      return;
    }

    const now =
      new Date().toISOString();

    const updatedSubmission = {
      ...selectedSubmission,
      status: nextStatus,
      submittedAt:
        selectedSubmission.submittedAt ||
        now,
      updatedAt: now,
    };

    updateSubmissionReview(
      selectedSubmission.id,
      updatedSubmission
    );

    setSelectedAttemptId(
      selectedSubmission.id
    );
    setReviewSubmissionSnapshot(
      updatedSubmission
    );
    setRefreshKey(
      (current) => current + 1
    );
  }

  async function handleSaveReview(id, reviewData) {
    const sourceSubmission =
      activeReviewSubmission || selectedSubmission;

    if (!sourceSubmission) {
      return false;
    }

    if (sourceSubmission.isCurrent === false) {
      return false;
    }

    if (
      normalizeStatus(sourceSubmission.status) ===
      "Reopened"
    ) {
      window.alert(
        "This assignment is reopened for student revision. The student must resubmit it before a new instructor review can be saved."
      );

      return false;
    }

    const now = new Date().toISOString();

    const updatedSubmission = {
      ...sourceSubmission,
      ...reviewData,
      score:
        reviewData.score === "" ||
        reviewData.score === null ||
        reviewData.score === undefined
          ? null
          : Number(reviewData.score),
      status: "Graded",
      reviewedAt: reviewData.reviewedAt || now,
      updatedAt: now,
    };

    await updateSubmissionReview(id, updatedSubmission);

    setReviewSubmissionSnapshot(updatedSubmission);
    setSelectedAttemptId(id);
    setRefreshKey((current) => current + 1);

    return true;
  }

  const submissionForReview = useMemo(() => {
    const sourceSubmission =
      activeReviewSubmission || selectedSubmission;

    if (!sourceSubmission || !hasSubmissionEvidence(sourceSubmission)) return null;

    const txt = getSubmissionText(sourceSubmission);

    return {
      ...sourceSubmission,
      assignment: selectedAssignment,
      assignmentDetails: selectedAssignment,
      rubricSchema:
        sourceSubmission.rubricSchema ||
        selectedAssignment?.rubricSchema ||
        null,
      rubricCriteria:
        sourceSubmission.rubricCriteria ||
        selectedAssignment?.rubricCriteria ||
        [],
      rubricTitle:
        sourceSubmission.rubricTitle ||
        selectedAssignment?.rubricTitle ||
        selectedAssignment?.rubricSchema?.title ||
        null,
      content: txt,
      draftText: String(sourceSubmission.draftText || ""),
      submittedText: txt,
      submissionText: txt,
      finalText: txt,
      text: txt,
    };
  }, [
    activeReviewSubmission,
    selectedSubmission,
    selectedAssignment,
  ]);

  // Fallback if no global active assignment is found
  if (!selectedAssignment) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center max-w-xl mx-auto my-12">
        <FileText className="w-12 h-12 text-slate-300 mb-4 animate-pulse" />
        <h3 className="font-serif text-xl font-bold text-slate-800">No Active Assignment Selected</h3>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          Please choose an assignment from your course sidebar above to load student drafts, submissions, behaviors, and grading tools.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-slate-900">
              {selectedAssignment.title || "Student Submissions"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Review individual draft metrics, edit statuses, provide custom feedback, or print grade reports.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshRoster}
            className="inline-flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-white transition-all self-start sm:self-center"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Dynamic Analytics Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-[#FBF9F6] p-3">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Students</p>
            <p className="text-lg font-serif font-bold text-slate-900">{submissionStats.total}</p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-500">Submitted</p>
            <p className="text-lg font-serif font-bold text-indigo-700">{submissionStats.submitted}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-600">Graded</p>
            <p className="text-lg font-serif font-bold text-emerald-700">{submissionStats.graded}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-600">Needs Review</p>
            <p className="text-lg font-serif font-bold text-amber-700">{submissionStats.needsReview}</p>
          </div>
        </div>
      </div>

      {/* Main Student List Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-slate-400" />
                <h3 className="font-serif text-lg font-bold text-slate-900">Student Submission List</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {selectedAssignment.title}
                {selectedAssignment.classCode ? ` · ${selectedAssignment.classCode}` : ""}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search student..."
                  className="w-full sm:w-56 bg-[#FBF9F6] border border-slate-200 text-slate-800 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-slate-400"
                />
              </div>

              <div className="relative">
                <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full sm:w-44 bg-[#FBF9F6] border border-slate-200 text-slate-800 text-xs font-bold rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-slate-400"
                >
                  <option value="All">All Statuses</option>
                  <option value="Pending">Pending Review</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Graded">Graded</option>
                  <option value="Reopened">Reopened</option>
                  <option value="Late">Late</option>
                  <option value="Missing">Missing</option>
                  <option value="Not Started">Not Started</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {filteredRoster.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <h3 className="font-serif text-lg font-bold text-slate-900">No students found</h3>
            <p className="text-sm text-slate-400 mt-1">
              {statusFilter === "Pending"
                ? "There are no submitted or late attempts waiting for review."
                : "Try changing the search or status filter."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            <div className="hidden lg:grid grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr] gap-4 px-5 py-3 bg-[#FBF9F6] text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
              <span>Student</span>
              <span>Status</span>
              <span>Attempts</span>
              <span>Score</span>
              <span>Last Activity</span>
              <span className="text-right">Action</span>
            </div>

            {filteredRoster.map((item) => {
              const status = normalizeStatus(item.status);
              const latestSubmission = item.submission;
              const attemptsCount = item.attempts?.length || 0;
              const hasActualSubmission = hasSubmissionEvidence(latestSubmission);

              return (
                <div key={item.id} className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr] gap-3 lg:gap-4 px-5 py-4 items-center hover:bg-[#FBF9F6]/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{item.studentName}</p>
                    <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">{item.studentEmail}</p>
                  </div>
                  <div>
                    <span className={`inline-flex text-[9px] font-mono font-bold uppercase border px-2 py-1 rounded ${getStatusStyles(status)}`}>
                      {status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{attemptsCount} attempt{attemptsCount === 1 ? "" : "s"}</div>
                  <div className="text-xs font-bold text-slate-700">
                    {hasActualSubmission && latestSubmission?.score !== null && latestSubmission?.score !== undefined
                      ? latestSubmission.score : " - "}
                  </div>
                  <div className="text-xs text-slate-500">
                    {hasActualSubmission ? getReadableDate(latestSubmission) : " - "}
                  </div>
                  <div className="lg:text-right">
                    <button
                      type="button"
                      disabled={!hasActualSubmission}
                      onClick={() => openStudentReview(item)}
                      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                        hasActualSubmission
                          ? "bg-slate-900 text-white hover:bg-slate-800"
                          : "cursor-not-allowed border border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      {hasActualSubmission ? "Review" : "No Submission"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Portal Container Overlay modal anchor */}
      <ReviewModalOverlay
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        selectedItem={selectedItem}
        selectedSubmission={activeReviewSubmission}
        selectedAssignment={selectedAssignment}
        selectedIndex={selectedIndex}
        rosterLength={roster.length}
        selectedAttempts={selectedAttempts}
        selectedAttemptId={selectedAttemptId}
        setSelectedAttemptId={setSelectedAttemptId}
        onStatusChange={handleStatusChange}
        onPrevious={() => selectedIndex > 0 && openStudentReview(roster[selectedIndex - 1])}
        onNext={() => selectedIndex < roster.length - 1 && openStudentReview(roster[selectedIndex + 1])}
        onSaveReview={handleSaveReview}
        submissionForReview={submissionForReview}
      />
    </div>
  );
}
