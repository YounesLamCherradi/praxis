import React, { useEffect } from "react";
import { useStudentWorkspace } from "../../contexts/StudentWorkspaceContext";

import Step1IdeasChat from "./steps/Step1IdeasChat";
import Step2DraftingCanvas from "./steps/Step2DraftingCanvas";
import Step3AIFeedback from "./steps/Step3AIFeedback";
import Step4FinalSummary from "./steps/Step4FinalSummary";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Info,
  Lock,
  MessageSquare,
  PenTool,
  X,
} from "lucide-react";

function countWords(text = "") {
  const clean = String(text || "").trim();

  if (!clean) {
    return 0;
  }

  return clean.split(/\s+/).filter(Boolean).length;
}

function boolValue(defaultValue, ...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return Boolean(value);
    }
  }

  return defaultValue;
}

function normalizeWorkflowStatus(status) {
  const value = String(
    status || "draft"
  )
    .trim()
    .toLowerCase();

  if (value === "in progress") {
    return "draft";
  }

  return value;
}

function hasWorkflowSubmissionEvidence(submission = {}) {
  const submittedText = String(
    submission.submittedText ||
      submission.submissionText ||
      submission.response ||
      submission.essay ||
      ""
  ).trim();

  return Boolean(
    submission.submittedAt ||
      submission.resubmittedAt ||
      submittedText
  );
}

function isWorkflowSubmissionLocked(submission = {}) {
  if (!submission) return false;

  const status = normalizeWorkflowStatus(
    submission.status
  );

  if (
    status === "draft" ||
    status === "reopened" ||
    status === "missing"
  ) {
    return false;
  }

  if (status === "late") {
    return hasWorkflowSubmissionEvidence(
      submission
    );
  }

  if (
    status === "submitted" ||
    status === "graded"
  ) {
    return true;
  }

  return hasWorkflowSubmissionEvidence(
    submission
  );
}

function limitToSentences(text, maxSentences = 3) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "No instructions provided.";
  }

  const sentences =
    clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];

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
    goToStudentStep,
    studentWorkflowNotice,
    showStudentWorkflowNotice,
    clearStudentWorkflowNotice,
    confirmStudentWorkflowNotice,
    closeStudentAssignment,
    typedText = "",
  } = useStudentWorkspace();

  const assignment = activeAssignment || {};
  const aiSupportSettings = assignment.aiSupportSettings || {};

  const currentDraft =
    studentStep >= 3
      ? String(
          typedText ??
            activeSubmission?.finalText ??
            activeSubmission?.draftText ??
            ""
        )
      : String(
          typedText ??
            activeSubmission?.draftText ??
            activeSubmission?.content ??
            ""
        );

  const wordCount = countWords(currentDraft);

  const aiIdeasCoach = boolValue(
    true,
    aiSupportSettings.aiIdeasCoach,
    assignment.aiIdeasCoach,
    assignment.allowAI
  );

  const aiDraftFeedback = boolValue(
    true,
    aiSupportSettings.aiDraftFeedback,
    assignment.aiDraftFeedback,
    assignment.aiFeedback
  );

  const assignmentLocked =
    isWorkflowSubmissionLocked(
      activeSubmission
    );

  useEffect(() => {
    if (!activeAssignment) {
      return;
    }

    if (!aiIdeasCoach && studentStep === 1) {
      goToStudentStep(2, {
        force: true,
      });
      return;
    }

    if (!aiDraftFeedback && studentStep === 3) {
      goToStudentStep(4, {
        force: true,
        skipFeedbackPrompt: true,
      });
      return;
    }

    if (assignmentLocked && studentStep !== 4) {
      goToStudentStep(4, {
        force: true,
        skipFeedbackPrompt: true,
      });
    }
  }, [
    activeAssignment?.id,
    aiIdeasCoach,
    aiDraftFeedback,
    assignmentLocked,
    studentStep,
    goToStudentStep,
  ]);

  if (!activeAssignment) {
    return null;
  }

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
      enabled:
        aiDraftFeedback &&
        wordCount > 0 &&
        !assignmentLocked,
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

  const activeStepMeta =
    steps.find((step) => step.id === studentStep) || steps[0];

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
        return aiIdeasCoach ? (
          <Step1IdeasChat />
        ) : (
          <Step2DraftingCanvas />
        );
    }
  }

  const conciseInstructions = limitToSentences(
    assignment.prompt ||
      assignment.instructions ||
      assignment.description,
    3
  );

  return (
    <div className="flex-1 min-h-0">
      <div className="flex min-h-[620px] w-full flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:h-[calc(100vh-190px)] lg:max-h-[calc(100vh-190px)]">
        <div className="mb-4 flex shrink-0 flex-col gap-3 border-b border-slate-100 pb-3 xl:flex-row xl:items-center">
          <button
            type="button"
            onClick={closeStudentAssignment}
            className="group inline-flex w-fit shrink-0 items-center gap-1.5 text-xs font-bold text-slate-500 transition-colors hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </button>

          <div className="hidden h-5 w-px bg-slate-200 xl:block" />

          <div className="min-w-0 xl:flex-1">
            <p className="font-mono text-[9px] font-black uppercase tracking-wider text-blue-700">
              {activeStepMeta?.label || "Assignment Step"}
            </p>

            <h2 className="truncate font-serif text-sm font-bold text-slate-900">
              {activeStepTitle}
            </h2>
          </div>

          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-[#F8FAFC] p-1 xl:ml-auto">
            {steps.map((step) => {
              const Icon = step.icon;
              const isActive = studentStep === step.id;
              const isLocked = !step.enabled;

              return (
                <button
                  key={step.id}
                  type="button"
                  aria-disabled={isLocked}
                  title={step.label}
                  onClick={() => {
                    if (isLocked) {
                      showStudentWorkflowNotice?.({
                        tone: "amber",
                        title: `${step.label} is not available yet`,
                        message: step.disabledReason,
                      });
                      return;
                    }

                    goToStudentStep(step.id);
                  }}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : isLocked
                        ? "cursor-pointer text-slate-300 hover:bg-amber-50 hover:text-amber-700"
                        : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {assignmentLocked && (
          <div className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This assignment has been submitted. Editing is locked.
            </p>
          </div>
        )}

        <CompactAssignmentBrief
          title={assignment.title}
          instructions={conciseInstructions}
        />

        {studentWorkflowNotice && (
          <WorkflowNoticeBox
            notice={studentWorkflowNotice}
            onPrimary={confirmStudentWorkflowNotice}
            onSecondary={clearStudentWorkflowNotice}
            onClose={clearStudentWorkflowNotice}
          />
        )}

        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          {renderActiveStepComponent()}
        </div>
      </div>
    </div>
  );
}

function WorkflowNoticeBox({
  notice,
  onPrimary,
  onSecondary,
  onClose,
}) {
  const tone = notice?.tone || "amber";

  const toneMap = {
    amber: {
      shell: "border-amber-200 bg-amber-50 text-amber-950",
      icon: "border-amber-200 bg-white text-amber-700",
      primary: "bg-amber-600 text-white hover:bg-amber-700",
      Icon: AlertTriangle,
    },
    red: {
      shell: "border-red-200 bg-red-50 text-red-950",
      icon: "border-red-200 bg-white text-red-700",
      primary: "bg-red-600 text-white hover:bg-red-700",
      Icon: AlertTriangle,
    },
    blue: {
      shell: "border-blue-200 bg-blue-50 text-blue-950",
      icon: "border-blue-200 bg-white text-blue-700",
      primary: "bg-blue-600 text-white hover:bg-blue-700",
      Icon: Info,
    },
    green: {
      shell: "border-emerald-200 bg-emerald-50 text-emerald-950",
      icon: "border-emerald-200 bg-white text-emerald-700",
      primary: "bg-emerald-600 text-white hover:bg-emerald-700",
      Icon: CheckCircle2,
    },
  };

  const style = toneMap[tone] || toneMap.amber;
  const Icon = style.Icon;
  const hasPendingAction = Boolean(
    notice?.pendingTransition &&
      notice?.primaryLabel
  );

  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 shrink-0 rounded-2xl border px-4 py-3 shadow-sm ${style.shell}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${style.icon}`}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-xs font-bold">
                {notice?.title || "Check this step"}
              </h3>

              <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                {notice?.message}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/15 bg-white/60 opacity-60 transition-all hover:opacity-100"
              aria-label="Close message"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {hasPendingAction ? (
              <>
                <button
                  type="button"
                  onClick={onPrimary}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[11px] font-bold transition-all ${style.primary}`}
                >
                  {notice.primaryLabel}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>

                <button
                  type="button"
                  onClick={onSecondary}
                  className="rounded-xl border border-current/15 bg-white px-4 py-2.5 text-[11px] font-bold opacity-80 transition-all hover:opacity-100"
                >
                  {notice.secondaryLabel || "Stay here"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-current/15 bg-white px-4 py-2.5 text-[11px] font-bold opacity-80 transition-all hover:opacity-100"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CompactAssignmentBrief({
  title,
  instructions,
}) {
  return (
    <section className="shrink-0 rounded-2xl border border-blue-100 bg-blue-50/40 px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm">
          <FileText className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <p className="font-mono text-[9px] font-black uppercase tracking-widest text-blue-700">
            Assignment Brief
          </p>

          <h2 className="mt-1 font-serif text-base font-bold text-slate-950">
            {title || "Untitled Assignment"}
          </h2>

          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
            {instructions}
          </p>
        </div>
      </div>
    </section>
  );
}

function LockedStepMessage({
  title,
  message,
}) {
  return (
    <div className="flex h-full min-h-[280px] items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
          <Lock className="h-5 w-5" />
        </div>

        <h3 className="mt-3 font-serif text-lg font-bold text-slate-900">
          {title}
        </h3>

        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {message}
        </p>
      </div>
    </div>
  );
}