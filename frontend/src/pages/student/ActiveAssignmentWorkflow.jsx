import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudentWorkspace } from "../../contexts/StudentWorkspaceContext";

import Step1IdeasChat from "./steps/Step1IdeasChat";
import Step2DraftingCanvas from "./steps/Step2DraftingCanvas";
import Step3AIFeedback from "./steps/Step3AIFeedback";
import Step4FinalSummary from "./steps/Step4FinalSummary";

import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  FileText,
  ListChecks,
  Lock,
  MessageSquare,
  PenTool,
  PlayCircle,
  ShieldCheck,
  Timer,
} from "lucide-react";

function countWords(text = "") {
  const clean = String(text || "").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function boolValue(defaultValue, ...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return Boolean(value);
  }
  return defaultValue;
}

function numberValue(defaultValue, ...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) return numeric;
    }
  }
  return defaultValue;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function isDraftLikeStatus(status) {
  const value = String(status || "draft").toLowerCase();
  return value === "draft" || value === "in progress" || value === "reopened";
}

function formatPastePolicy(value) {
  const clean = String(value || "warn").toLowerCase();
  if (clean === "allow") return "Allowed";
  if (clean === "block") return "Blocked";
  return "Warning shown";
}

function formatDueDate(value) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function limitToSentences(text, maxSentences = 3) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "No instructions provided.";

  const sentences = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  return sentences
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .join(" ");
}

export default function ActiveAssignmentWorkflow() {
  const {
    activeAssignment,
    activeSubmission,
    studentStep,
    setStudentStep,
    setSelectedAssignmentId,
    typedText = "",
  } = useStudentWorkspace();

  const [coachNowTick, setCoachNowTick] = useState(Date.now());

  const assignment = activeAssignment || {};
  const aiSupportSettings = assignment.aiSupportSettings || {};
  const integritySettings = assignment.integritySettings || {};

  const currentDraft =
    typedText ||
    activeSubmission?.draftText ||
    activeSubmission?.content ||
    activeSubmission?.finalText ||
    "";

  const wordCount = countWords(currentDraft);

  const minWords = numberValue(0, assignment.wordCountMin, assignment.minWords);
  const maxWords = numberValue(0, assignment.wordCountMax, assignment.maxWords);

  const aiIdeasCoach = boolValue(
    true,
    aiSupportSettings.aiIdeasCoach,
    assignment.aiIdeasCoach,
    assignment.allowAI
  );

  const coachTimeLimitMinutes = numberValue(
    15,
    aiSupportSettings.coachTimeLimitMinutes,
    assignment.coachTimeLimitMinutes,
    assignment.aiCoachTimeLimitMinutes
  );

  const coachTotalSeconds = Math.max(60, coachTimeLimitMinutes * 60);
  const savedCoachUsedSeconds = Number(activeSubmission?.coachTimeUsedSeconds || 0);
  const coachStartedAt = activeSubmission?.coachStartedAt || null;
  const coachEndedAt = activeSubmission?.coachEndedAt || null;
  const liveCoachSeconds =
    coachStartedAt && !coachEndedAt
      ? Math.max(
          0,
          Math.floor(
            (coachNowTick - new Date(coachStartedAt).getTime()) / 1000
          )
        )
      : 0;
  const coachUsedSeconds = Math.min(
    coachTotalSeconds,
    savedCoachUsedSeconds + liveCoachSeconds
  );
  const coachRemainingSeconds = Math.max(0, coachTotalSeconds - coachUsedSeconds);
  const coachTimeExpired = aiIdeasCoach && coachRemainingSeconds <= 0;

  const autoBuildOutlineFromCoach =
    aiIdeasCoach &&
    boolValue(
      true,
      aiSupportSettings.autoBuildOutlineFromCoach,
      assignment.autoBuildOutlineFromCoach,
      assignment.generateOutlineFromCoach
    );

  const aiDraftFeedback = boolValue(
    true,
    aiSupportSettings.aiDraftFeedback,
    assignment.aiDraftFeedback,
    assignment.aiFeedback
  );

  const writingPlayback = boolValue(
    true,
    aiSupportSettings.writingPlayback,
    assignment.writingPlayback,
    assignment.saveWritingPlayback
  );

  const feedbackRequestLimit = numberValue(
    aiDraftFeedback ? 2 : 0,
    assignment.feedbackRequestLimit,
    assignment.feedbackChecks,
    aiSupportSettings.feedbackRequestLimit,
    aiSupportSettings.feedbackChecks
  );

  const pastePolicy = integritySettings.pastePolicy || assignment.pastePolicy || "warn";

  const logPasteAttempts = boolValue(
    true,
    integritySettings.logPasteAttempts,
    assignment.logPasteAttempts
  );

  const trackFocusLoss = boolValue(
    true,
    integritySettings.trackFocusLoss,
    assignment.trackFocusLoss
  );

  const requireHonorConfirmation = boolValue(
    true,
    integritySettings.requireHonorConfirmation,
    assignment.requireHonorConfirmation
  );

  const enforceWordCount = boolValue(
    true,
    integritySettings.enforceWordCount,
    assignment.enforceWordCount
  );

  const submissionStatus = activeSubmission?.status || "draft";
  const assignmentLocked =
    Boolean(activeSubmission) && !isDraftLikeStatus(submissionStatus);

  const belowMinimum = enforceWordCount && minWords > 0 && wordCount < minWords;
  const aboveMaximum = enforceWordCount && maxWords > 0 && wordCount > maxWords;
  const wordCountIsValid = !enforceWordCount || (!belowMinimum && !aboveMaximum);

  const rubricCriteria = useMemo(() => {
    if (safeArray(assignment.rubricCriteria).length > 0) {
      return safeArray(assignment.rubricCriteria);
    }
    if (safeArray(assignment.rubricSchema?.criteria).length > 0) {
      return safeArray(assignment.rubricSchema.criteria);
    }
    return safeArray(assignment.rubric);
  }, [assignment]);

  const feedbackChecksUsed =
    Number(activeSubmission?.feedbackChecksUsed || 0) ||
    safeArray(activeSubmission?.feedbackHistory).filter((item) => {
      const role = String(item?.role || "").toLowerCase();
      const type = String(item?.type || "").toLowerCase();
      const source = String(item?.source || "").toLowerCase();
      return (
        role === "ai" ||
        type === "draft_review" ||
        type === "ai_feedback" ||
        source === "claude" ||
        source === "ai"
      );
    }).length;

  const feedbackChecksRemaining = Math.max(
    0,
    feedbackRequestLimit - feedbackChecksUsed
  );

  useEffect(() => {
    if (!aiIdeasCoach || !coachStartedAt || coachEndedAt) return undefined;

    const intervalId = window.setInterval(() => {
      setCoachNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [aiIdeasCoach, coachStartedAt, coachEndedAt]);

  useEffect(() => {
    if (!activeAssignment) return;
    if (!aiIdeasCoach && studentStep === 1) {
      setStudentStep(2);
      return;
    }
    if (!aiDraftFeedback && studentStep === 3) {
      setStudentStep(4);
      return;
    }
    if (assignmentLocked && studentStep !== 4) {
      setStudentStep(4);
    }
  }, [
    activeAssignment,
    aiIdeasCoach,
    aiDraftFeedback,
    assignmentLocked,
    studentStep,
    setStudentStep,
  ]);

  if (!activeAssignment) return null;

  const steps = [
    {
      id: 1,
      label: "Brainstorm",
      icon: MessageSquare,
      enabled: aiIdeasCoach && !assignmentLocked,
      disabledReason: "AI ideas coach is disabled.",
    },
    {
      id: 2,
      label: "Draft",
      icon: PenTool,
      enabled: !assignmentLocked,
      disabledReason: "This assignment is locked after submission.",
    },
    {
      id: 3,
      label: "Feedback",
      icon: ClipboardCheck,
      enabled: aiDraftFeedback && wordCount > 0 && !assignmentLocked,
      disabledReason: !aiDraftFeedback
        ? "AI draft feedback is disabled."
        : "Write a draft before requesting feedback.",
    },
    {
      id: 4,
      label: "Submit",
      icon: Lock,
      enabled: wordCount > 0 || assignmentLocked,
      disabledReason: "Write your draft before final submission.",
    },
  ];

  const activeStepMeta = steps.find((step) => step.id === studentStep) || steps[0];
  const activeStepTitle =
    studentStep === 1
      ? "Step 1: Plan Your Ideas"
      : studentStep === 2
      ? "Step 2: Draft Your Response"
      : studentStep === 3
      ? "Step 3: Review AI Feedback"
      : "Step 4: Submit Assignment";

  function renderActiveStepComponent() {
    if (assignmentLocked && studentStep !== 4) {
      return (
        <LockedStepMessage
          title="Assignment submitted"
          message="This assignment has already been submitted and editing is locked."
        />
      );
    }

    switch (studentStep) {
      case 1:
        return aiIdeasCoach ? (
          <Step1IdeasChat />
        ) : (
          <LockedStepMessage
            title="AI ideas coach disabled"
            message="Your teacher disabled brainstorming chat for this assignment. Continue directly to drafting."
          />
        );
      case 2:
        return <Step2DraftingCanvas />;
      case 3:
        return aiDraftFeedback ? (
          <Step3AIFeedback />
        ) : (
          <LockedStepMessage
            title="AI draft feedback disabled"
            message="Your teacher disabled AI draft feedback for this assignment. Continue to final submission."
          />
        );
      case 4:
        return <Step4FinalSummary />;
      default:
        return aiIdeasCoach ? <Step1IdeasChat /> : <Step2DraftingCanvas />;
    }
  }

  const conciseInstructions = limitToSentences(
    assignment.prompt || assignment.instructions || assignment.description,
    3
  );

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
      <div className="flex-1 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col min-h-[620px] lg:h-[calc(100vh-190px)] lg:max-h-[calc(100vh-190px)] shadow-sm">
        <div className="border-b border-slate-100 pb-3 mb-4 flex flex-col xl:flex-row xl:items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedAssignmentId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-700 transition-colors group w-fit shrink-0"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </button>

          <div className="hidden xl:block h-5 w-px bg-slate-200" />

          <div className="min-w-0 xl:flex-1">
            <p className="text-[9px] font-mono font-black uppercase tracking-wider text-blue-700">
              {activeStepMeta?.label || "Assignment Step"}
            </p>
            <h2 className="font-serif text-sm font-bold text-slate-900 truncate">
              {activeStepTitle}
            </h2>
          </div>

          <div className="flex items-center gap-1 bg-[#F8FAFC] border border-slate-200 p-1 rounded-xl overflow-x-auto max-w-full xl:ml-auto">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = studentStep === step.id;
              const isLocked = !step.enabled;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={isLocked}
                  title={isLocked ? step.disabledReason : step.label}
                  onClick={() => setStudentStep(step.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : isLocked
                      ? "text-slate-300 cursor-not-allowed"
                      : "text-slate-500 hover:text-blue-700 hover:bg-blue-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {assignmentLocked && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 flex items-start gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <p>This assignment has been submitted. Editing is locked.</p>
          </div>
        )}

        <CompactAssignmentBrief
          title={assignment.title}
          instructions={conciseInstructions}
        />

        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col pr-1 mt-3">
          {renderActiveStepComponent()}
        </div>
      </div>

      <aside className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto space-y-3 pr-1">
        {aiIdeasCoach && studentStep === 1 && (
          <CoachTimeCard
            remainingSeconds={coachRemainingSeconds}
            expired={coachTimeExpired}
            limitMinutes={coachTimeLimitMinutes}
          />
        )}

        <ExpandablePanel
          icon={Bot}
          title="AI Support"
          description="Student tools enabled by your teacher."
        >
          <SupportRow
            icon={MessageSquare}
            label="Ideas coach"
            value={aiIdeasCoach ? "Active" : "Off"}
            active={aiIdeasCoach}
            description="Use the AI coach during brainstorming to understand the task, organize ideas, and plan before drafting."
          />
          <SupportRow
            icon={Timer}
            label="Coach limit"
            value={aiIdeasCoach ? `${coachTimeLimitMinutes} min` : "Disabled"}
            active={aiIdeasCoach}
            description={`The brainstorming coach is available for up to ${coachTimeLimitMinutes} minutes for this assignment.`}
          />
          <SupportRow
            icon={ListChecks}
            label="Auto-outline"
            value={autoBuildOutlineFromCoach ? "Active" : "Off"}
            active={autoBuildOutlineFromCoach}
            description="Creates a notes-only outline from the planning conversation before the student begins drafting."
          />
          <SupportRow
            icon={ClipboardCheck}
            label="Draft feedback"
            value={aiDraftFeedback ? "Active" : "Off"}
            active={aiDraftFeedback}
            description="Allows the student to request AI feedback on the current draft without having the AI write the assignment."
          />
          <SupportRow
            icon={PlayCircle}
            label="Writing playback"
            value={writingPlayback ? "Active" : "Off"}
            active={writingPlayback}
            description="Records writing events and draft development so the teacher can review how the text changed over time."
          />
          <SupportRow
            icon={CheckCircle2}
            label="Feedback checks"
            value={`${feedbackChecksRemaining}/${feedbackRequestLimit} left`}
            active={aiDraftFeedback && feedbackRequestLimit > 0}
            description={`The student has ${feedbackChecksRemaining} of ${feedbackRequestLimit} AI feedback checks remaining.`}
          />
        </ExpandablePanel>

        <ExpandablePanel
          icon={ShieldCheck}
          title="Integrity Rules"
          description="Writing and submission rules."
          defaultOpen
        >
          <SupportRow
            icon={ShieldCheck}
            label="Paste policy"
            value={formatPastePolicy(pastePolicy)}
            active={pastePolicy !== "allow"}
            description="Controls what happens when pasted text is detected. Depending on the teacher setting, pasting may be allowed, warned, or blocked."
          />
          <SupportRow
            icon={ClipboardCheck}
            label="Paste logging"
            value={logPasteAttempts ? "Active" : "Off"}
            active={logPasteAttempts}
            description="Records paste attempts for teacher review. A logged paste is a review signal, not an automatic grade penalty."
          />
          <SupportRow
            icon={AlertCircle}
            label="Focus tracking"
            value={trackFocusLoss ? "Active" : "Off"}
            active={trackFocusLoss}
            description="Records when the assignment window loses focus or the student switches to another tab."
          />
          <SupportRow
            icon={CheckCircle2}
            label="Honor statement"
            value={requireHonorConfirmation ? "Required" : "Not required"}
            active={requireHonorConfirmation}
            description="Requires the student to confirm the academic honor statement before final submission."
          />
          <SupportRow
            icon={FileText}
            label="Word-count rule"
            value={enforceWordCount ? "Active" : "Off"}
            active={enforceWordCount}
            description="Checks the draft against the required minimum and maximum word limits before submission."
          />
          <SupportRow
            icon={Lock}
            label="After submission"
            value="Locked"
            active
            description="After final submission, the assignment becomes read-only unless the teacher reopens it."
          />
        </ExpandablePanel>

        <AssignmentInfoGrid
          minWords={minWords}
          maxWords={maxWords}
          wordCount={wordCount}
          dueDate={assignment.dueDate}
          wordCountIsValid={wordCountIsValid}
          belowMinimum={belowMinimum}
          aboveMaximum={aboveMaximum}
        />
      </aside>
    </div>
  );
}

function formatCompactSeconds(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function CoachTimeCard({ remainingSeconds, expired, limitMinutes }) {
  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm ${
        expired
          ? "border-amber-200 bg-amber-50"
          : "border-blue-200 bg-blue-50/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-9 h-9 rounded-xl border bg-white flex items-center justify-center shrink-0 ${
              expired
                ? "border-amber-200 text-amber-700"
                : "border-blue-200 text-blue-700"
            }`}
          >
            <Timer className="w-4 h-4" />
          </span>

          <div className="min-w-0">
            <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-500">
              Ideas Coach Time
            </p>
            <p
              className={`text-lg font-mono font-black ${
                expired ? "text-amber-800" : "text-blue-800"
              }`}
            >
              {expired ? "Finished" : `${formatCompactSeconds(remainingSeconds)} left`}
            </p>
          </div>
        </div>

        <span className="rounded-lg border border-white/80 bg-white px-2 py-1 text-[9px] font-mono font-bold uppercase text-slate-500">
          {limitMinutes} min
        </span>
      </div>
    </section>
  );
}

function CompactAssignmentBrief({ title, instructions }) {
  return (
    <section className="shrink-0 rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="w-9 h-9 rounded-xl bg-white border border-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-sm">
          <FileText className="w-4 h-4" />
        </span>

        <div className="min-w-0">
          <p className="text-[9px] font-mono font-black uppercase tracking-widest text-blue-700">
            Assignment Brief
          </p>
          <h2 className="font-serif text-base font-bold text-slate-950 mt-1">
            {title || "Untitled Assignment"}
          </h2>
          <p className="text-[11px] leading-relaxed text-slate-600 mt-1.5">
            {instructions}
          </p>
        </div>
      </div>
    </section>
  );
}

function AssignmentInfoGrid({
  minWords,
  maxWords,
  wordCount,
  dueDate,
  wordCountIsValid,
  belowMinimum,
  aboveMaximum,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-3.5 h-3.5 text-blue-700" />
        <p className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-700">
          Assignment Info
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <InfoMetric
          label="Required"
          value={maxWords > 0 ? `${minWords || 0}–${maxWords}` : `${minWords || 0}+`}
          suffix="words"
        />
        <InfoMetric
          label="Current"
          value={wordCount}
          suffix="words"
          tone={wordCountIsValid ? "blue" : "amber"}
        />
        <InfoMetric
          label="Due"
          value={formatDueDate(dueDate)}
          compact
        />
      </div>

      {(belowMinimum || aboveMaximum) && (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] leading-relaxed text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {belowMinimum
              ? `At least ${minWords} words are required before submission.`
              : `The draft is above the ${maxWords}-word maximum.`}
          </span>
        </div>
      )}
    </section>
  );
}

function InfoMetric({ label, value, suffix, tone = "slate", compact = false }) {
  const tones = {
    slate: "border-slate-200 bg-[#F8FAFC] text-slate-800",
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-xl border p-2.5 min-w-0 ${tones[tone] || tones.slate}`}>
      <p className="text-[8px] font-mono font-black uppercase tracking-wider opacity-55">
        {label}
      </p>
      <p className={`${compact ? "text-[10px]" : "text-xs"} font-mono font-black mt-1 truncate`} title={String(value)}>
        {value}
      </p>
      {suffix && <p className="text-[8px] mt-0.5 opacity-60">{suffix}</p>}
    </div>
  );
}

function ExpandablePanel({ icon: Icon, title, description, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[#F8FAFC] transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wider text-slate-900">{title}</p>
            <p className="text-[10px] text-slate-500 mt-0.5 truncate">{description}</p>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && <div className="border-t border-slate-100 p-4 space-y-2">{children}</div>}
    </div>
  );
}

function SupportRow({ icon: Icon, label, value, active, description }) {
  const rowRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  function showTooltip() {
    if (!description || !rowRef.current) return;

    const rect = rowRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 24);
    const margin = 12;

    let left = rect.left - width - 10;
    let top = rect.top;

    if (left < margin) {
      left = Math.min(
        window.innerWidth - width - margin,
        rect.right + 10
      );
    }

    if (top + 140 > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - 140 - margin);
    }

    setTooltip({ left, top, width });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  return (
    <>
      <div
        ref={rowRef}
        tabIndex={0}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-[#F8FAFC] px-3 py-2 cursor-help outline-none transition-all hover:border-blue-200 hover:bg-blue-50/50 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className={`w-3.5 h-3.5 shrink-0 ${
              active ? "text-blue-700" : "text-slate-400"
            }`}
          />
          <span className="text-[10px] font-bold text-slate-600 truncate">
            {label}
          </span>
        </div>

        <span
          className={`text-[9px] font-mono font-black uppercase ${
            active ? "text-blue-700" : "text-slate-400"
          }`}
        >
          {value}
        </span>
      </div>

      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[2147483647] rounded-xl border border-blue-200 bg-white px-3 py-2.5 shadow-2xl"
            style={{
              left: `${tooltip.left}px`,
              top: `${tooltip.top}px`,
              width: `${tooltip.width}px`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-700">
                <Icon className="h-3.5 w-3.5" />
              </span>

              <div className="min-w-0">
                <p className="text-[10px] font-mono font-black uppercase tracking-wider text-blue-700">
                  {label}
                </p>
                <p className="text-[9px] font-mono font-bold uppercase text-slate-400">
                  {value}
                </p>
              </div>
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
              {description}
            </p>
          </div>,
          document.body
        )}
    </>
  );
}

function LockedStepMessage({ title, message }) {
  return (
    <div className="h-full min-h-[280px] rounded-2xl border border-slate-200 bg-[#F8FAFC] flex items-center justify-center p-6 text-center">
      <div className="max-w-sm">
        <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-500">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="font-serif text-lg font-bold text-slate-900 mt-3">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{message}</p>
      </div>
    </div>
  );
}