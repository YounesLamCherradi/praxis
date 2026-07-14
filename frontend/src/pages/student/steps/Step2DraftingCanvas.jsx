import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStudentWorkspace } from "../../../contexts/StudentWorkspaceContext";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  FileText,
  Focus,
  ListChecks,
  Maximize2,
  Minimize2,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

function countWords(text) {
  const clean = String(text || "").trim();
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safePreview(text, max = 120) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function getInsertedText(before, after) {
  const oldText = String(before || "");
  const newText = String(after || "");

  let start = 0;

  while (
    start < oldText.length &&
    start < newText.length &&
    oldText[start] === newText[start]
  ) {
    start += 1;
  }

  let oldEnd = oldText.length - 1;
  let newEnd = newText.length - 1;

  while (
    oldEnd >= start &&
    newEnd >= start &&
    oldText[oldEnd] === newText[newEnd]
  ) {
    oldEnd -= 1;
    newEnd -= 1;
  }

  return newText.slice(start, newEnd + 1);
}

function normalizePastePolicy(value) {
  const policy = String(value || "allow").toLowerCase();

  if (policy === "block") return "block";
  if (policy === "warn") return "warn";

  return "allow";
}

function getIntegritySettings(assignment = {}) {
  const settings =
    assignment.integritySettings ||
    assignment.academicIntegrity ||
    assignment.integrity ||
    {};

  return {
    pastePolicy: normalizePastePolicy(
      settings.pastePolicy ||
        assignment.pastePolicy ||
        "allow"
    ),

    logPasteAttempts:
      settings.logPasteAttempts ??
      settings.logCopyPaste ??
      assignment.logPasteAttempts ??
      assignment.logCopyPaste ??
      true,

    detectLargeInsertions:
      settings.detectLargeInsertions ??
      assignment.detectLargeInsertions ??
      true,

    largeInsertionThreshold: Number(
      settings.largeInsertionThreshold ??
        assignment.largeInsertionThreshold ??
        120
    ),

    disableDragDrop:
      settings.disableDragDrop ??
      assignment.disableDragDrop ??
      true,

    trackFocusLoss:
      settings.trackFocusLoss ??
      assignment.trackFocusLoss ??
      true,

    requireHonorConfirmation:
      settings.requireHonorConfirmation ??
      assignment.requireHonorConfirmation ??
      false,

    enforceWordCount:
      settings.enforceWordCount ??
      assignment.enforceWordCount ??
      false,
  };
}

function collectOutlineNotes(outline) {
  if (!outline) return [];

  const directNotes = safeArray(outline.notes)
    .map((item) =>
      typeof item === "string"
        ? item
        : item?.text || item?.label || item?.title || ""
    )
    .filter(Boolean);

  const sectionNotes = safeArray(outline.sections).flatMap((section) =>
    safeArray(section?.items)
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.text || item?.label || item?.title || ""
      )
      .filter(Boolean)
  );

  return Array.from(new Set([...directNotes, ...sectionNotes])).slice(0, 14);
}

function formatSavedTime(value) {
  if (!value) return "Not saved yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Saved";

  return `Saved ${date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function getWordProgress(wordCount, minWords, maxWords) {
  const minimum = Number(minWords || 0);
  const maximum = Number(maxWords || 0);

  if (maximum > 0) {
    return Math.min(100, Math.max(0, (wordCount / maximum) * 100));
  }

  if (minimum > 0) {
    return Math.min(100, Math.max(0, (wordCount / minimum) * 100));
  }

  return wordCount > 0 ? 100 : 0;
}

export default function Step2DraftingCanvas() {
  const {
    activeAssignment,
    activeSubmission,
    studentProfile,
    typedText,
    setTypedText,
    setStudentStep,
    saveDraftProgress,
  } = useStudentWorkspace();

  const [integrityWarning, setIntegrityWarning] = useState("");
  const [integrityLogs, setIntegrityLogs] = useState([]);
  const [honorAccepted, setHonorAccepted] = useState(false);
  const [showPlanningNotes, setShowPlanningNotes] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [lastSavedAt, setLastSavedAt] = useState(
    activeSubmission?.updatedAt ||
      activeSubmission?.draftSavedAt ||
      activeSubmission?.lastSavedAt ||
      null
  );

  const lastValueRef = useRef("");
  const warningTimerRef = useRef(null);
  const autosaveTimerRef = useRef(null);
  const writingEventsRef = useRef(
    safeArray(activeSubmission?.writingEvents)
  );
  const integrityLogsRef = useRef(
    safeArray(activeSubmission?.integrityLogs)
  );
  const copyPasteLogsRef = useRef(
    safeArray(activeSubmission?.copyPasteLogs)
  );
  const focusLossLogsRef = useRef(
    safeArray(activeSubmission?.focusLossLogs)
  );
  const writingSessionStartedAtRef = useRef(
    activeSubmission?.writingSessionStartedAt || null
  );

  const assignment = activeAssignment || {};
  const settings = getIntegritySettings(assignment);

  const assignmentId =
    assignment?.id ||
    activeSubmission?.assignmentId ||
    "unknown_assignment";

  const studentEmail =
    studentProfile?.email ||
    activeSubmission?.studentEmail ||
    "student@aui.ma";

  const integrityLogKey = useMemo(() => {
    return `praxis_integrity_logs:${studentEmail}:${assignmentId}`;
  }, [studentEmail, assignmentId]);

  const draftValue =
    typedText !== undefined && typedText !== null
      ? typedText
      : activeSubmission?.draftText || "";

  const hasDraftText = draftValue.trim().length > 0;
  const wordCount = countWords(draftValue);

  const minWords = Number(
    assignment?.wordCountMin ??
      assignment?.minWords ??
      activeSubmission?.wordCountMin ??
      activeSubmission?.minWords ??
      0
  );

  const maxWords = Number(
    assignment?.wordCountMax ??
      assignment?.maxWords ??
      activeSubmission?.wordCountMax ??
      activeSubmission?.maxWords ??
      0
  );

  const belowMinWords = minWords > 0 && wordCount < minWords;
  const aboveMaxWords = maxWords > 0 && wordCount > maxWords;
  const wordCountIssue = belowMinWords || aboveMaxWords;

  const honorBlocked =
    settings.requireHonorConfirmation && !honorAccepted;

  const wordCountBlocked =
    settings.enforceWordCount && wordCountIssue;

  const canReview =
    hasDraftText && !honorBlocked && !wordCountBlocked;

  const outline =
    activeSubmission?.outline ||
    activeSubmission?.planningOutline ||
    assignment?.outline ||
    null;

  const planningNotes = useMemo(
    () => collectOutlineNotes(outline),
    [outline]
  );

  const wordProgress = getWordProgress(wordCount, minWords, maxWords);

  const progressTone = aboveMaxWords
    ? "bg-red-500"
    : belowMinWords
    ? "bg-amber-500"
    : "bg-emerald-500";

  const wordStatus = aboveMaxWords
    ? `${wordCount - maxWords} words over maximum`
    : belowMinWords
    ? `${minWords - wordCount} words until minimum`
    : minWords > 0
    ? "Minimum reached"
    : "Draft in progress";

  useEffect(() => {
    lastValueRef.current = draftValue;
  }, [assignmentId]);


  useEffect(() => {
    writingEventsRef.current = safeArray(
      activeSubmission?.writingEvents
    );
    integrityLogsRef.current = safeArray(
      activeSubmission?.integrityLogs
    );
    copyPasteLogsRef.current = safeArray(
      activeSubmission?.copyPasteLogs
    );
    focusLossLogsRef.current = safeArray(
      activeSubmission?.focusLossLogs
    );
    writingSessionStartedAtRef.current =
      activeSubmission?.writingSessionStartedAt || null;
  }, [activeSubmission?.id, assignmentId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(integrityLogKey) || "[]"
      );

      setIntegrityLogs(Array.isArray(saved) ? saved : []);
    } catch {
      setIntegrityLogs([]);
    }
  }, [integrityLogKey]);

  useEffect(() => {
    setHonorAccepted(!settings.requireHonorConfirmation);
  }, [assignmentId, settings.requireHonorConfirmation]);

  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  function showWarning(message) {
    setIntegrityWarning(message);

    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    warningTimerRef.current = setTimeout(() => {
      setIntegrityWarning("");
    }, 7000);
  }

  function saveIntegrityLogs(nextLogs) {
    integrityLogsRef.current = nextLogs;
    setIntegrityLogs(nextLogs);

    try {
      localStorage.setItem(integrityLogKey, JSON.stringify(nextLogs));
    } catch {
      // Local logging should never interrupt drafting.
    }
  }

  function recordIntegrityEvent({
    type,
    policy = "",
    text = "",
    details = {},
  }) {
    const event = {
      id: `integrity_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`,
      type,
      policy,
      assignmentId,
      assignmentTitle:
        assignment?.title ||
        activeSubmission?.assignmentTitle ||
        "",
      studentEmail,
      timestamp: new Date().toISOString(),
      charCount: String(text || "").length,
      wordCount: countWords(text),
      preview: safePreview(text),
      details,
    };

    const nextLogs = [event, ...integrityLogs].slice(0, 150);
    saveIntegrityLogs(nextLogs);
  }

  function ensureWritingSessionStarted() {
    if (writingSessionStartedAtRef.current) {
      return writingSessionStartedAtRef.current;
    }

    const startedAt = new Date().toISOString();
    writingSessionStartedAtRef.current = startedAt;
    return startedAt;
  }

  function calculateChange(before, after) {
    const previous = String(before || "");
    const next = String(after || "");

    let prefix = 0;

    while (
      prefix < previous.length &&
      prefix < next.length &&
      previous[prefix] === next[prefix]
    ) {
      prefix += 1;
    }

    let previousSuffix = previous.length - 1;
    let nextSuffix = next.length - 1;

    while (
      previousSuffix >= prefix &&
      nextSuffix >= prefix &&
      previous[previousSuffix] === next[nextSuffix]
    ) {
      previousSuffix -= 1;
      nextSuffix -= 1;
    }

    const removedText = previous.slice(prefix, previousSuffix + 1);
    const insertedText = next.slice(prefix, nextSuffix + 1);

    let type = "edit";

    if (insertedText && !removedText) type = "insert";
    if (!insertedText && removedText) type = "delete";
    if (insertedText && removedText) type = "replace";

    return {
      type,
      insertedText,
      removedText,
      addedChars: insertedText.length,
      deletedChars: removedText.length,

      // Exact operation coordinates used by teacher playback.
      // `start` and `end` refer to the text before this edit.
      start: prefix,
      end: prefix + removedText.length,
      position: prefix,
    };
  }

  function appendWritingEvent(eventData) {
    const event = {
      id: `writing_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`,
      assignmentId,
      assignmentTitle:
        assignment?.title ||
        activeSubmission?.assignmentTitle ||
        "",
      studentEmail,
      timestamp: new Date().toISOString(),
      ...eventData,
    };

    writingEventsRef.current = [
      ...writingEventsRef.current,
      event,
    ].slice(-600);

    return event;
  }

  function persistWritingEvidence(nextValue, extraPatch = {}) {
    const savedAt = new Date().toISOString();
    const sessionStartedAt = ensureWritingSessionStarted();

    const sessionDurationSeconds = Math.max(
      0,
      Math.floor(
        (new Date(savedAt).getTime() -
          new Date(sessionStartedAt).getTime()) /
          1000
      )
    );

    if (
      assignmentId &&
      typeof saveDraftProgress === "function"
    ) {
      saveDraftProgress(assignmentId, {
        draftText: nextValue,
        content: nextValue,
        finalText: nextValue,
        wordCount: countWords(nextValue),
        draftSavedAt: savedAt,
        lastSavedAt: savedAt,
        writingSessionStartedAt: sessionStartedAt,
        writingSessionUpdatedAt: savedAt,
        writingSessionDurationSeconds: sessionDurationSeconds,
        writingEvents: writingEventsRef.current,
        writingReplay: writingEventsRef.current,
        integrityLogs: integrityLogsRef.current,
        copyPasteLogs: copyPasteLogsRef.current,
        focusLossLogs: focusLossLogsRef.current,
        ...extraPatch,
      });
    }

    return savedAt;
  }

  function scheduleAutosave(nextValue) {
    setSaveStatus("saving");

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      try {
        const savedAt = persistWritingEvidence(nextValue);

        setLastSavedAt(savedAt);
        setSaveStatus("saved");
      } catch (error) {
        console.error("Draft autosave failed:", error);
        setSaveStatus("error");
      }
    }, 700);
  }

  function handleDraftChange(event) {
    const nextValue = event.target.value;
    const previousValue = lastValueRef.current || "";
    const nativeInputType =
      event.nativeEvent?.inputType || "edit";

    const change = calculateChange(previousValue, nextValue);

    const isPasteInput =
      nativeInputType === "insertFromPaste" ||
      nativeInputType === "insertFromDrop";

    appendWritingEvent({
      type: isPasteInput ? "paste_insert" : change.type,
      action: nativeInputType,
      draftText: nextValue,
      snapshot: nextValue,
      text: nextValue,
      wordCount: countWords(nextValue),
      charCount: nextValue.length,
      insertedText: change.insertedText,
      removedText: change.removedText,
      addedChars: change.addedChars,
      deletedChars: change.deletedChars,
      start: change.start,
      end: change.end,
      position: change.position,
      eventGroup: isPasteInput ? "Paste" : "Writing",
      preview: safePreview(
        change.insertedText ||
          change.removedText ||
          nextValue,
        160
      ),
    });

    if (
      settings.detectLargeInsertions &&
      change.addedChars >= settings.largeInsertionThreshold
    ) {
      recordIntegrityEvent({
        type: "large_insertion",
        policy: "logged",
        text: change.insertedText,
        details: {
          insertedLength: change.addedChars,
          threshold: settings.largeInsertionThreshold,
          draftSnapshot: nextValue,
        },
      });

      showWarning(
        `Large text insertion detected (${change.addedChars} characters). Your teacher may review writing activity for this assignment.`
      );
    }

    lastValueRef.current = nextValue;
    setTypedText(nextValue);
    scheduleAutosave(nextValue);
  }

  function handlePaste(event) {
    const pastedText =
      event.clipboardData?.getData("text/plain") ||
      event.clipboardData?.getData("text") ||
      "";

    const pasteEvent = {
      id: `paste_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`,
      type: "paste",
      policy: settings.pastePolicy,
      assignmentId,
      assignmentTitle:
        assignment?.title ||
        activeSubmission?.assignmentTitle ||
        "",
      studentEmail,
      timestamp: new Date().toISOString(),
      text: pastedText,
      insertedText: pastedText,
      preview: safePreview(pastedText, 180),
      charCount: pastedText.length,
      wordCount: countWords(pastedText),
      blocked: settings.pastePolicy === "block",
      draftBefore: lastValueRef.current || "",
      start:
        event.target?.selectionStart ??
        (lastValueRef.current || "").length,
      end:
        event.target?.selectionEnd ??
        event.target?.selectionStart ??
        (lastValueRef.current || "").length,
    };

    copyPasteLogsRef.current = [
      ...copyPasteLogsRef.current,
      pasteEvent,
    ].slice(-150);

    if (settings.logPasteAttempts) {
      recordIntegrityEvent({
        type: "paste",
        policy: settings.pastePolicy,
        text: pastedText,
        details: {
          blocked: settings.pastePolicy === "block",
          draftBefore: lastValueRef.current || "",
        },
      });
    }

    if (settings.pastePolicy === "block") {
      event.preventDefault();

      showWarning(
        "Pasting is blocked for this assignment based on your teacher’s settings."
      );

      return;
    }

    if (settings.pastePolicy === "warn") {
      showWarning(
        "Paste detected. You can continue, but your teacher may review paste activity for this assignment."
      );
    }
  }

  function handleCopy() {
    const selectedText = window.getSelection?.()?.toString?.() || "";

    recordIntegrityEvent({
      type: "copy",
      policy: "logged",
      text: selectedText,
      details: {
        selectionLength: selectedText.length,
      },
    });
  }

  function handleCut() {
    const selectedText = window.getSelection?.()?.toString?.() || "";

    recordIntegrityEvent({
      type: "cut",
      policy: "logged",
      text: selectedText,
      details: {
        selectionLength: selectedText.length,
      },
    });
  }

  function handleDragOver(event) {
    if (settings.disableDragDrop) {
      event.preventDefault();
    }
  }

  function handleDrop(event) {
    const droppedText =
      event.dataTransfer?.getData("text/plain") ||
      event.dataTransfer?.getData("text") ||
      "";

    recordIntegrityEvent({
      type: "drop",
      policy: settings.disableDragDrop ? "blocked" : "logged",
      text: droppedText,
      details: {
        blocked: settings.disableDragDrop,
      },
    });

    if (settings.disableDragDrop) {
      event.preventDefault();

      showWarning(
        "Drag and drop is disabled for this assignment based on your teacher’s settings."
      );
    }
  }

  function handleBlur() {
    if (!settings.trackFocusLoss) return;

    const timestamp = new Date().toISOString();

    const focusEvent = {
      id: `focus_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`,
      type: "focus_loss",
      action: "blur",
      timestamp,
      assignmentId,
      studentEmail,
      currentWordCount: wordCount,
      draftText: draftValue,
      snapshot: draftValue,
      preview: safePreview(draftValue, 140),
    };

    focusLossLogsRef.current = [
      ...focusLossLogsRef.current,
      focusEvent,
    ].slice(-150);

    appendWritingEvent({
      ...focusEvent,
      eventGroup: "Focus",
      wordCount,
      charCount: draftValue.length,
    });

    recordIntegrityEvent({
      type: "focus_loss",
      policy: "logged",
      text: "",
      details: {
        currentWordCount: wordCount,
        draftSnapshot: draftValue,
      },
    });

    persistWritingEvidence(draftValue);
  }

  function handleReviewDraft() {
    if (!canReview) {
      if (honorBlocked) {
        showWarning(
          "Please confirm the academic integrity statement before continuing."
        );
      } else if (wordCountBlocked) {
        showWarning(
          "Please respect the word count requirement before continuing."
        );
      } else if (!hasDraftText) {
        showWarning("Write part of your draft before continuing.");
      }

      return;
    }

    setStudentStep(3);
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Compact progress and editor toolbar */}
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                <span className="text-xs font-bold text-slate-900">
                  {wordCount}
                  {maxWords > 0 ? ` / ${maxWords}` : ""} words
                </span>
              </div>

              <span
                className={`text-[11px] font-bold ${
                  aboveMaxWords
                    ? "text-red-700"
                    : belowMinWords
                    ? "text-amber-700"
                    : "text-emerald-700"
                }`}
              >
                {wordStatus}
              </span>

              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold ${
                  saveStatus === "error"
                    ? "text-red-700"
                    : saveStatus === "saving"
                    ? "text-blue-700"
                    : "text-slate-500"
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "error"
                  ? "Save failed"
                  : formatSavedTime(lastSavedAt)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {planningNotes.length > 0 && !focusMode && (
                <button
                  type="button"
                  onClick={() =>
                    setShowPlanningNotes((current) => !current)
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-all"
                >
                  <ListChecks className="w-4 h-4" />
                  Planning Notes
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] font-mono">
                    {planningNotes.length}
                  </span>
                  {showPlanningNotes ? (
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                  ) : (
                    <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setFocusMode((current) => !current);
                  setShowPlanningNotes(false);
                }}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-all ${
                  focusMode
                    ? "border-blue-300 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                    : "border-slate-200 bg-[#F8FAFC] text-slate-700 hover:bg-white hover:border-blue-200 hover:text-blue-700"
                }`}
              >
                {focusMode ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
                {focusMode ? "Exit Focus" : "Focus Mode"}
              </button>
            </div>
          </div>

          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all duration-300 ${progressTone}`}
                style={{ width: `${wordProgress}%` }}
              />
            </div>

            <div className="mt-1.5 flex justify-between text-[9px] font-mono text-slate-400">
              <span>
                {minWords > 0 ? `${minWords} minimum` : "No minimum"}
              </span>
              <span>
                {maxWords > 0 ? `${maxWords} maximum` : "No maximum"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {integrityWarning && (
        <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{integrityWarning}</span>
        </div>
      )}

      {/* Editor is the primary workspace */}
      <div
        className={`grid flex-1 min-h-0 gap-3 ${
          !focusMode && showPlanningNotes && planningNotes.length > 0
            ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_285px]"
            : "grid-cols-1"
        }`}
      >
        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col">
          <div className="shrink-0 flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Draft Editor
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Write freely first, then revise before requesting feedback.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
              <span
                className={`rounded-lg border px-2 py-1 font-bold ${
                  settings.pastePolicy === "block"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : settings.pastePolicy === "warn"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
              >
                Paste: {settings.pastePolicy}
              </span>

              <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-bold text-slate-500">
                Autosave on
              </span>
            </div>
          </div>

          <textarea
            value={draftValue}
            onChange={handleDraftChange}
            onPaste={handlePaste}
            onCopy={handleCopy}
            onCut={handleCut}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onBlur={handleBlur}
            placeholder="Start with your main idea. Use your planning notes to guide your own writing."
            className={`flex-1 min-h-[390px] w-full resize-none bg-[#F8FAFC] px-5 py-5 text-sm leading-7 text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white ${
              focusMode ? "min-h-[520px]" : ""
            }`}
          />

          {settings.requireHonorConfirmation && (
            <label className="shrink-0 flex cursor-pointer items-start gap-2 border-t border-slate-100 bg-white px-4 py-3 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={honorAccepted}
                onChange={(event) =>
                  setHonorAccepted(event.target.checked)
                }
                className="mt-0.5"
              />

              <span>
                I understand that my writing activity may be reviewed
                according to this assignment’s integrity settings.
              </span>
            </label>
          )}
        </section>

        {!focusMode &&
          showPlanningNotes &&
          planningNotes.length > 0 && (
            <aside className="min-h-0 overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/60 shadow-sm flex flex-col">
              <div className="shrink-0 border-b border-emerald-200 bg-white/80 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-700" />
                      <h3 className="text-xs font-bold text-slate-900">
                        Planning Notes
                      </h3>
                    </div>

                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      Notes only. Write the final sentences yourself.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPlanningNotes(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100"
                    title="Hide planning notes"
                  >
                    <EyeOff className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3">
                <div className="space-y-2">
                  {planningNotes.map((note, index) => (
                    <div
                      key={`${note}-${index}`}
                      className="rounded-xl border border-emerald-100 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-mono font-black text-emerald-700">
                          {index + 1}
                        </span>

                        <p className="text-[11px] leading-relaxed text-slate-700">
                          {note}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
      </div>

      {/* Compact validation and navigation */}
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {belowMinWords && (
              <StatusMessage
                tone="amber"
                icon={AlertTriangle}
                text={`Add ${minWords - wordCount} more words to reach the minimum.`}
              />
            )}

            {aboveMaxWords && (
              <StatusMessage
                tone="red"
                icon={AlertTriangle}
                text={`Remove ${wordCount - maxWords} words to meet the maximum.`}
              />
            )}

            {!wordCountIssue && hasDraftText && (
              <StatusMessage
                tone="green"
                icon={CheckCircle2}
                text="Draft length is within the required range."
              />
            )}

            {!hasDraftText && (
              <StatusMessage
                tone="slate"
                icon={Clock3}
                text="Start writing to unlock the feedback step."
              />
            )}

            {integrityLogs.length > 0 && (
              <span className="text-[10px] font-mono text-slate-400">
                {integrityLogs.length} writing event
                {integrityLogs.length === 1 ? "" : "s"} recorded
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setStudentStep(1)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Coach
            </button>

            <button
              type="button"
              onClick={handleReviewDraft}
              disabled={!canReview}
              className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-xs font-bold transition-all ${
                canReview
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              Continue to Feedback
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusMessage({ tone, icon: Icon, text }) {
  const styles = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-semibold ${
        styles[tone] || styles.slate
      }`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      {text}
    </span>
  );
}