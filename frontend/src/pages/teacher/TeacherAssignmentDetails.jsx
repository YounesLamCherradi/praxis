import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  ClipboardList,
  Clock,
  FileText,
  Hash,
  Lock,
  ListChecks,
  MessageSquareText,
  Pencil,
  PlayCircle,
  ShieldCheck,
  Timer,
} from "lucide-react";

import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext";

function boolFromAssignment(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return Boolean(value);
    }
  }

  return false;
}

function valueFromAssignment(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

function getStatus(assignment) {
  const value = String(
    assignment?.status ||
      assignment?.publicationStatus ||
      assignment?.state ||
      ""
  ).toLowerCase();

  if (
    value === "published" ||
    value === "active" ||
    assignment?.isPublished === true ||
    assignment?.published === true
  ) {
    return "Published";
  }

  return "Draft";
}

function getStatusStyles(status) {
  return status === "Published"
    ? "border-blue-200 bg-blue-50 text-blue-700"
    : "border-slate-200 bg-slate-50 text-slate-600";
}

function formatPastePolicy(value) {
  const clean = String(value || "warn").toLowerCase();

  if (clean === "allow") return "Allow paste";
  if (clean === "block") return "Block paste";

  return "Warn students";
}

function getPastePolicyTone(value) {
  const clean = String(value || "warn").toLowerCase();

  if (clean === "block") return "amber";
  if (clean === "allow") return "slate";

  return "blue";
}

function assignmentMatchesSubmission(assignment, submission) {
  return String(submission.assignmentId) === String(assignment.id);
}

function getSubmissionText(submission = {}) {
  return String(
    submission.submittedText ||
      submission.submissionText ||
      submission.finalText ||
      submission.content ||
      submission.draftText ||
      ""
  ).trim();
}

function hasSubmissionEvidence(submission = {}) {
  return Boolean(
    submission.submittedAt ||
      submission.resubmittedAt ||
      getSubmissionText(submission)
  );
}

function getStudentKey(submission = {}) {
  return String(
    submission.studentEmail ||
      submission.userEmail ||
      submission.id ||
      "student"
  )
    .trim()
    .toLowerCase();
}

function formatCoachLimit(value, allowAI) {
  if (!allowAI) return "Disabled";

  const numeric = Number(value);

  if (numeric < 0) return "Disabled";
  if (numeric === 0) return "Unlimited";

  return `${numeric} minute${numeric === 1 ? "" : "s"}`;
}

function formatAssignmentDeadline(assignment = {}) {
  const rawDate = String(
    assignment.dueDate ||
      assignment.deadline ||
      assignment.dueAt ||
      ""
  ).trim();

  if (!rawDate) return "No due date";

  const explicitTime = String(
    assignment.dueTime ||
      assignment.deadlineTime ||
      assignment.timeDue ||
      ""
  ).trim();

  const match = rawDate.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/
  );

  if (!match) {
    return formatDisplayDate(rawDate);
  }

  const [, year, month, day, embeddedHour, embeddedMinute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  const dateLabel = new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
    }
  ).format(date);

  const timeText =
    explicitTime ||
    (embeddedHour !== undefined
      ? `${embeddedHour}:${embeddedMinute}`
      : "");

  if (!timeText) return dateLabel;

  const [hourText, minuteText = "00"] =
    timeText.split(":");

  const time = new Date(
    2000,
    0,
    1,
    Number(hourText),
    Number(minuteText)
  );

  const timeLabel = new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(time);

  return `${dateLabel} · ${timeLabel}`;
}

function getRubricSourceLabel(source) {
  if (source === "uploaded") return "Uploaded";
  if (source === "saved") return "Reused";
  if (source === "generated") return "AI-generated";
  if (source === "manual") return "Manual";

  return "Attached";
}

function formatDisplayDate(value) {
  if (!value || value === "Not available" || value === "Not published") {
    return value || "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: value.includes?.("T") ? "2-digit" : undefined,
    minute: value.includes?.("T") ? "2-digit" : undefined,
  }).format(date);
}

export default function TeacherAssignmentDetails({
  modalMode = false,
  onClose,
  assignment: assignmentProp = null,
}) {
  const {
    selectedAssignment,
    setSelectedAssignment,
    setView,
    submissions = [],
  } = useTeacherWorkspace();

  const [rubricExpanded, setRubricExpanded] = useState(false);
  const [openRubricCriterionKey, setOpenRubricCriterionKey] = useState(null);

  // The create flow can update the local assignment selection one render
  // before the shared workspace selection settles.  Accept the assignment
  // owned by the modal so that transition can never render an empty dialog.
  const assignment = assignmentProp || selectedAssignment;

  const submissionMetrics = useMemo(() => {
    if (!assignment) {
      return {
        students: 0,
        attempts: 0,
        pending: 0,
      };
    }

    const assignmentSubmissions = submissions.filter(
      (submission) =>
        assignmentMatchesSubmission(
          assignment,
          submission
        )
    );

    const students = new Set();
    let pending = 0;

    assignmentSubmissions.forEach((submission) => {
      if (hasSubmissionEvidence(submission)) {
        students.add(getStudentKey(submission));
      }

      const status = String(
        submission.status || ""
      )
        .trim()
        .toLowerCase();

      if (
        submission.isCurrent !== false &&
        ["submitted", "late"].includes(status) &&
        hasSubmissionEvidence(submission)
      ) {
        pending += 1;
      }
    });

    return {
      students: students.size,
      attempts: assignmentSubmissions.length,
      pending,
    };
  }, [assignment, submissions]);

  if (!assignment) return null;

  const status = getStatus(assignment);
  const isPublished = status === "Published";

  const aiSupportSettings = assignment.aiSupportSettings || {};

  const minWords = valueFromAssignment(
    assignment.minWords,
    assignment.wordCountMin,
    assignment.minimumWords,
    0
  );

  const maxWords = valueFromAssignment(
    assignment.maxWords,
    assignment.wordCountMax,
    assignment.maximumWords,
    0
  );

  const allowAI = boolFromAssignment(
    aiSupportSettings.aiIdeasCoach,
    assignment.aiIdeasCoach,
    assignment.allowAI,
    assignment.ideationAI
  );

  const coachTimeLimitMinutes = valueFromAssignment(
    aiSupportSettings.chatTimeLimit,
    assignment.chatTimeLimit,
    aiSupportSettings.coachTimeLimitMinutes,
    assignment.coachTimeLimitMinutes,
    assignment.aiCoachTimeLimitMinutes,
    0
  );

  const feedbackChecks = Number(
    valueFromAssignment(
      aiSupportSettings.feedbackRequestLimit,
      assignment.feedbackRequestLimit,
      assignment.feedbackChecks,
      assignment.maxFeedbackChecks,
      0
    )
  );

  const aiFeedback = feedbackChecks > 0;

  const autoBuildOutlineFromCoach = Boolean(
    allowAI &&
      boolFromAssignment(
        aiSupportSettings.autoOutlineFromChat,
        assignment.autoOutlineFromChat,
        aiSupportSettings.autoBuildOutlineFromCoach,
        assignment.autoBuildOutlineFromCoach,
        assignment.generateOutlineFromCoach
      )
  );

  const rubricSchema = assignment.rubricSchema || null;

  const rubricCriteria =
    rubricSchema?.criteria ||
    assignment.rubricCriteria ||
    (Array.isArray(assignment.rubric)
      ? assignment.rubric
      : assignment.rubric?.criteria) ||
    [];

  const rubricAttached = Boolean(
    assignment.rubricSkipped !== true &&
      assignment.rubricSource !== "skip" &&
      (
        rubricSchema ||
        rubricCriteria.length > 0 ||
        assignment.rubricId
      )
  );

  const rubricCriteriaCount = rubricCriteria.length;

  const rubricPoints =
    rubricSchema?.totalPoints ||
    assignment.rubricTotal ||
    assignment.rubricPoints ||
    "";

  const instructions =
    assignment.instructions ||
    assignment.description ||
    assignment.prompt ||
    "No assignment instructions provided.";

  const createdAt = formatDisplayDate(
    valueFromAssignment(assignment.createdAt, "Not available")
  );

  const updatedAt = formatDisplayDate(
    valueFromAssignment(
      assignment.updatedAt,
      assignment.lastUpdated,
      assignment.createdAt,
      "Not available"
    )
  );

  const publishedAt = isPublished
    ? formatDisplayDate(
        valueFromAssignment(assignment.publishedAt, updatedAt)
      )
    : "Not published";

  function goBackToAssignments() {
    setSelectedAssignment(null);

    if (onClose) {
      onClose();
      return;
    }

    setView("list");
  }

  return (
    <div className={modalMode ? "space-y-5" : "space-y-5 animate-fade-in-up"}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={goBackToAssignments}
          className="group inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-blue-700"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          {modalMode ? "Close details" : "Back to assignments"}
        </button>

        <button
          type="button"
          onClick={() => setView("edit")}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit assignment
        </button>
      </div>

      <div className="space-y-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <header className="flex flex-col gap-4 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl space-y-2">
            <div className="inline-flex items-center gap-1.5 rounded border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-blue-700">
              <ClipboardList className="h-3 w-3" />
              Assignment overview
            </div>

            <h1 className="font-serif text-2xl font-black text-slate-950 sm:text-3xl">
              {assignment.title || "Untitled Assignment"}
            </h1>

            <p className="max-w-3xl text-xs leading-relaxed text-slate-500">
              Review the student-facing task, AI support, integrity rules,
              rubric, and assignment activity.
            </p>
          </div>

          <span
            className={`inline-flex shrink-0 rounded border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-wider ${getStatusStyles(
              status
            )}`}
          >
            {status}
          </span>
        </header>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
          <InfoCard
            icon={BookOpen}
            label="Course"
            value={`${assignment.classCode || "No code"}${
              assignment.className ? `  -  ${assignment.className}` : ""
            }`}
          />

          <InfoCard
            icon={Calendar}
            label="Due date"
            value={formatAssignmentDeadline(assignment)}
          />

          <InfoCard
            icon={Hash}
            label="Word count"
            value={`${minWords || 0}–${maxWords || 0} words`}
          />

          <InfoCard
            icon={CheckCircle2}
            label="Feedback checks"
            value={`${feedbackChecks} allowed`}
          />

          <InfoCard
            icon={BarChart3}
            label="Students"
            value={submissionMetrics.students}
          />

          <InfoCard
            icon={ListChecks}
            label="Attempts"
            value={submissionMetrics.attempts}
          />

          <InfoCard
            icon={ClipboardCheck}
            label="Pending review"
            value={submissionMetrics.pending}
          />
        </div>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <SectionHeading
            icon={FileText}
            title="Assignment Instructions"
            description="Student-facing instructions shown in the writing workflow."
          />

          <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
              {instructions}
            </p>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
          <SectionHeading
            icon={Bot}
            title="Student Support"
            description="Original Praxis assignment-level support controls."
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SettingRow
              icon={MessageSquareText}
              label="Coach"
              description="Conversational brainstorming and planning support."
              enabled={allowAI}
            />

            <MetricRow
              icon={Timer}
              label="Coach active-time limit"
              value={formatCoachLimit(coachTimeLimitMinutes, allowAI)}
            />

            <SettingRow
              icon={BookOpen}
              label="Auto-build outline"
              description="Convert Coach chat into editable notes."
              enabled={autoBuildOutlineFromCoach}
            />

            <MetricRow
              icon={ShieldCheck}
              label="AI feedback requests"
              value={
                aiFeedback
                  ? `${feedbackChecks} request${feedbackChecks === 1 ? "" : "s"}`
                  : "Disabled"
              }
            />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <SectionHeading
              icon={ClipboardCheck}
              title="Rubric"
              description="Rubric attached to this assignment."
            />

            {rubricAttached ? (
              <div className="overflow-hidden rounded-xl border border-blue-100 bg-blue-50">
                <button
                  type="button"
                  onClick={() =>
                    setRubricExpanded((current) => {
                      const next = !current;

                      if (
                        next &&
                        openRubricCriterionKey === null &&
                        rubricCriteria.length > 0
                      ) {
                        const firstCriterion = rubricCriteria[0];
                        setOpenRubricCriterionKey(
                          String(firstCriterion.id || "criterion-0")
                        );
                      }

                      return next;
                    })
                  }
                  className="flex w-full items-center justify-between gap-4 p-4 text-left"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      {assignment.rubricTitle ||
                        rubricSchema?.title ||
                        "Attached rubric"}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <SmallBadge label={`${rubricCriteriaCount} criteria`} />

                      {rubricPoints !== "" && (
                        <SmallBadge label={`${rubricPoints} pts`} />
                      )}

                      <SmallBadge
                        label={getRubricSourceLabel(
                          assignment.rubricSource || rubricSchema?.source
                        )}
                      />
                    </div>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[10px] font-bold text-blue-700">
                    {rubricExpanded ? "Hide criteria" : "View criteria"}
                    {rubricExpanded ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </span>
                </button>

                {rubricExpanded && (
                  <div className="space-y-2 border-t border-blue-100 bg-white p-3">
                    {rubricCriteria.map((criterion, index) => {
                      const criterionKey = String(
                        criterion.id || `criterion-${index}`
                      );
                      const isOpen =
                        openRubricCriterionKey === criterionKey ||
                        (openRubricCriterionKey === null && index === 0);

                      return (
                        <div
                          key={criterion.id || `${criterion.name}-${index}`}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-[#F8FAFC]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setOpenRubricCriterionKey((current) =>
                                current === criterionKey ? null : criterionKey
                              )
                            }
                            className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
                            aria-expanded={isOpen}
                          >
                            <div>
                              <p className="text-xs font-bold text-slate-900">
                                {criterion.name || `Criterion ${index + 1}`}
                              </p>

                              {criterion.description && (
                                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                  {criterion.description}
                                </p>
                              )}
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-bold text-slate-700">
                                {criterion.points ?? criterion.maxScore ?? 0} pts
                              </span>
                              {isOpen ? (
                                <ChevronUp className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              )}
                            </div>
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-200 bg-white p-3">
                              {Array.isArray(criterion.bands) &&
                              criterion.bands.length > 0 ? (
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                  {criterion.bands.map((band, bandIndex) => (
                                    <div
                                      key={band.id || `${criterion.id || index}-band-${bandIndex}`}
                                      className="rounded-lg border border-slate-200 bg-white p-2.5"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-[11px] font-bold text-slate-900">
                                          {band.label || band.name || `Band ${bandIndex + 1}`}
                                        </p>
                                        <span className="shrink-0 rounded-md border border-blue-100 bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">
                                          {band.points ?? band.score ?? 0}
                                        </span>
                                      </div>

                                      {band.description && (
                                        <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
                                          {band.description}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2 text-[10px] text-slate-500">
                                  No score bands were defined for this criterion.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
                <p className="text-xs font-bold text-slate-700">
                  No rubric attached
                </p>

                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  This assignment does not contain a rubric.
                </p>
              </div>
            )}
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <SectionHeading
              icon={Clock}
              title="Activity"
              description="Publishing and update information."
            />

            <div className="space-y-2.5">
              <ActivityRow label="Created" value={createdAt} />
              <ActivityRow label="Last updated" value={updatedAt} />
              <ActivityRow label="Published" value={publishedAt} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>

      <div>
        <h2 className="font-serif text-base font-bold text-slate-950">
          {title}
        </h2>

        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-blue-200 hover:shadow-sm">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4 stroke-[1.8]" />
      </div>

      <div className="min-w-0 space-y-0.5">
        <span className="block truncate font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </span>

        <p className="break-words font-mono text-xs font-bold text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

function SettingRow({ enabled, icon: Icon, label, description }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
          enabled
            ? "border-blue-100 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-slate-50 text-slate-400"
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold text-slate-900">{label}</p>
          <StatusBadge enabled={enabled} />
        </div>

        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function MetricRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
        <Icon className="h-4 w-4" />
      </div>

      <div>
        <p className="text-xs font-bold text-slate-900">{label}</p>
        <p className="mt-1 font-mono text-sm font-bold text-blue-700">
          {value}
        </p>
      </div>
    </div>
  );
}

function CompactSetting({ label, enabled }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
      <span className="text-xs font-bold text-slate-700">{label}</span>
      <StatusBadge enabled={enabled} />
    </div>
  );
}

function PolicyRow({ label, value, tone = "blue" }) {
  const toneStyles = {
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-slate-50 text-slate-600",
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
      <span className="text-xs font-bold text-slate-700">{label}</span>

      <span
        className={`shrink-0 rounded border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wide ${
          toneStyles[tone] || toneStyles.blue
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ enabled }) {
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wide ${
        enabled
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-slate-100 text-slate-400"
      }`}
    >
      {enabled ? "Active" : "Off"}
    </span>
  );
}

function SmallBadge({ label }) {
  return (
    <span className="inline-flex rounded-lg border border-blue-100 bg-white px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
      {label}
    </span>
  );
}

function ActivityRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
      <span className="text-xs font-bold text-slate-600">{label}</span>

      <span className="text-right font-mono text-[11px] font-bold text-slate-800">
        {value}
      </span>
    </div>
  );
}
