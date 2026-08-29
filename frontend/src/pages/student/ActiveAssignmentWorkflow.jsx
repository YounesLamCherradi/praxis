import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  ChevronDown,
  ClipboardCheck,
  FileText,
  Info,
  Lock,
  Loader2,
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

const STUDENT_FINAL_STAGE_VIEW_STORAGE_KEY =
  "praxis-student-final-stage-view";

function loadStudentFinalStageViews() {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      STUDENT_FINAL_STAGE_VIEW_STORAGE_KEY
    );

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);

    return parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed)
      ? parsed
      : {};
  } catch (error) {
    console.warn(
      "Could not restore student final-stage view:",
      error
    );

    return {};
  }
}

function loadStudentFinalStageView(
  assignmentId,
  fallback = "rubric"
) {
  if (!assignmentId) {
    return fallback;
  }

  const savedViews =
    loadStudentFinalStageViews();

  const saved =
    savedViews[String(assignmentId)];

  return saved === "submit" ||
    saved === "rubric"
    ? saved
    : fallback;
}

function saveStudentFinalStageView(
  assignmentId,
  view
) {
  if (
    typeof window === "undefined" ||
    !assignmentId
  ) {
    return;
  }

  const normalized =
    view === "submit"
      ? "submit"
      : "rubric";

  try {
    const current =
      loadStudentFinalStageViews();

    window.localStorage.setItem(
      STUDENT_FINAL_STAGE_VIEW_STORAGE_KEY,
      JSON.stringify({
        ...current,
        [String(assignmentId)]:
          normalized,
      })
    );
  } catch (error) {
    console.warn(
      "Could not persist student final-stage view:",
      error
    );
  }
}

export default function ActiveAssignmentWorkflow() {
  const {
    activeAssignment,
    activeSubmission,
    openingAssignmentId,
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
  const [
    finalStageView,
    setFinalStageViewState,
  ] = useState(() =>
    loadStudentFinalStageView(
      activeAssignment?.id,
      rubricComplete ? "submit" : "rubric"
    )
  );

  function setFinalStageView(nextView) {
    const normalized =
      nextView === "submit"
        ? "submit"
        : "rubric";

    setFinalStageViewState(normalized);

    if (activeAssignment?.id) {
      saveStudentFinalStageView(
        activeAssignment.id,
        normalized
      );
    }
  }

  const lastDraftFeedbackStepRef = useRef(3);

  useEffect(() => {
    if (!activeAssignment?.id) {
      return;
    }

    setFinalStageViewState(
      loadStudentFinalStageView(
        activeAssignment.id,
        rubricComplete
          ? "submit"
          : "rubric"
      )
    );
  }, [activeAssignment?.id]);

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
    if (!activeAssignment || openingAssignmentId) {
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
    openingAssignmentId,
    aiIdeasCoach,
    aiDraftFeedback,
    assignmentLocked,
    studentStep,
    goToStudentStep,
  ]);

  if (!activeAssignment) {
    return null;
  }

  if (openingAssignmentId) {
    return (
      <div className="flex min-h-[420px] w-full items-center justify-center rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-center" role="status" aria-live="polite">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
          <h2 className="mt-4 font-serif text-lg font-bold text-slate-950">
            Opening assignment…
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Loading your latest saved work.
          </p>
        </div>
      </div>
    );
  }

  const steps = [
    {
      id: "coach",
      targetStep: 1,
      label: "Outline",
      icon: MessageSquare,
      enabled: aiIdeasCoach && !assignmentLocked,
      disabledReason: "Coach is disabled.",
      active: studentStep === 1,
      completed: studentStep > 1 || wordCount > 0 || assignmentLocked,
    },
    {
      id: "draft-feedback",
      targetStep: studentStep === 3 ? 3 : 2,
      label: "Draft",
      icon: PenTool,
      enabled: !assignmentLocked,
      disabledReason: "This assignment is locked after submission.",
      active: studentStep === 2 || studentStep === 3,
      completed: studentStep === 4 || assignmentLocked,
    },
    {
      id: "rubric",
      targetStep: 4,
      label: "Reflection",
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
      enabled: wordCount > 0 || assignmentLocked,
      disabledReason: "Write your draft before final submission.",
      active:
        studentStep === 4 &&
        (assignmentLocked || finalStageView === "submit"),
      completed: assignmentLocked,
    },
  ];

  const activeStepMeta =
    steps.find((step) => step.active) || steps[0];
  const activeStepNumber = Math.max(
    1,
    steps.findIndex((step) => step.id === activeStepMeta.id) + 1
  );

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
      <div className="student-assignment-shell flex min-h-[520px] w-full flex-col rounded-xl border border-slate-200 bg-white p-2 shadow-sm sm:rounded-2xl sm:p-4 lg:h-[calc(100dvh-190px)] lg:min-h-0 lg:max-h-[calc(100dvh-190px)]">
        <div className="student-workflow-header mb-2.5 flex shrink-0 flex-col gap-2 border-b border-slate-100 pb-2.5 sm:mb-4 sm:gap-3 sm:pb-3 xl:flex-row xl:items-center">
          <button
            type="button"
            onClick={closeStudentAssignment}
            className="group inline-flex w-fit shrink-0 items-center gap-1 text-[10px] font-bold text-slate-500 transition-colors hover:text-blue-700 sm:gap-1.5 sm:text-xs"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </button>

          <div className="hidden h-5 w-px bg-slate-200 xl:block" />

          <div className="flex min-w-0 items-center gap-2 xl:flex-1">
            <p className="font-mono text-[9px] font-black uppercase tracking-wider text-blue-700">
              {activeStepMeta?.label || "Assignment Step"}
            </p>
            <span className="text-slate-300">·</span>
            <h2 className="truncate font-serif text-sm font-bold text-slate-900">
              Step {activeStepNumber} of {steps.length}
            </h2>
          </div>

          <div
            id="student-workflow-alert-slot"
            className="flex min-w-0 flex-1 justify-center"
          />

          <div className="grid w-full max-w-full grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-[#F8FAFC] p-1 sm:flex sm:w-auto sm:items-center sm:gap-0 sm:overflow-x-auto sm:rounded-2xl sm:p-1.5 xl:ml-auto">
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
                      className={`hidden h-px w-3 shrink-0 sm:block sm:w-5 ${
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
                          title: assignmentLocked
                            ? "Assignment locked"
                            : `${step.label} is not available yet`,
                          message: assignmentLocked
                            ? "This assignment is locked after submission."
                            : step.disabledReason,
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
                    className={`flex min-w-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-lg border px-1 py-1.5 text-center transition-all sm:min-w-[112px] sm:justify-start sm:gap-2 sm:rounded-xl sm:px-2.5 sm:py-2 sm:text-left ${
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
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px] font-black sm:h-6 sm:w-6 sm:text-[10px] ${
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
                      <span className="block truncate text-[8px] font-bold leading-tight sm:text-[11px]">
                        {step.label}
                      </span>
                      <span
                        className={`mt-0.5 hidden text-[8px] font-mono font-bold uppercase tracking-wide sm:block ${
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

        {!assignmentLocked && (
          <CompactAssignmentBrief
            title={assignment.title}
            instructions={conciseInstructions}
            compact
          />
        )}

        {studentWorkflowNotice && (
          <WorkflowNoticeBox
            key={studentWorkflowNotice.id}
            notice={studentWorkflowNotice}
            onPrimary={() => {
              if (
                studentWorkflowNotice?.title ===
                "Feedback checks are still available"
              ) {
                try {
                  window.sessionStorage.setItem(
                    `praxis-request-inline-feedback:${activeAssignment?.id}`,
                    "1"
                  );
                } catch {
                  // AI Feedback can still be opened if browser storage is unavailable.
                }

                clearStudentWorkflowNotice();

                goToStudentStep(3, {
                  draftText: typedText,
                  currentText: typedText,
                });

                return;
              }

              confirmStudentWorkflowNotice();
            }}
            onSecondary={() => {
              if (
                studentWorkflowNotice?.title ===
                "Feedback checks are still available"
              ) {
                confirmStudentWorkflowNotice();
                return;
              }

              clearStudentWorkflowNotice();
            }}
            onClose={() => clearStudentWorkflowNotice()}
          />
        )}

        <div className="student-assignment-step mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto sm:mt-3 sm:pr-1">
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
      className={`w-full border shadow-xl ${style.shell} ${
        hasPendingAction
          ? "max-w-lg rounded-t-2xl px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4"
          : "mt-2 shrink-0 rounded-xl px-2.5 py-2.5 sm:mt-3 sm:rounded-2xl sm:px-4 sm:py-4"
      }`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border sm:h-9 sm:w-9 sm:rounded-xl ${style.icon}`}
        >
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 sm:gap-3">
            <div>
              <h3 className="pr-7 text-[11px] font-bold leading-tight sm:pr-0 sm:text-xs">
                {notice?.title || "Check this step"}
              </h3>

              <p className="mt-0.5 text-[9px] leading-4 opacity-90 sm:mt-1 sm:text-[11px] sm:leading-relaxed">
                {notice?.message}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/15 bg-white/60 opacity-60 transition-all hover:opacity-100 sm:h-7 sm:w-7 sm:rounded-lg"
              aria-label="Close message"
            >
              <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-1 gap-2 sm:mt-3 sm:flex sm:flex-wrap sm:items-center">
            {hasPendingAction ? (
              <>
                <button
                  type="button"
                  onClick={onPrimary}
                  className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-bold transition-all sm:w-auto sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-[11px] ${style.primary}`}
                >
                  {notice.primaryLabel}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={onSecondary}
                  className="min-h-10 w-full rounded-lg border border-current/15 bg-white px-3 py-2 text-[10px] font-bold opacity-80 transition-all hover:opacity-100 sm:w-auto sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-[11px]"
                >
                  {notice.secondaryLabel || "Stay here"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="min-h-8 rounded-lg border border-current/15 bg-white px-3 py-1.5 text-[10px] font-bold opacity-80 transition-all hover:opacity-100 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-[11px]"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (
    hasPendingAction &&
    typeof document !== "undefined"
  ) {
    return createPortal(
      <div className="fixed inset-0 z-[2147483646] flex items-end justify-center p-0 sm:items-center sm:p-3 xl:p-4">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-slate-950/45 backdrop-blur-[4px]"
        />

        <div className="relative z-10 flex w-full justify-center pb-[env(safe-area-inset-bottom)] sm:pb-0">
          {noticeCard}
        </div>
      </div>,
      document.body
    );
  }

  return noticeCard;
}

function CompactAssignmentBrief({
  title,
  instructions,
  compact = false,
}) {
  return (
    <section className="student-assignment-brief relative shrink-0 overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-50/40 shadow-sm sm:rounded-2xl">
      <span className="absolute inset-y-0 left-0 w-1 bg-blue-600 sm:w-1.5" />

      {/* Mobile brief */}
      <div className="px-3 py-2.5 sm:hidden">
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-600/20">
            <FileText className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[8px] font-black uppercase tracking-wider text-blue-700">
              Assignment Brief
            </p>

            <h2 className="mt-0.5 font-serif text-[15px] font-black leading-5 text-slate-950">
              {title || "Untitled Assignment"}
            </h2>
          </div>
        </div>

        <details className="group mt-2 border-t border-blue-100 pt-2">
          <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-white/80 px-2.5 py-1.5 text-[10px] font-bold text-blue-700 ring-1 ring-blue-100 [&::-webkit-details-marker]:hidden">
            <span>Read instructions</span>

            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
          </summary>

          <p className="px-1 pb-1 pt-2 text-[11px] leading-5 text-slate-700">
            {instructions}
          </p>
        </details>
      </div>

      {/* Tablet / desktop brief */}
      <div className="hidden px-5 py-4 sm:block">
        <div className={`flex items-start gap-3 ${compact ? "xl:items-center" : ""}`}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/20">
            <FileText className="h-5 w-5" />
          </span>

          <div
            className={`min-w-0 flex-1 ${
              compact
                ? "xl:grid xl:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.8fr)] xl:items-center xl:gap-6"
                : ""
            }`}
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-[10px] font-black uppercase tracking-widest text-blue-700">
                  Assignment Brief
                </p>

                <span className="rounded-full border border-blue-200 bg-white px-2 py-0.5 text-[9px] font-bold text-blue-700">
                  Read this first
                </span>
              </div>

              <h2 className="mt-1.5 font-serif text-lg font-black text-slate-950">
                {title || "Untitled Assignment"}
              </h2>
            </div>

            <p
              className={`${
                compact
                  ? "mt-2 border-t border-blue-100 pt-2 xl:mt-0 xl:border-l xl:border-t-0 xl:py-1 xl:pl-6"
                  : "mt-2 max-w-[1200px]"
              } text-xs leading-5 text-slate-700`}
            >
              {instructions}
            </p>
          </div>
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
