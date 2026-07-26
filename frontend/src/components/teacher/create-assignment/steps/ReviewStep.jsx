import React, { useMemo, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  FileText,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Timer,
} from "lucide-react";

import CompactRubricPreview from "../rubric/CompactRubricPreview";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getCourseLabel(classes = [], course = "") {
  const selected =
    classes.find(
      (item) =>
        String(item?.id) === String(course) ||
        String(item?.code) === String(course) ||
        String(item?.name) === String(course)
    ) || null;

  if (!selected) {
    return String(course || "No course selected");
  }

  if (selected.code && selected.name) {
    return `${selected.code} - ${selected.name}`;
  }

  return (
    selected.code ||
    selected.name ||
    String(course || "No course selected")
  );
}

function formatDueDate(value) {
  if (!value) return "No due date";

  const raw = String(value).trim();
  const match = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/
  );

  if (match) {
    const [
      ,
      year,
      month,
      day,
      hour = "23",
      minute = "59",
    ] = match;

    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    );

    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString([], {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
  }

  return raw;
}

function formatCoachLimit(enabled, value) {
  if (!enabled) return "Disabled";

  const numeric = Number(value || 0);

  if (numeric <= 0) {
    return "Unlimited";
  }

  return `${numeric} minute${numeric === 1 ? "" : "s"}`;
}

function formatRequestLimit(value) {
  const numeric = Math.max(
    0,
    Number(value || 0)
  );

  if (numeric === 0) {
    return "Disabled";
  }

  return `${numeric} request${numeric === 1 ? "" : "s"}`;
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
      <span className="font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>

      <span className="max-w-[65%] text-right text-[11px] font-bold leading-snug text-slate-800">
        {value}
      </span>
    </div>
  );
}

function getRubricSourceLabel(
  rubricMode,
  selectedSavedRubric,
  uploadedRubricName
) {
  if (rubricMode === "saved") {
    return (
      selectedSavedRubric?.title ||
      selectedSavedRubric?.name ||
      "Saved / previous rubric"
    );
  }

  if (rubricMode === "uploaded") {
    return uploadedRubricName || "Uploaded rubric";
  }

  if (rubricMode === "generated") {
    return "AI-generated rubric";
  }

  if (rubricMode === "manual") {
    return "Manually created rubric";
  }

  return "Attached rubric";
}

export default function ReviewStep({
  creationMode,
  title,
  description,
  course,
  classes = [],
  dueDate,
  minWords,
  maxWords,
  assignmentType,
  studentLevel,
  feedbackChecks,
  allowAI,
  coachTimeLimitMinutes,
  autoBuildOutlineFromCoach,
  rubricMode,
  rubricTitle,
  selectedSavedRubric,
  uploadedRubricName,
  parsedRubricSchema,
  criteria = [],
  rubricTotal,
  isGeneratingRubric = false,
  onEditRubric,
  onRegenerateRubric,
}) {
  const [expandedCriterionId, setExpandedCriterionId] = useState("");
  const courseLabel = useMemo(
    () => getCourseLabel(classes, course),
    [classes, course]
  );

  const resolvedCriteria =
    safeArray(parsedRubricSchema?.criteria).length > 0
      ? safeArray(parsedRubricSchema.criteria)
      : safeArray(criteria);

  const resolvedRubricTitle =
    rubricTitle ||
    parsedRubricSchema?.title ||
    selectedSavedRubric?.title ||
    selectedSavedRubric?.name ||
    "Attached rubric";

  const resolvedRubricTotal =
    Number(
      rubricTotal ||
      parsedRubricSchema?.totalPoints ||
      resolvedCriteria.reduce(
        (sum, criterion) =>
          sum +
          Number(
            criterion?.points ||
            criterion?.maxPoints ||
            0
          ),
        0
      )
    ) || 0;

  const feedbackEnabled =
    Number(feedbackChecks || 0) > 0;

  const rubricSourceLabel = getRubricSourceLabel(
    rubricMode,
    selectedSavedRubric,
    uploadedRubricName
  );

  const outlineEnabled =
    Boolean(
      allowAI &&
      autoBuildOutlineFromCoach
    );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <FileText className="h-4 w-4 text-blue-700" />

          <h4 className="font-serif text-sm font-bold text-slate-950">
            Assignment and rubric summary
          </h4>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <SummaryRow
            label="Mode"
            value={
              creationMode === "ai"
                ? "AI-assisted"
                : "Manual"
            }
          />

          <SummaryRow
            label="Title"
            value={title || "Untitled assignment"}
          />

          <SummaryRow
            label="Course"
            value={courseLabel}
          />

          <SummaryRow
            label="Due date"
            value={formatDueDate(dueDate)}
          />

          <SummaryRow
            label="Type"
            value={assignmentType || "Not specified"}
          />

          <SummaryRow
            label="Level"
            value={studentLevel || "Not specified"}
          />

          <SummaryRow
            label="Word count"
            value={`${Number(minWords || 0)}–${Number(maxWords || 0)} words`}
          />

          <SummaryRow
            label="Rubric"
            value={`${resolvedRubricTitle} (${rubricSourceLabel})`}
          />

          <SummaryRow
            label="Scale"
            value={`${resolvedCriteria.length} ${
              resolvedCriteria.length === 1
                ? "criterion"
                : "criteria"
            } / ${resolvedRubricTotal} pts`}
          />
        </div>

        <div className="mt-3 border-t border-slate-100 pt-2">
          <p className="mb-2 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-slate-400">
            Student support
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${allowAI ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <MessageSquareText className="h-3 w-3" />
              Coach: {allowAI ? "Enabled" : "Disabled"}
            </span>

            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${allowAI ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <Timer className="h-3 w-3" />
              Time: {formatCoachLimit(allowAI, coachTimeLimitMinutes)}
            </span>

            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${outlineEnabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <BookOpen className="h-3 w-3" />
              Outline: {outlineEnabled ? "Enabled" : "Disabled"}
            </span>

            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${feedbackEnabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <CheckCircle2 className="h-3 w-3" />
              AI feedback: {formatRequestLimit(feedbackChecks)}
            </span>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700">
              <ClipboardList className="h-4 w-4" />
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-serif text-sm font-bold text-slate-950">
                  Rubric preview
                </h4>
                {rubricMode === "generated" && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-mono text-[9px] font-bold text-violet-700">
                    AI-generated
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Review every criterion and performance descriptor before saving the assignment.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {rubricMode === "generated" && onRegenerateRubric && (
              <button
                type="button"
                onClick={onRegenerateRubric}
                disabled={isGeneratingRubric}
                className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[11px] font-bold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isGeneratingRubric ? "animate-spin" : ""}`} />
                {isGeneratingRubric ? "Regenerating..." : "Regenerate"}
              </button>
            )}

            {onEditRubric && rubricMode !== "saved" && (
              <button
                type="button"
                onClick={onEditRubric}
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-800 hover:bg-blue-100"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit rubric
              </button>
            )}
          </div>
        </div>

        <CompactRubricPreview
          criteria={resolvedCriteria}
          rubricTotal={resolvedRubricTotal}
          parsedRubricMatrix={null}
          expandedCriterionId={expandedCriterionId || resolvedCriteria[0]?.id}
          setExpandedCriterionId={setExpandedCriterionId}
        />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
          <BookOpen className="h-4 w-4 text-emerald-700" />

          <h4 className="font-serif text-sm font-bold text-slate-950">
            Student instructions preview
          </h4>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {description || "No student instructions provided."}
          </p>
        </div>
      </section>
    </div>
  );
}
