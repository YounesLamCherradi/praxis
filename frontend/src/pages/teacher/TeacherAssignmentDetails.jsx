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
  ListChecks,
  Lock,
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
}) {
  const {
    selectedAssignment,
    setSelectedAssignment,
    setView,
    submissions = [],
  } = useTeacherWorkspace();

  const [rubricExpanded, setRubricExpanded] = useState(false);

  const assignment = selectedAssignment;

  const submissionsCount = useMemo(() => {
    if (!assignment) return 0;

    if (
      assignment.submissionsCount !== undefined &&
      assignment.submissionsCount !== null
    ) {
      return assignment.submissionsCount;
    }

    return submissions.filter((submission) =>
      assignmentMatchesSubmission(assignment, submission)
    ).length;
  }, [assignment, submissions]);

  if (!assignment) return null;

  const status = getStatus(assignment);
  const isPublished = status === "Published";

  const aiSupportSettings = assignment.aiSupportSettings || {};
  const integritySettings = assignment.integritySettings || {};

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
    aiSupportSettings.coachTimeLimitMinutes,
    assignment.coachTimeLimitMinutes,
    assignment.aiCoachTimeLimitMinutes,
    15
  );

  const aiFeedback = boolFromAssignment(
    aiSupportSettings.aiDraftFeedback,
    assignment.aiDraftFeedback,
    assignment.aiFeedback
  );

  const writingPlayback = boolFromAssignment(
    aiSupportSettings.writingPlayback,
    assignment.writingPlayback,
    assignment.saveWritingPlayback
  );

  const autoBuildOutlineFromCoach = Boolean(
    allowAI &&
      boolFromAssignment(
        aiSupportSettings.autoBuildOutlineFromCoach,
        assignment.autoBuildOutlineFromCoach,
        assignment.generateOutlineFromCoach
      )
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

  const pastePolicy = valueFromAssignment(
    integritySettings.pastePolicy,
    assignment.pastePolicy,
    "warn"
  );

  const logPasteAttempts = boolFromAssignment(
    integritySettings.logPasteAttempts,
    assignment.logPasteAttempts
  );

  const requireHonorConfirmation = boolFromAssignment(
    integritySettings.requireHonorConfirmation,
    assignment.requireHonorConfirmation
  );

  const enforceWordCount = boolFromAssignment(
    integritySettings.enforceWordCount,
    assignment.enforceWordCount
  );

  const rubricSchema = assignment.rubricSchema || null;

  const rubricAttached = Boolean(
    rubricSchema &&
      assignment.rubricSkipped !== true &&
      assignment.rubricSource !== "skip"
  );

  const rubricCriteria =
    rubricSchema?.criteria ||
    assignment.rubricCriteria ||
    assignment.rubric ||
    [];

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

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <InfoCard
            icon={BookOpen}
            label="Course"
            value={`${assignment.classCode || "No code"}${
              assignment.className ? ` — ${assignment.className}` : ""
            }`}
          />

          <InfoCard
            icon={Calendar}
            label="Due date"
            value={formatDisplayDate(
              assignment.dueDate || assignment.deadline || "No due date"
            )}
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
            label="Submissions"
            value={submissionsCount}
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

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
            <SectionHeading
              icon={Bot}
              title="Student AI Support"
              description="Tools students can use while planning, drafting, and revising."
            />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <SettingRow
                icon={MessageSquareText}
                label="AI ideas coach"
                description="Brainstorming and planning support before drafting."
                enabled={allowAI}
              />

              <MetricRow
                icon={Timer}
                label="Coach chat time limit"
                value={allowAI ? `${coachTimeLimitMinutes} minutes` : "Disabled"}
              />

              <SettingRow
                icon={ListChecks}
                label="Auto-build outline"
                description="Convert coach notes into an editable notes-only outline."
                enabled={autoBuildOutlineFromCoach}
              />

              <SettingRow
                icon={ShieldCheck}
                label="AI draft feedback"
                description="Feedback on drafts without providing a full answer."
                enabled={aiFeedback}
              />

              <SettingRow
                icon={PlayCircle}
                label="Writing playback"
                description="Save writing-process events for teacher review."
                enabled={writingPlayback}
              />
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
            <SectionHeading
              icon={Lock}
              title="Academic Integrity"
              description="Paste, honor, word-count, and submission rules."
            />

            <div className="space-y-2.5">
              <PolicyRow
                label="Paste policy"
                value={formatPastePolicy(pastePolicy)}
                tone={getPastePolicyTone(pastePolicy)}
              />

              <CompactSetting
                label="Log paste attempts"
                enabled={logPasteAttempts}
              />

              <CompactSetting
                label="Require academic honor confirmation"
                enabled={requireHonorConfirmation}
              />

              <CompactSetting
                label="Enforce word count before submission"
                enabled={enforceWordCount}
              />

              <PolicyRow
                label="Lock editing after submission"
                value="Always ON"
                tone="emerald"
              />
            </div>
          </section>
        </div>

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
                  onClick={() => setRubricExpanded((current) => !current)}
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
                    {rubricCriteria.map((criterion, index) => (
                      <div
                        key={criterion.id || `${criterion.name}-${index}`}
                        className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3"
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

                        <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-[10px] font-bold text-slate-700">
                          {criterion.points ?? criterion.maxScore ?? 0} pts
                        </span>
                      </div>
                    ))}
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