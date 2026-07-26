import React, { useEffect, useRef, useState } from "react";
import { useStudentWorkspace } from "../../hooks/useStudentWorkspace";

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

  const rubricCriteria = Array.isArray(assignment?.rubricSchema?.criteria)
    ? assignment.rubricSchema.criteria
    : Array.isArray(assignment?.rubric)
      ? assignment.rubric
      : [];
  const selfRubricScores = activeSubmission?.selfRubricScores || {};
  const rubricComplete = rubricCriteria.length === 0 || rubricCriteria.every(
    (criterion) => {
      const entry = selfRubricScores?.[criterion.id];
      return Boolean(entry?.bandId || entry?.score !== undefined);
    }
  );
  const [finalStageView, setFinalStageView] = useState(() =>
    rubricComplete ? "submit" : "rubric"
  );
  const lastDraftFeedbackStepRef = useRef(3);

  useEffect(() => {
    setFinalStageView(rubricComplete ? "submit" : "rubric");
  }, [activeAssignment?.id, rubricComplete]);

  useEffect(() => {
    if (studentStep === 2 || studentStep === 3) {
      lastDraftFeedbackStepRef.current = studentStep;
    }
  }, [studentStep]);

  useEffect(() => {
    if (rubricCriteria.length === 0 && finalStageView === "rubric") {
      setFinalStageView("submit");
    }
  }, [rubricCriteria.length, finalStageView]);

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
    activeAssignment,
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
      id: "coach",
      targetStep: 1,
      label: "Coach",
      icon: MessageSquare,
      enabled: aiIdeasCoach && !assignmentLocked,
      disabledReason: "Coach is disabled.",
      active: studentStep === 1,
      completed: studentStep > 1 || wordCount > 0 || assignmentLocked,
    },
    {
      id: "draft-feedback",
      targetStep: studentStep === 3 ? 3 : 2,
      label: "Draft & Feedback",
      icon: PenTool,
      enabled: !assignmentLocked,
      disabledReason: "This assignment is locked after submission.",
      active: studentStep === 2 || studentStep === 3,
      completed: studentStep === 4 || assignmentLocked,
    },
    {
      id: "rubric",
      targetStep: 4,
      label: "Rubric",
      icon: ClipboardCheck,
      enabled:
        rubricCriteria.length > 0 &&
        wordCount > 0 &&
        !assignmentLocked,
      disabledReason:
        rubricCriteria.length === 0
          ? "No rubric is attached to this assignment."
          : "Write a draft before checking the rubric.",
      active:
        studentStep === 4 &&
        finalStageView === "rubric" &&
        !assignmentLocked,
      completed: rubricComplete || assignmentLocked,
    },
    {
      id: "submit",
      targetStep: 4,
      label: "Submit",
      icon: Lock,
      enabled: (wordCount > 0 && rubricComplete) || assignmentLocked,
      disabledReason: !rubricComplete
        ? "Complete the rubric check before submitting."
        : "Write your draft before final submission.",
      active:
        studentStep === 4 &&
        (assignmentLocked || finalStageView === "submit"),
      completed: assignmentLocked,
    },
  ];

  const activeStepMeta =
    steps.find((step) => step.active) || steps[0];

  const activeStepTitle =
    studentStep === 1
      ? "Step 1: Plan Your Ideas"
      : studentStep === 2 || studentStep === 3
        ? "Step 2: Draft & Feedback"
          : assignmentLocked || finalStageView === "submit"
            ? "Step 4: Submit Assignment"
            : "Step 3: Rubric Check";

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
            title="Coach disabled"
            message="Your instructor disabled brainstorming chat for this assignment. Continue directly to drafting."
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
            message="Your instructor disabled AI draft feedback for this assignment. Continue to final submission."
          />
        );

      case 4:
        return (
          <Step4FinalSummary
            showRubricOnOpen={finalStageView === "rubric"}
            onRubricSaved={() => setFinalStageView("submit")}
            onRubricClosed={() => setFinalStageView("submit")}
            rubricBackStep={lastDraftFeedbackStepRef.current}
          />
        );

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

          <div
            id="student-workflow-alert-slot"
            className="flex min-w-0 flex-1 justify-center"
          />

          <div className="flex max-w-full items-center overflow-x-auto rounded-2xl border border-slate-200 bg-[#F8FAFC] p-1.5 xl:ml-auto">
            {steps.map((step, index) => {
              const isActive = step.active;
              const isLocked = !step.enabled;
              const isCompleted = step.completed && !isActive;
              const statusLabel = isActive
                ? step.id === "rubric" && rubricComplete
                  ? "Reviewing"
                  : "In progress"
                : isCompleted
                  ? "Complete"
                  : isLocked
                    ? "Locked"
                    : "Not started";

              return (
                <React.Fragment key={step.id}>
                  {index > 0 && (
                    <span
                      aria-hidden="true"
                      className={`h-px w-3 shrink-0 sm:w-5 ${
                        isCompleted || isActive ? "bg-blue-300" : "bg-slate-200"
                      }`}
                    />
                  )}

                  <button
                    type="button"
                    aria-label={step.label}
                    aria-current={isActive ? "step" : undefined}
                    aria-disabled={isLocked}
                    title={`${step.label} · ${statusLabel}`}
                    onClick={() => {
                      if (isLocked) {
                        showStudentWorkflowNotice?.({
                          tone: "amber",
                          title: `${step.label} is not available yet`,
                          message: step.disabledReason,
                        });
                        return;
                      }

                      if (step.id === "rubric") {
                        setFinalStageView("rubric");
                      } else if (step.id === "submit") {
                        setFinalStageView("submit");
                      }

                      goToStudentStep(
                        step.targetStep,
                        step.id === "submit"
                          ? { skipFeedbackPrompt: true }
                          : undefined
                      );
                    }}
                    className={`flex min-w-[112px] items-center gap-2 whitespace-nowrap rounded-xl border px-2.5 py-2 text-left transition-all ${
                      isActive
                        ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                        : isCompleted
                          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : isLocked
                            ? "cursor-pointer border-transparent text-slate-300 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                            : "border-transparent bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${
                        isActive
                          ? "border-white/40 bg-white/15 text-white"
                          : isCompleted
                            ? "border-emerald-300 bg-white text-emerald-700"
                            : isLocked
                              ? "border-slate-200 bg-slate-100 text-slate-400"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isLocked ? (
                        <Lock className="h-3 w-3" />
                      ) : (
                        index + 1
                      )}
                    </span>

                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold leading-tight">
                        {step.label}
                      </span>
                      <span
                        className={`mt-0.5 block text-[8px] font-mono font-bold uppercase tracking-wide ${
                          isActive ? "text-blue-100" : "opacity-70"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </span>
                  </button>
                </React.Fragment>
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
            key={studentWorkflowNotice.id}
            notice={studentWorkflowNotice}
            onPrimary={() => confirmStudentWorkflowNotice()}
            onSecondary={() => clearStudentWorkflowNotice()}
            onClose={() => clearStudentWorkflowNotice()}
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

  const noticeCard = (
    <div
      role={hasPendingAction ? "dialog" : "status"}
      aria-modal={hasPendingAction ? "true" : undefined}
      aria-label={notice?.title || "Check this step"}
      aria-live={hasPendingAction ? undefined : "polite"}
      className={`w-full rounded-2xl border px-4 py-4 shadow-xl ${style.shell} ${
        hasPendingAction ? "max-w-lg" : "mt-3 shrink-0"
      }`}
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

  if (hasPendingAction) {
    return (
      <div className="fixed inset-0 z-[2147483645] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
        {noticeCard}
      </div>
    );
  }

  return noticeCard;
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
