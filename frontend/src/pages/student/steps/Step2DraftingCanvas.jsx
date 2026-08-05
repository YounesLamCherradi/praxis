import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudentWorkspace } from "../../../hooks/useStudentWorkspace";
import { authenticatedFetch } from "../../../services/auth";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  FileText,
  ListChecks,
  Save,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const AI_ENDPOINT = "/api/generate";

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

function getIntegritySettings() {
  /*
    Restored old Praxis behavior:
    - Writing replay and paste evidence remain platform process records.
    - Focus tracking, large-insertion detection, drag/drop blocking,
      and honor-confirmation settings are not part of the old workflow.
    - Word limits remain original assignment requirements.
  */
  return {
    pastePolicy: "warn",
    logPasteAttempts: true,
    detectLargeInsertions: false,
    largeInsertionThreshold:
      Number.POSITIVE_INFINITY,
    disableDragDrop: false,
    trackFocusLoss: false,
    requireHonorConfirmation: false,
    enforceWordCount: true,
  };
}

function getChatMessageText(message = {}) {
  return String(
    message?.content ||
      message?.text ||
      message?.message ||
      ""
  ).trim();
}

function getPlanningChatHistory(submission = {}) {
  const candidates = [
    submission?.chatHistory,
    submission?.planningChatMessages,
    submission?.planningCoachHistory,
    submission?.planningMessages,
    submission?.coachChatHistory,
    submission?.planningChat,
  ];

  return (
    candidates.find(
      (candidate) =>
        Array.isArray(candidate) &&
        candidate.some((message) => getChatMessageText(message))
    ) || []
  );
}

function chatTranscript(messages = []) {
  return safeArray(messages)
    .filter((message) => getChatMessageText(message))
    .map((message) => {
      const role =
        String(message?.role || "").toLowerCase() === "assistant"
          ? "Coach"
          : "Student";

      return `${role}: ${getChatMessageText(message)}`;
    })
    .join("\n");
}

function buildOutlinePayload(assignment, messages) {
  return {
    maxTokens: 500,
    temperature: 0.3,
    system: `You are a writing coach helping a ${
      assignment?.languageLevel ||
      assignment?.level ||
      "B1"
    } student turn their planning chat into a working outline.

Return ONLY JSON in this shape:
{ "sections": [ { "heading": "short label", "points": ["idea", "idea"] } ] }

Rules:
- Use ONLY the student's own ideas from the chat. Do not invent new content.
- IDEAS ONLY: short note-form phrases, never full sentences the student could copy into their essay.
- 2 to 5 sections, each with 1 to 4 short bullet points.
- Keep each bullet under about 10 words and use simple language.`,
    prompt: `Assignment title: ${assignment?.title || "Untitled Assignment"}
Assignment type: ${assignment?.assignmentType || assignment?.type || "response"}
Student-facing task:
${
  assignment?.prompt ||
  assignment?.instructions ||
  assignment?.description ||
  "No instructions provided."
}

Planning chat between the student and the coach:
${chatTranscript(messages)}

Build the student's outline as JSON now.`,
  };
}

function stripCodeFence(value) {
  let text = String(value || "").trim();

  if (text.startsWith("```")) {
    const firstBreak = text.indexOf("\n");
    text = firstBreak >= 0 ? text.slice(firstBreak + 1) : text.slice(3);
  }

  if (text.endsWith("```")) {
    text = text.slice(0, -3);
  }

  return text.trim();
}

function firstBraceIndex(text) {
  const square = text.indexOf("[");
  const curly = text.indexOf("{");

  if (square < 0) return curly;
  if (curly < 0) return square;

  return Math.min(square, curly);
}

function safeJsonParse(raw) {
  const text = stripCodeFence(raw);

  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Fall through to extracting the first JSON-looking span.
  }

  const start = firstBraceIndex(text);
  const end = Math.max(text.lastIndexOf("]"), text.lastIndexOf("}"));

  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function parseOutlineSections(raw) {
  const data = safeJsonParse(raw);

  if (!data) return [];

  const list = Array.isArray(data)
    ? data
    : safeArray(data.sections);

  return list
    .map((section) => ({
      heading: String(section?.heading || "").trim(),
      points: safeArray(section?.points)
        .map((point) => String(point || "").trim())
        .filter(Boolean),
    }))
    .filter(
      (section) =>
        section.heading ||
        section.points.length
    )
    .slice(0, 6);
}

function sectionsToOutlineText(sections) {
  return sections
    .map((section) => {
      const heading = section.heading || "Ideas";
      const bullets = section.points
        .map((point) => `  • ${point}`)
        .join("\n");

      return bullets
        ? `${heading}
${bullets}`
        : heading;
    })
    .join("\n\n");
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
    goToStudentStep,
    saveDraftProgress,
    studentWorkflowNotice,
  } = useStudentWorkspace();

  const [integrityWarning, setIntegrityWarning] = useState("");
  const [pendingPaste, setPendingPaste] = useState(null);
  const [integrityLogs, setIntegrityLogs] = useState([]);
  const [chatOutlineText, setChatOutlineText] = useState(
    activeSubmission?.outline?.chatOutlineText || ""
  );
  const [chatOutlineMeta, setChatOutlineMeta] = useState(
    activeSubmission?.outline?.chatOutlineMeta || {}
  );
  const [outlineStatus, setOutlineStatus] = useState("");
  const [outlineBusy, setOutlineBusy] = useState(false);
  const [outlineRebuildPrompt, setOutlineRebuildPrompt] = useState(false);
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
  const outlineAutosaveTimerRef = useRef(null);
  const outlineAssignmentRef = useRef(String(
    activeAssignment?.id || activeSubmission?.assignmentId || ""
  ));
  const autoOutlineAttemptedRef = useRef(false);
  const outlineRequestInFlightRef = useRef(false);
  const writingEventsRef = useRef(
    safeArray(activeSubmission?.writingEvents)
  );
  const integrityLogsRef = useRef(
    safeArray(activeSubmission?.integrityLogs)
  );
  const copyPasteLogsRef = useRef(
    safeArray(activeSubmission?.copyPasteLogs)
  );
  const draftEditorRef = useRef(null);
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

  const draftValue =
    typedText !== undefined && typedText !== null
      ? typedText
      : activeSubmission?.draftText || "";

  const hasDraftText = draftValue.trim().length > 0;
  const wordCount = countWords(draftValue);
  const rubricCriteria = Array.isArray(assignment?.rubricSchema?.criteria)
    ? assignment.rubricSchema.criteria
    : Array.isArray(assignment?.rubric)
      ? assignment.rubric
      : [];
  const savedRubricScores = activeSubmission?.selfRubricScores || {};
  const rubricComplete = rubricCriteria.length === 0 || rubricCriteria.every(
    (criterion) => {
      const score = savedRubricScores?.[criterion.id];
      return Boolean(score?.bandId || score?.score !== undefined);
    }
  );
  const rubricTransitionNoticeOpen = Boolean(
    studentWorkflowNotice &&
      Number(studentWorkflowNotice?.pendingTransition?.targetStep) === 4
  );
  const workflowAlertSlot =
    typeof document !== "undefined"
      ? document.getElementById("student-workflow-alert-slot")
      : null;

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

  const canReview = hasDraftText;

  const existingOutline =
    activeSubmission?.outline ||
    activeSubmission?.planningOutline ||
    {};

  const planningChatHistory = useMemo(
    () => getPlanningChatHistory(activeSubmission || {}),
    [
      activeSubmission?.id,
      activeSubmission?.chatHistory,
      activeSubmission?.planningChatMessages,
      activeSubmission?.planningCoachHistory,
      activeSubmission?.planningMessages,
      activeSubmission?.coachChatHistory,
      activeSubmission?.planningChat,
    ]
  );

  const autoOutlineFromChat = Boolean(
    assignment?.autoOutlineFromChat ??
      assignment?.autoBuildOutlineFromCoach ??
      assignment?.generateOutlineFromCoach ??
      assignment?.aiSupportSettings?.autoOutlineFromChat ??
      assignment?.aiSupportSettings?.autoBuildOutlineFromCoach ??
      false
  );

  const showChatOutline =
    autoOutlineFromChat &&
    planningChatHistory.filter((message) =>
      getChatMessageText(message)
    ).length >= 2;

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
  }, [assignmentId, activeSubmission?.id]);


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
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }

      if (outlineAutosaveTimerRef.current) {
        clearTimeout(outlineAutosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const nextAssignmentId = String(assignmentId || "");

    // A brand-new attempt receives its persisted submission ID on the first
    // save. That is not an assignment change and must not overwrite notes the
    // student is currently editing with a transient/stale submission snapshot.
    if (outlineAssignmentRef.current === nextAssignmentId) {
      return;
    }

    outlineAssignmentRef.current = nextAssignmentId;
    const savedOutline =
      activeSubmission?.outline ||
      activeSubmission?.planningOutline ||
      {};

    setChatOutlineText(
      String(savedOutline?.chatOutlineText || "")
    );
    setChatOutlineMeta(
      savedOutline?.chatOutlineMeta || {}
    );
    setOutlineStatus("");
    setOutlineBusy(false);
    autoOutlineAttemptedRef.current = false;
    outlineRequestInFlightRef.current = false;
  }, [assignmentId]);

  function persistChatOutline(nextText, nextMeta) {
    if (
      !assignmentId ||
      typeof saveDraftProgress !== "function"
    ) {
      return;
    }

    saveDraftProgress(assignmentId, {
      outline: {
        ...existingOutline,
        chatOutlineText: nextText,
        chatOutlineMeta: nextMeta,
      },
    });
  }

  function scheduleOutlineAutosave(nextText, nextMeta) {
    if (outlineAutosaveTimerRef.current) {
      clearTimeout(outlineAutosaveTimerRef.current);
    }

    outlineAutosaveTimerRef.current = setTimeout(() => {
      persistChatOutline(nextText, nextMeta);
    }, 350);
  }

  async function requestOutlineGeneration(
    payload,
    { retries = 1, timeoutMs = 22000 } = {}
  ) {
    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(
        () => controller.abort(),
        timeoutMs
      );

      try {
        const response = await authenticatedFetch(AI_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        const contentType =
          response.headers.get("content-type") || "";

        const data = contentType.includes("application/json")
          ? await response.json()
          : { error: await response.text() };

        if (!response.ok) {
          throw new Error(
            data?.error ||
              `Outline request failed with status ${response.status}.`
          );
        }

        return data;
      } catch (error) {
        lastError =
          error?.name === "AbortError"
            ? new Error("Outline request timed out.")
            : error;

        if (attempt >= retries) {
          throw lastError;
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    }

    throw lastError || new Error("Outline request failed.");
  }

  async function generateOutline({
    force = false,
    confirmed = false,
  } = {}) {
    if (
      !showChatOutline ||
      outlineRequestInFlightRef.current
    ) {
      return;
    }

    const currentText = String(chatOutlineText || "");
    const currentMeta = chatOutlineMeta || {};

    if (
      force &&
      currentText.trim() &&
      currentMeta.edited &&
      !confirmed
    ) {
      setOutlineRebuildPrompt(true);
      return;
    }

    setOutlineRebuildPrompt(false);

    outlineRequestInFlightRef.current = true;
    setOutlineBusy(true);
    setOutlineStatus("Building your outline from the chat…");

    try {
      const result = await requestOutlineGeneration(
        buildOutlinePayload(
          assignment,
          planningChatHistory
        ),
        {
          retries: 1,
          timeoutMs: 22000,
        }
      );

      const sections = parseOutlineSections(
        result?.response ||
          result?.reply ||
          result?.message ||
          ""
      );

      const nextMeta = {
        ...currentMeta,
        autoAttempted: true,
        generatedAt: new Date().toISOString(),
        sourceChatLen: planningChatHistory.length,
        edited: false,
      };

      setChatOutlineMeta(nextMeta);

      if (sections.length) {
        const nextText =
          sectionsToOutlineText(sections);

        setChatOutlineText(nextText);
        persistChatOutline(nextText, nextMeta);
        setOutlineStatus(
          "Outline ready  -  edit it freely before you write."
        );
      } else {
        persistChatOutline(currentText, nextMeta);
        setOutlineStatus(
          "Couldn't turn the chat into an outline. You can write your own below."
        );
      }
    } catch (error) {
      const nextMeta = {
        ...currentMeta,
        autoAttempted: true,
      };

      setChatOutlineMeta(nextMeta);
      persistChatOutline(currentText, nextMeta);
      setOutlineStatus(
        "Outline help is unavailable right now. Try “Rebuild from chat”, or write your own."
      );
    } finally {
      outlineRequestInFlightRef.current = false;
      setOutlineBusy(false);
    }
  }

  useEffect(() => {
    if (
      !showChatOutline ||
      chatOutlineText.trim() ||
      outlineBusy ||
      autoOutlineAttemptedRef.current
    ) {
      return;
    }

    autoOutlineAttemptedRef.current = true;
    generateOutline({ force: false });
  }, [
    assignmentId,
    showChatOutline,
    planningChatHistory.length,
  ]);

  function handleOutlineChange(event) {
    const nextText = event.target.value;
    const nextMeta = {
      ...chatOutlineMeta,
      edited: true,
    };

    setChatOutlineText(nextText);
    setChatOutlineMeta(nextMeta);
    scheduleOutlineAutosave(nextText, nextMeta);
  }

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

      // Exact operation coordinates used by instructor playback.
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
        `Large text insertion detected (${change.addedChars} characters). Your instructor may review writing activity for this assignment.`
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
        "Pasting is blocked for this assignment based on your instructor’s settings."
      );

      return;
    }

    if (settings.pastePolicy === "warn") {
      event.preventDefault();
      setPendingPaste({
        text: pastedText,
        start: pasteEvent.start,
        end: pasteEvent.end,
        draftBefore: pasteEvent.draftBefore,
      });
    }
  }

  function resolvePendingPaste(keepPastedText) {
    if (!pendingPaste) return;

    if (!keepPastedText) {
      setPendingPaste(null);
      showWarning("Paste canceled. Continue writing in your own words.");
      requestAnimationFrame(() => draftEditorRef.current?.focus());
      return;
    }

    const before = String(pendingPaste.draftBefore || "");
    const start = Math.max(0, Number(pendingPaste.start || 0));
    const end = Math.max(start, Number(pendingPaste.end ?? start));
    const nextValue = `${before.slice(0, start)}${pendingPaste.text}${before.slice(end)}`;

    appendWritingEvent({
      type: "paste_insert",
      action: "insertFromPaste",
      draftText: nextValue,
      snapshot: nextValue,
      text: nextValue,
      wordCount: countWords(nextValue),
      charCount: nextValue.length,
      insertedText: pendingPaste.text,
      removedText: before.slice(start, end),
      addedChars: pendingPaste.text.length,
      deletedChars: end - start,
      start,
      end,
      position: start,
      eventGroup: "Paste",
      preview: safePreview(pendingPaste.text, 160),
    });

    lastValueRef.current = nextValue;
    setTypedText(nextValue);
    scheduleAutosave(nextValue);
    setPendingPaste(null);
    showWarning(
      "Paste detected. You can continue, but your instructor may review paste activity for this assignment."
    );

    requestAnimationFrame(() => {
      const editor = draftEditorRef.current;
      const caret = start + pendingPaste.text.length;
      editor?.focus();
      editor?.setSelectionRange(caret, caret);
    });
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
        "Drag and drop is disabled for this assignment based on your instructor’s settings."
      );
    }
  }

  function handleBlur() {
    /*
     * Switching browser tabs can throttle the normal debounced autosave.
     * Flush the exact controlled-editor value before any focus-triggered
     * workspace refresh occurs, regardless of whether focus monitoring is
     * enabled for this assignment.
     */
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const savedAt = persistWritingEvidence(draftValue);
    setLastSavedAt(savedAt);
    setSaveStatus("saved");

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

  }

  function handleReviewDraft() {
    if (!hasDraftText) {
      showWarning(
        "Write part of your draft before continuing."
      );
      return;
    }

    /*
      Do not wait for the 700 ms debounce when the student moves on.
      Save the exact editor value now, then pass that same value through
      central navigation.
    */
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const savedAt =
      persistWritingEvidence(draftValue);

    setLastSavedAt(savedAt);
    setSaveStatus("saved");

    const moved = goToStudentStep(3, {
      draftText: draftValue,
      currentText: draftValue,
    });

    if (!moved) {
      setSaveStatus("error");
      showWarning(
        "Praxis could not open Feedback. Your latest draft is saved. Close this message and try again."
      );
    }
  }

  function handleContinueForward() {
    if (!hasDraftText) {
      showWarning("Write part of your draft before continuing.");
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }

    const savedAt = persistWritingEvidence(draftValue);
    setLastSavedAt(savedAt);
    setSaveStatus("saved");

    goToStudentStep(4, {
      draftText: draftValue,
      currentText: draftValue,
      finalText: draftValue,
      skipFeedbackPrompt: rubricComplete,
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 pb-2">
      {/* Compact progress and editor toolbar */}
      <div className="z-30 shrink-0 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-900/5 backdrop-blur">
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

            <div className="flex w-full shrink-0 items-center gap-2 lg:w-auto lg:justify-end">
              <button
                type="button"
                onClick={() => goToStudentStep(1)}
                className="hidden items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 transition-all hover:bg-blue-50 hover:text-blue-700 sm:inline-flex"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Coach
              </button>

              <div className="grid flex-1 grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 sm:flex-none">
                <button
                  type="button"
                  aria-current="page"
                  className="rounded-lg bg-white px-4 py-2.5 text-xs font-bold text-blue-700 shadow-sm"
                >
                  Draft
                </button>
                <button
                  type="button"
                  onClick={handleReviewDraft}
                  disabled={!canReview}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs font-bold text-slate-500 transition-all hover:bg-white hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Feedback
                </button>
              </div>

              {rubricTransitionNoticeOpen ? (
                <div className="hidden items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 xl:inline-flex">
                  Choose an option above
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleContinueForward}
                  disabled={!hasDraftText}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                >
                  {rubricComplete ? "Continue to Submit" : "Continue to Rubric Check"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
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

      {integrityWarning && workflowAlertSlot &&
        createPortal(
          <div
            role="status"
            className="flex max-w-md items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-semibold leading-4 text-amber-800 shadow-sm"
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{integrityWarning}</span>
          </div>,
          workflowAlertSlot
        )}

      {outlineRebuildPrompt && (
        <div className="shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />

            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-bold">
                Replace your edited outline?
              </h3>

              <p className="mt-1 text-[11px] leading-relaxed text-blue-800">
                Rebuilding will replace the outline notes you edited. Your draft text will not be changed.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    generateOutline({
                      force: true,
                      confirmed: true,
                    })
                  }
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-bold text-white hover:bg-blue-700"
                >
                  Rebuild Outline
                </button>

                <button
                  type="button"
                  onClick={() => setOutlineRebuildPrompt(false)}
                  className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100"
                >
                  Keep My Outline
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* The real writing editor stays primary on the left.
          When the automatic outline is enabled, the editable outline
          appears as a right-side planning panel on desktop. */}
      <div
        className={`grid min-h-[300px] w-full flex-1 gap-3 ${
          showChatOutline
            ? "grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_420px]"
            : "grid-cols-1"
        }`}
      >
        <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="shrink-0 flex flex-col gap-2 border-b border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Draft Editor
                </h2>

                <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-blue-700">
                  Write your essay here
                </span>
              </div>

              <p className="mt-0.5 text-[11px] text-slate-500">
                Type the full assignment below. The outline is only for planning notes.
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
            ref={draftEditorRef}
            aria-label="Draft editor  -  write your essay here"
            value={draftValue}
            onChange={handleDraftChange}
            onPaste={handlePaste}
            onCopy={handleCopy}
            onCut={handleCut}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onBlur={handleBlur}
            placeholder="Start with your main idea. Use your planning notes to guide your own writing."
            className="min-h-0 w-full flex-1 resize-none overflow-y-auto bg-[#F8FAFC] px-5 py-5 text-sm leading-7 text-slate-800 placeholder-slate-400 outline-none transition-all focus:bg-white"
          />

        </section>

        {showChatOutline && (
          <ChatOutlinePanel
            value={chatOutlineText}
            status={outlineStatus}
            busy={outlineBusy}
            onChange={handleOutlineChange}
            onRebuild={() =>
              generateOutline({ force: true })
            }
          />
        )}
      </div>

      {pendingPaste && (
        <div
          className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="paste-review-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-50 text-amber-700">
                <ShieldAlert className="h-5 w-5" />
              </div>

              <div>
                <h2 id="paste-review-title" className="text-base font-bold text-slate-900">
                  Paste detected
                </h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Keep pasted text only when it is fair use, such as a short quotation you are analyzing. Paste activity may be reviewed by your instructor.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => resolvePendingPaste(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                Remove Pasted Text
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => resolvePendingPaste(true)}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
              >
                Keep Pasted Text
              </button>
            </div>
          </section>
        </div>
      )}

    </div>
  );
}

function ChatOutlinePanel({
  value,
  status,
  busy,
  onChange,
  onRebuild,
}) {
  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-blue-200 border-t-4 border-t-blue-600 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-blue-700" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Outline  -  short notes only
            </h2>
          </div>

          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            This is a planning outline, not your essay. Edit the notes before you write.
          </p>
        </div>

        <button
          type="button"
          onClick={onRebuild}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-bold text-blue-700 transition-all hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Sparkles
            className={`h-3.5 w-3.5 ${
              busy ? "animate-pulse" : ""
            }`}
          />
          {busy
            ? "Building..."
            : "Rebuild from chat"}
        </button>
      </div>

      <p
        className={`mt-3 min-h-[1rem] text-[11px] ${
          busy
            ? "font-semibold text-blue-700"
            : "text-slate-500"
        }`}
      >
        {status}
      </p>

      <textarea
        aria-label="Editable planning outline"
        value={value}
        onChange={onChange}
        placeholder="Short bullet notes only. Write your full essay in the Draft Editor."
        className="mt-2 min-h-0 w-full flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
      />

      <p className="mt-2 text-[10px] leading-relaxed text-slate-500">
        Keep this to short notes and bullets. Write the full assignment in the Draft Editor on the left.
      </p>
    </section>
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
