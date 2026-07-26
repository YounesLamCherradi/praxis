import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudentWorkspace } from "../../../hooks/useStudentWorkspace";
import { requestJson } from "../../../services/auth";
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const AI_ENDPOINT = `${API_BASE_URL}/api/generate`;

const REVIEW_PROGRESS_MESSAGES = [
  "Reading your draft carefully...",
  "Checking if your draft answers the assignment prompt...",
  "Looking for clear examples and details...",
  "Checking organization, clarity, and flow...",
  "Finding exact parts of the draft to highlight...",
  "Preparing feedback without rewriting your essay...",
  "Almost done. Longer drafts can take a little more time...",
];

const AI_RETRY_DELAYS_MS = [700, 1400];

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

async function requestDraftFeedback(payload) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt <= AI_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      return await requestJson(
        AI_ENDPOINT,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
        {
          errorPrefix: "Draft review failed",
        }
      );
    } catch (error) {
      lastError = error;

      if (
        error?.retryable !== true ||
        attempt >= AI_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      await wait(AI_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

function getText(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function countWords(text) {
  const clean = getText(text);
  if (!clean) return 0;
  return clean.split(/\s+/).filter(Boolean).length;
}

function formatRubricForPrompt(rubric) {
  if (!Array.isArray(rubric) || rubric.length === 0) return "";

  return rubric
    .map((item, index) => {
      const name =
        item?.name ||
        item?.title ||
        item?.criterion ||
        `Criterion ${index + 1}`;

      const description =
        item?.description ||
        item?.details ||
        item?.expectation ||
        "";

      const points =
        item?.points ||
        item?.score ||
        item?.maxPoints ||
        "";

      return `${name}${points ? ` (${points} points)` : ""}: ${description}`;
    })
    .join("\n");
}

function extractJsonFromText(text) {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Continue below.
  }

  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");

  if (
    firstBracket !== -1 &&
    lastBracket !== -1 &&
    lastBracket > firstBracket
  ) {
    try {
      return JSON.parse(raw.slice(firstBracket, lastBracket + 1));
    } catch {
      // Continue below.
    }
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    try {
      return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function extractQuotedExcerpt(feedbackText) {
  const text = getText(feedbackText);
  if (!text) return "";

  const quoteMatch =
    text.match(/"([^"]{3,160})"/) ||
    text.match(/“([^”]{3,160})”/) ||
    text.match(/'([^']{3,160})'/);

  return getText(quoteMatch?.[1] || "");
}

function getLineNumberFromText(value) {
  const match = String(value || "").match(/\bline\s+(\d+)\b/i);
  const number = Number(match?.[1]);

  return Number.isFinite(number) && number > 0 ? number : null;
}

function normalizeSeverity(value) {
  const clean = getText(value).toLowerCase();

  if (clean === "major" || clean === "minor") {
    return clean;
  }

  return "medium";
}

function normalizeIssue(issue, index) {
  if (typeof issue === "string") {
    const feedbackText = getText(issue);

    return {
      id: `issue_${index + 1}`,
      lineNumber: getLineNumberFromText(feedbackText),
      excerpt: extractQuotedExcerpt(feedbackText),
      problem: feedbackText,
      suggestion: "",
      severity: "medium",
    };
  }

  const feedbackText = getText(
    issue?.problem ||
      issue?.issue ||
      issue?.comment ||
      issue?.text ||
      issue?.feedback
  );

  const rawLineNumber =
    issue?.lineNumber ??
    issue?.line ??
    issue?.sentenceNumber ??
    getLineNumberFromText(feedbackText);

  const lineNumber = Number(rawLineNumber);

  return {
    id: issue?.id || `issue_${index + 1}`,
    lineNumber:
      Number.isFinite(lineNumber) && lineNumber > 0
        ? lineNumber
        : null,
    excerpt: getText(
      issue?.excerpt ||
        issue?.quote ||
        issue?.selectedText ||
        extractQuotedExcerpt(feedbackText)
    ),
    problem: feedbackText,
    suggestion: "",
    severity: normalizeSeverity(issue?.severity),
  };
}

function normalizeFeedback(data) {
  const responseText =
    data?.response ||
    data?.reply ||
    data?.message ||
    "";

  const parsed = extractJsonFromText(responseText);

  const rawIssues = Array.isArray(parsed)
    ? parsed
    : safeArray(
        parsed?.items ||
          parsed?.feedbackItems ||
          parsed?.issues
      );

  const issues = rawIssues
    .map(normalizeIssue)
    .filter((issue) => issue.problem)
    .slice(0, 4);

  return {
    overall: "",
    strengths: [],
    items: issues.map((issue) => issue.problem),
    issues,
    nextSteps: [],
    rawText: responseText,
    createdAt: new Date().toISOString(),
  };
}

function normalizeSavedFeedbackRecord(record) {
  if (!record) return null;

  const source =
    record.feedback && typeof record.feedback === "object"
      ? record.feedback
      : record;

  const savedItems = safeArray(
    source.items ||
      source.feedbackItems ||
      record.items ||
      record.feedbackItems
  )
    .map(getText)
    .filter(Boolean)
    .slice(0, 4);

  const savedIssues = safeArray(
    source.issues ||
      record.issues
  )
    .map(normalizeIssue)
    .filter((issue) => issue.problem)
    .slice(0, 4);

  const issues = savedIssues.length
    ? savedIssues
    : savedItems.map(normalizeIssue);

  const items = issues.length
    ? issues.map((issue) => issue.problem)
    : savedItems;

  return {
    overall: "",
    strengths: [],
    items,
    issues,
    nextSteps: [],
    rawText: source.rawText || record.rawText || "",
    reviewedText:
      source.reviewedText ||
      source.draftTextAtRequest ||
      record.draftTextAtRequest ||
      "",
    createdAt:
      source.createdAt ||
      record.createdAt ||
      record.timestamp ||
      record.reviewedAt ||
      "",
    saved: true,
  };
}

function getLatestSavedAiFeedback(feedbackHistory = []) {
  const savedAiReview = safeArray(feedbackHistory)
    .slice()
    .reverse()
    .find((item) => {
    const role = String(item?.role || "").toLowerCase();
    const type = String(item?.type || "").toLowerCase();
    const source = String(item?.source || "").toLowerCase();

    return (
      role === "ai" ||
      type === "draft_review" ||
      source === "claude" ||
      source === "ai"
    );
  });

  return normalizeSavedFeedbackRecord(savedAiReview);
}

function isLargeSingleInsertEvent(event) {
  return (
    String(event?.type || "").toLowerCase() === "insert" &&
    String(event?.insertedText || "").length >= 80 &&
    !String(event?.removedText || "")
  );
}

function isPasteLikeWritingEvent(event) {
  const type = String(
    event?.type ||
      event?.action ||
      event?.eventGroup ||
      ""
  ).toLowerCase();

  return Boolean(
    type.includes("paste") ||
      event?.flagged ||
      isLargeSingleInsertEvent(event)
  );
}

function assignmentUsesSingleParagraph(assignment = {}) {
  const haystack = `${assignment?.title || ""} ${
    assignment?.brief || ""
  } ${assignment?.prompt || assignment?.instructions || ""}`.toLowerCase();

  return /\bparagraph\b/.test(haystack) && !/\bparagraphs\b/.test(haystack);
}

function buildSentenceLineEntries(text = "") {
  const source = String(text || "");
  const matches =
    source.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

  let searchFrom = 0;

  return matches
    .map((sentence, index) => {
      const clean = sentence.trim();
      if (!clean) return null;

      const start = source.indexOf(clean, searchFrom);
      const safeStart = start >= 0 ? start : searchFrom;
      const end = safeStart + clean.length;

      searchFrom = end;

      return {
        number: index + 1,
        text: clean,
        start: safeStart,
        end,
      };
    })
    .filter(Boolean);
}

function buildPhysicalLineEntries(text = "") {
  const source = String(text || "");
  const entries = [];
  let cursor = 0;

  source.split("\n").forEach((line, index) => {
    const start = cursor;
    const end = start + line.length;

    entries.push({
      number: index + 1,
      text: line,
      start,
      end,
    });

    cursor = end + 1;
  });

  return entries;
}

function buildDraftLinesWithPasteMarkers({
  draftText,
  assignment,
  submission,
}) {
  const text = String(draftText || "");

  const flaggedRanges = safeArray(submission?.writingEvents)
    .filter(
      (event) =>
        isPasteLikeWritingEvent(event) &&
        typeof event?.start === "number"
    )
    .map((event) => ({
      start: Number(event.start || 0),
      end:
        Number(event.end ?? event.start ?? 0) +
        String(event.insertedText || "").length,
    }));

  const entries = assignmentUsesSingleParagraph(assignment)
    ? buildSentenceLineEntries(text)
    : buildPhysicalLineEntries(text);

  return entries.map((entry) => ({
    number: entry.number,
    text: entry.text,
    pasted: flaggedRanges.some(
      (range) =>
        entry.start < range.end &&
        entry.end > range.start
    ),
  }));
}

function stringifyLinesWithMarkers(lines = []) {
  return safeArray(lines)
    .map(
      (line) =>
        `Line ${line.number}${
          line.pasted ? " [PASTED]" : ""
        }: ${line.text}`
    )
    .join("\n");
}

function getPreviousFeedbackItems(feedbackHistory = []) {
  return safeArray(feedbackHistory)
    .flatMap((entry) =>
      safeArray(
        entry?.items ||
          entry?.feedbackItems ||
          entry?.feedback?.items
      )
    )
    .map(getText)
    .filter(Boolean)
    .slice(0, 12);
}

function buildDraftFeedbackRequest({
  assignment,
  submission,
  draftText,
  assignmentTitle,
  assignmentPrompt,
  assignmentType,
  languageLevel,
  minWords,
  maxWords,
  rubricText,
}) {
  const lines = buildDraftLinesWithPasteMarkers({
    draftText,
    assignment,
    submission,
  }).filter((line) => String(line.text || "").trim());

  const previousFeedback = getPreviousFeedbackItems(
    submission?.feedbackHistory
  ).join("\n- ");

  const responseShape = `[
  {
    "lineNumber": 2,
    "excerpt": "exact words copied from the student's draft",
    "comment": "Explain the problem without rewriting the sentence.",
    "severity": "major"
  }
]`;

  return {
    maxTokens: 900,
    temperature: 0.2,
    system: `You are a careful writing instructor giving feedback to an ESL student.

Return ONLY a JSON array containing 2 to 4 feedback objects.

Every object must contain:
- lineNumber: the visible line or sentence number.
- excerpt: an exact 3-to-160 character phrase copied verbatim from the student's draft.
- comment: a short explanation of what the student should review.
- severity: "major", "medium", or "minor".

Rules:
- The excerpt MUST appear exactly in the submitted draft. Never paraphrase it.
- Highlight the smallest useful phrase, not an entire paragraph.
- Use the supplied line numbers. For a one-paragraph task, each numbered item is a sentence.
- Ignore [PASTED] markers when judging quality, but preserve the numbering.
- Identify specific, measurable problems in the student's writing.
- Do NOT rewrite, correct, or complete a sentence for the student.
- Do NOT provide a replacement thesis, paragraph, or answer.
- Do NOT repeat an issue already included in previous feedback.
- Match the assignment type. Do not treat a paragraph task as a multi-paragraph essay.
- Prefer grammar, punctuation, spelling, logic, missing support, weak topic sentence, unclear wording, or weak ending.
- On very short drafts, use at most two excerpt-based notes, then give structure or length guidance using an excerpt from the draft.
- Keep comments simple and direct for a ${languageLevel || "B1"} student.`,
    prompt: `Assignment title: ${assignmentTitle}
Assignment type: ${assignmentType}
Expected length: ${minWords}-${maxWords} words
Student-facing task:
${assignmentPrompt}

Rubric summary:
${rubricText || "No rubric provided."}

Draft with visible line numbers:
${stringifyLinesWithMarkers(lines)}

Previous feedback already given (avoid repeating these ideas):
- ${previousFeedback || "None"}

Return only valid JSON in this shape:
${responseShape}`,
  };
}

function getEntriesForAssignment(text, assignment = {}) {
  return assignmentUsesSingleParagraph(assignment)
    ? buildSentenceLineEntries(text)
    : buildPhysicalLineEntries(text);
}

function findIssueRangeInText(text, issue, assignment = {}) {
  const draft = String(text || "");
  const excerpt = getText(issue?.excerpt);

  if (excerpt.length >= 3) {
    const start = draft
      .toLowerCase()
      .indexOf(excerpt.toLowerCase());

    if (start !== -1) {
      return {
        start,
        end: start + excerpt.length,
        matchType: "excerpt",
      };
    }
  }

  const lineNumber = Number(issue?.lineNumber);

  if (Number.isFinite(lineNumber) && lineNumber > 0) {
    const entry = getEntriesForAssignment(
      draft,
      assignment
    ).find((item) => item.number === lineNumber);

    if (entry && entry.end > entry.start) {
      return {
        start: entry.start,
        end: entry.end,
        matchType: "line",
      };
    }
  }

  return null;
}

function findHighlightRanges(text, issues, assignment = {}) {
  const ranges = [];

  safeArray(issues).forEach((issue, issueIndex) => {
    const range = findIssueRangeInText(
      text,
      issue,
      assignment
    );

    if (!range) return;

    ranges.push({
      ...range,
      issueIndex,
      issue,
    });
  });

  return ranges
    .sort((a, b) => a.start - b.start)
    .filter((range, index, sorted) => {
      if (index === 0) return true;
      return range.start >= sorted[index - 1].end;
    });
}

function formatReviewTime(timestamp) {
  if (!timestamp) return "";

  try {
    return new Date(timestamp).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function buildFeedbackHistoryEntry({
  feedback,
  assignmentId,
  assignmentTitle,
  wordCount,
}) {
  const createdAt = feedback.createdAt || new Date().toISOString();

  return {
    id: `ai_feedback_${Date.now()}`,
    role: "ai",
    type: "draft_review",
    source: "claude",
    createdAt,
    assignmentId,
    assignmentTitle,
    draftWordCount: wordCount,
    reviewedText: feedback.reviewedText || "",
    items: safeArray(feedback.items),
    issues: safeArray(feedback.issues),
    rawText: feedback.rawText || "",
  };
}

function getIssueTone(issue = {}) {
  const severity = String(issue.severity || "medium").toLowerCase();

  if (severity === "major") {
    return {
      mark:
        "bg-red-200 text-red-950 decoration-red-600 hover:bg-red-300 focus:bg-red-300",
      badge: "border-red-200 bg-red-50 text-red-700",
      border: "border-red-200",
      title: "Major revision",
    };
  }

  if (severity === "minor") {
    return {
      mark:
        "bg-sky-200 text-sky-950 decoration-sky-600 hover:bg-sky-300 focus:bg-sky-300",
      badge: "border-sky-200 bg-sky-50 text-sky-700",
      border: "border-sky-200",
      title: "Small improvement",
    };
  }

  return {
    mark:
      "bg-amber-200 text-amber-950 decoration-amber-600 hover:bg-amber-300 focus:bg-amber-300",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-amber-200",
    title: "Revision note",
  };
}

function getFloatingCommentPosition(rect) {
  const width = 360;
  const margin = 14;

  let left = rect.left;
  let top = rect.bottom + 10;

  if (left + width > window.innerWidth - margin) {
    left = window.innerWidth - width - margin;
  }

  if (left < margin) {
    left = margin;
  }

  if (top > window.innerHeight - 245) {
    top = Math.max(margin, rect.top - 225);
  }

  return {
    left,
    top,
    width: Math.min(width, window.innerWidth - margin * 2),
  };
}

function InlineFeedbackMark({
  text,
  issue,
  number,
  highlightIndex,
  active = false,
  onSelectIssue,
}) {
  const markRef = useRef(null);
  const hideTimerRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const tone = getIssueTone(issue);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

  function cancelScheduledHide() {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function showTooltip(sticky = false) {
    if (!markRef.current) return;

    cancelScheduledHide();

    const rect = markRef.current.getBoundingClientRect();

    setTooltip({
      ...getFloatingCommentPosition(rect),
      sticky,
    });
  }

  function scheduleHide() {
    cancelScheduledHide();

    hideTimerRef.current = window.setTimeout(() => {
      setTooltip((current) => {
        if (current?.sticky) return current;
        return null;
      });
    }, 180);
  }

  function openDetails(event) {
    event.stopPropagation();

    if (typeof onSelectIssue === "function") {
      onSelectIssue(issue, number, highlightIndex);
    }

    showTooltip(true);
  }

  return (
    <>
      <mark
        ref={markRef}
        tabIndex={0}
        data-feedback-highlight-index={highlightIndex}
        aria-label={`Feedback note ${number}: ${issue?.problem || "Review this text"}`}
        onMouseEnter={() => showTooltip(false)}
        onMouseLeave={scheduleHide}
        onFocus={() => showTooltip(false)}
        onBlur={scheduleHide}
        onClick={openDetails}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openDetails(event);
          }
        }}
        className={`relative cursor-pointer rounded-md px-1.5 py-0.5 font-bold underline decoration-2 underline-offset-2 outline-none transition-all focus:ring-4 focus:ring-blue-500/15 ${
          active
            ? "ring-2 ring-blue-500 ring-offset-2"
            : "hover:-translate-y-[1px]"
        } ${tone.mark}`}
      >
        {text}

        <sup className="ml-0.5 text-[8px] font-mono font-black">
          {number}
        </sup>
      </mark>

      {tooltip &&
        createPortal(
          <div
            className={`fixed z-[2147483647] rounded-2xl border bg-white p-4 shadow-2xl ${tone.border}`}
            style={{
              left: `${tooltip.left}px`,
              top: `${tooltip.top}px`,
              width: `${tooltip.width}px`,
            }}
            onMouseEnter={cancelScheduledHide}
            onMouseLeave={() => {
              if (!tooltip.sticky) {
                scheduleHide();
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider ${tone.badge}`}
                >
                  Note {number}
                </span>

                <span className="text-[10px] font-bold text-slate-500">
                  {tone.title}
                </span>
              </div>

              {tooltip.sticky && (
                <button
                  type="button"
                  onClick={() => setTooltip(null)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-900"
                  aria-label="Close feedback details"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {issue.excerpt && (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
                  Highlighted text
                </p>

                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-700">
                  “{issue.excerpt}”
                </p>
              </div>
            )}

            {issue.problem && (
              <div className="mt-3">
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
                  What to review
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {issue.problem}
                </p>
              </div>
            )}

            {!tooltip.sticky && (
              <p className="mt-3 text-[9px] font-mono text-slate-400">
                Click the highlight to keep this feedback open.
              </p>
            )}

          </div>,
          document.body
        )}
    </>
  );
}

function HighlightedDraftPreview({
  reviewedText,
  issues,
  assignment,
  activeIssueId,
  onSelectIssue,
}) {
  const ranges = useMemo(
    () =>
      findHighlightRanges(
        reviewedText,
        issues,
        assignment
      ),
    [reviewedText, issues, assignment]
  );

  if (!reviewedText) {
    return (
      <p className="text-xs italic text-slate-400">
        Request feedback to create a highlighted reviewed version.
      </p>
    );
  }

  if (ranges.length === 0) {
    return (
      <div>
        <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
          {reviewedText}
        </p>

        {safeArray(issues).length > 0 && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            The feedback is saved, but this older review did not contain an exact phrase that Praxis could highlight.
          </p>
        )}
      </div>
    );
  }

  const parts = [];
  let cursor = 0;

  ranges.forEach((range, rangeIndex) => {
    if (range.start > cursor) {
      parts.push({
        type: "text",
        text: reviewedText.slice(
          cursor,
          range.start
        ),
      });
    }

    parts.push({
      type: "highlight",
      text: reviewedText.slice(
        range.start,
        range.end
      ),
      issue: range.issue,
      number: rangeIndex + 1,
      highlightIndex: rangeIndex,
    });

    cursor = range.end;
  });

  if (cursor < reviewedText.length) {
    parts.push({
      type: "text",
      text: reviewedText.slice(cursor),
    });
  }

  return (
    <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
      {parts.map((part, index) => {
        if (part.type === "highlight") {
          return (
            <InlineFeedbackMark
              key={`highlight-${index}`}
              text={part.text}
              issue={part.issue}
              number={part.number}
              highlightIndex={part.highlightIndex}
              active={
                String(activeIssueId || "") ===
                String(part.issue?.id || "")
              }
              onSelectIssue={onSelectIssue}
            />
          );
        }

        return (
          <React.Fragment key={`text-${index}`}>
            {part.text}
          </React.Fragment>
        );
      })}
    </p>
  );
}

function ReviewProgressBox({ progressMessage }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
      <div className="flex items-start gap-2">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-700" />

        <div>
          <p className="text-xs font-bold text-blue-900">
            {progressMessage || "Checking your draft..."}
          </p>

          <p className="mt-1 text-[11px] leading-relaxed text-blue-700">
            The coach is checking the draft against the assignment and previous feedback.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Step3AIFeedback() {
  const {
    activeAssignment,
    activeSubmission,
    typedText,
    setTypedText,
    goToStudentStep,
    saveDraftProgress,
    studentWorkflowNotice,
  } = useStudentWorkspace();

  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [viewMode, setViewMode] = useState("edit");
  const [selectionMessage, setSelectionMessage] = useState("");
  const [showGeneralNotes, setShowGeneralNotes] = useState(false);
  const [selectedIssueId, setSelectedIssueId] = useState("");
  const editorRef = useRef(null);

  const assignmentId =
    activeAssignment?.id ||
    activeSubmission?.assignmentId ||
    null;

  const draftText = String(
    typedText ??
      activeSubmission?.finalText ??
      activeSubmission?.draftText ??
      activeSubmission?.content ??
      ""
  );

  const wordCount = countWords(draftText);

  const feedbackTransitionNoticeOpen = Boolean(
    studentWorkflowNotice &&
      Number(
        studentWorkflowNotice?.pendingTransition?.targetStep
      ) === 4
  );

  const assignmentTitle =
    activeAssignment?.title ||
    activeSubmission?.assignmentTitle ||
    "Untitled Assignment";

  const assignmentPrompt =
    activeAssignment?.prompt ||
    activeAssignment?.instructions ||
    activeAssignment?.description ||
    activeSubmission?.prompt ||
    activeSubmission?.instructions ||
    activeSubmission?.description ||
    "No instructions provided.";

  const assignmentType =
    activeAssignment?.assignmentType ||
    activeAssignment?.type ||
    activeSubmission?.assignmentType ||
    "response";

  const languageLevel =
    activeAssignment?.languageLevel ||
    activeAssignment?.studentLevel ||
    activeAssignment?.level ||
    activeSubmission?.languageLevel ||
    "B1";

  const minWords =
    activeAssignment?.wordCountMin ??
    activeAssignment?.minWords ??
    activeSubmission?.wordCountMin ??
    activeSubmission?.minWords ??
    0;

  const maxWords =
    activeAssignment?.wordCountMax ??
    activeAssignment?.maxWords ??
    activeSubmission?.wordCountMax ??
    activeSubmission?.maxWords ??
    0;

  const rubricText =
    formatRubricForPrompt(activeAssignment?.rubric) ||
    formatRubricForPrompt(activeAssignment?.rubricSchema?.criteria) ||
    formatRubricForPrompt(activeAssignment?.rubricCriteria) ||
    "";

  const aiFeedbackAllowed =
    activeAssignment?.aiDraftFeedback !== false &&
    activeAssignment?.aiFeedback !== false &&
    activeAssignment?.allowAI !== false;

  const feedbackLimit = Math.max(
    0,
    Math.floor(
      Number(
        activeAssignment?.feedbackRequestLimit ??
          activeAssignment?.feedbackChecks ??
          activeSubmission?.feedbackRequestLimit ??
          0
      ) || 0
    )
  );

  const feedbackHistory = safeArray(activeSubmission?.feedbackHistory);

  const feedbackChecksUsed =
    Math.max(
      0,
      Math.floor(
        Number(activeSubmission?.feedbackChecksUsed || 0) || 0
      )
    ) ||
    feedbackHistory.filter((item) => {
      const role = String(item?.role || "").toLowerCase();
      const type = String(item?.type || "").toLowerCase();
      const source = String(item?.source || "").toLowerCase();

      return (
        role === "ai" ||
        type === "draft_review" ||
        source === "claude" ||
        source === "ai"
      );
    }).length;

  const feedbackChecksRemaining = Math.max(
    0,
    feedbackLimit - feedbackChecksUsed
  );

  const feedbackLimitReached =
    feedbackChecksUsed >= feedbackLimit;

  useEffect(() => {
    const savedFeedback = getLatestSavedAiFeedback(
      activeSubmission?.feedbackHistory
    );

    setFeedback(savedFeedback || null);
    // This component is opened from the shared "AI Feedback" tab. Always
    // keep that tab active; without a saved review it presents the existing
    // request-feedback action instead of mounting a second draft screen.
    setViewMode("feedback");
    setShowGeneralNotes(false);
    setSelectedIssueId("");
  }, [
    activeSubmission?.id,
  ]);

  useEffect(() => {
    if (!assignmentId) return;

    const savedFinal = String(activeSubmission?.finalText || "");
    const savedDraft = String(activeSubmission?.draftText || "");

    if (!savedFinal.trim() && savedDraft.trim()) {
      setTypedText(savedDraft);
      saveDraftProgress(assignmentId, {
        finalText: savedDraft,
        finalInitializedAt: new Date().toISOString(),
      });
    }
  }, [assignmentId, activeSubmission?.id]);

  function handleFinalTextChange(event) {
    const nextText = event.target.value;

    setSelectionMessage("");
    setTypedText(nextText);

    if (assignmentId && typeof saveDraftProgress === "function") {
      saveDraftProgress(assignmentId, {
        finalText: nextText,
        wordCount: countWords(nextText),
        finalSavedAt: new Date().toISOString(),
      });
    }
  }

  function saveFeedbackToProgress(nextFeedback) {
    if (!assignmentId || typeof saveDraftProgress !== "function") {
      return false;
    }

    const feedbackEntry = buildFeedbackHistoryEntry({
      feedback: nextFeedback,
      assignmentId,
      assignmentTitle,
      wordCount,
    });

    const previousHistory = safeArray(activeSubmission?.feedbackHistory);

    const nextFeedbackHistory = [
      ...previousHistory,
      {
        ...feedbackEntry,
        timestamp: feedbackEntry.createdAt,
        draftTextAtRequest: draftText,
        draftWordCountAtRequest: wordCount,
      },
    ].slice(-20);

    return saveDraftProgress(assignmentId, {
      finalText: draftText,
      wordCount,
      feedbackHistory: nextFeedbackHistory,
      feedbackChecksUsed: feedbackChecksUsed + 1,
      lastFeedbackAt: feedbackEntry.createdAt,
    });
  }

  function generateLocalFeedback() {
    const items = [];
    const text = String(draftText || "").trim();
    const sentences =
      text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [];

    if (!text) {
      return [
        "Start with one clear sentence that says what this piece will be about.",
        "Use one of your saved ideas to help you begin.",
      ];
    }

    if (wordCount < Math.max(80, Number(minWords || 0) * 0.4)) {
      items.push(
        "Your draft is still short. Add another example or explanation before requesting another detailed check."
      );
    }

    const first = String(sentences[0] || "").trim();
    const last = String(sentences.at(-1) || "").trim();

    if (first && first.split(/\s+/).length < 6) {
      items.push(
        `Line 1 ("${first.slice(0, 70)}") may not yet state the main idea clearly enough.`
      );
    }

    if (!/\bbecause\b|\bfor example\b|\bfor instance\b|\bsuch as\b/i.test(text)) {
      items.push(
        "The draft needs a clearer reason, example, or supporting detail connected to the main idea."
      );
    }

    if (last && !/[.!?]["')\]]?$/.test(last)) {
      items.push(
        `The final line ("${last.slice(0, 70)}") does not end with clear punctuation.`
      );
    }

    if (
      String(assignmentType).toLowerCase().includes("process") &&
      !/\bfirst\b|\bnext\b|\bthen\b|\bfinally\b/i.test(text)
    ) {
      items.push(
        "The order of the process is difficult to follow because the draft does not use clear step words."
      );
    }

    return (items.length
      ? items
      : [
          "Choose the sentence that feels least clear and check whether its meaning is specific enough for the reader.",
          "Check that every sentence directly supports the assignment task.",
        ]
    ).slice(0, 4);
  }

  async function handleCheckDraft() {
    setReviewError("");

    if (!draftText.trim()) {
      setReviewError("Please write your draft before asking for feedback.");
      return;
    }

    if (!aiFeedbackAllowed) {
      setReviewError("AI feedback is disabled for this assignment.");
      return;
    }

    if (feedbackLimitReached) {
      setReviewError("You have used all available feedback checks.");
      return;
    }

    setIsChecking(true);
    setProgressMessage(REVIEW_PROGRESS_MESSAGES[0]);

    let progressIndex = 0;

    const progressTimer = window.setInterval(() => {
      progressIndex =
        progressIndex + 1 >= REVIEW_PROGRESS_MESSAGES.length
          ? REVIEW_PROGRESS_MESSAGES.length - 1
          : progressIndex + 1;

      setProgressMessage(REVIEW_PROGRESS_MESSAGES[progressIndex]);
    }, 7000);

    try {
      const data = await requestDraftFeedback(
        buildDraftFeedbackRequest({
          assignment: activeAssignment || {},
          submission: activeSubmission || {},
          draftText,
          assignmentTitle,
          assignmentPrompt,
          assignmentType,
          languageLevel,
          minWords,
          maxWords,
          rubricText,
        })
      );

      const normalizedFeedback = normalizeFeedback(data);

      const feedbackToSave = {
        ...normalizedFeedback,
        reviewedText: draftText,
        createdAt: new Date().toISOString(),
        saved: true,
      };

      setFeedback(feedbackToSave);
      setViewMode("feedback");
      setShowGeneralNotes(false);
      setSelectedIssueId("");
      saveFeedbackToProgress(feedbackToSave);
    } catch (error) {
      console.error("AI draft review error:", error);

      const fallbackItems = generateLocalFeedback();

      const fallbackFeedback = {
        overall: "",
        strengths: [],
        items: fallbackItems,
        issues: fallbackItems.map(normalizeIssue),
        nextSteps: [],
        rawText: "",
        reviewedText: draftText,
        createdAt: new Date().toISOString(),
        saved: true,
        fallback: true,
      };

      setFeedback(fallbackFeedback);
      setViewMode("feedback");
      setShowGeneralNotes(false);
      setSelectedIssueId("");
      saveFeedbackToProgress(fallbackFeedback);

      setReviewError(
        "AI feedback was unavailable, so Praxis used the original local feedback fallback."
      );
    } finally {
      window.clearInterval(progressTimer);
      setProgressMessage("");
      setIsChecking(false);
    }
  }

  function handleContinueToFinalSubmission() {
    if (feedbackTransitionNoticeOpen) return;

    if (assignmentId && typeof saveDraftProgress === "function") {
      saveDraftProgress(assignmentId, {
        finalText: draftText,
        wordCount,
      });
    }

    goToStudentStep(4, {
      finalText: draftText,
      currentText: draftText,
    });
  }

  const issues = safeArray(feedback?.issues);

  const reviewedText = String(
    feedback?.reviewedText ||
      activeSubmission?.feedbackHistory?.at?.(-1)?.draftTextAtRequest ||
      draftText ||
      ""
  );

  const highlightRanges = findHighlightRanges(
    reviewedText,
    issues,
    activeAssignment || {}
  );

  const highlightedCount = highlightRanges.length;

  const generalIssues = issues.filter(
    (issue) =>
      !findIssueRangeInText(
        reviewedText,
        issue,
        activeAssignment || {}
      )
  );

  const lastFeedbackTime = formatReviewTime(
    feedback?.createdAt
  );

  function handleSelectIssue(issue) {
    setSelectedIssueId(String(issue?.id || ""));
  }


  return (
    <div className="flex min-h-full flex-col gap-3 pb-1">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Draft & Feedback
                </h3>

                <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-mono font-bold text-blue-700">
                  {wordCount}
                  {Number(maxWords) > 0
                    ? ` / ${maxWords}`
                    : ""}{" "}
                  words
                </span>

                {feedback && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[9px] font-mono font-bold text-amber-800">
                    {highlightedCount} highlight
                    {highlightedCount === 1 ? "" : "s"}
                  </span>
                )}

                <span
                  className={`rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold ${
                    feedbackChecksRemaining > 0
                      ? "border-indigo-100 bg-indigo-50 text-indigo-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {feedbackChecksRemaining} check
                  {feedbackChecksRemaining === 1 ? "" : "s"} left
                </span>
              </div>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Edit one paragraph, then open AI Feedback to see the same paragraph with highlighted notes.
              </p>

              {lastFeedbackTime && (
                <p className="mt-1 text-[9px] font-mono text-slate-400">
                  Last feedback saved {lastFeedbackTime}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIssueId("");
                    goToStudentStep(2, {
                      draftText,
                      currentText: draftText,
                    });
                  }}
                  className={`rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${
                    "text-slate-500 hover:bg-white hover:text-blue-700"
                  }`}
                >
                  Draft
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("feedback")}
                  disabled={!feedback}
                  className={`rounded-lg px-3 py-2 text-[10px] font-bold transition-all ${
                    viewMode === "feedback"
                      ? "bg-white text-blue-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-900"
                  } disabled:cursor-not-allowed disabled:text-slate-300`}
                >
                  AI Feedback
                </button>
              </div>

              <button
                type="button"
                onClick={handleCheckDraft}
                disabled={
                  isChecking ||
                  !draftText.trim() ||
                  !aiFeedbackAllowed ||
                  feedbackLimitReached
                }
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-[11px] font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : feedback ? (
                  <RefreshCw className="h-4 w-4" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}

                {isChecking
                  ? "Checking..."
                  : feedback
                  ? "Request Another Check"
                  : "Get AI Feedback"}
              </button>
            </div>
          </div>

          {selectionMessage && viewMode === "edit" && (
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-800">
              {selectionMessage}
            </div>
          )}

          {reviewError && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{reviewError}</span>
            </div>
          )}

          {isChecking && (
            <div className="mt-3">
              <ReviewProgressBox
                progressMessage={progressMessage}
              />
            </div>
          )}
        </div>

        {viewMode === "edit" ? (
          <textarea
            ref={editorRef}
            id="final-editor"
            aria-label="Final revision editor"
            value={draftText}
            onChange={handleFinalTextChange}
            placeholder="Revise your final paragraph in your own words."
            className="min-h-[470px] w-full resize-none bg-[#F8FAFC] px-6 py-6 text-[15px] leading-8 text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:bg-white"
          />
        ) : (
          <div className="bg-[#F8FAFC]">
            <article className="relative w-full bg-[#F8FAFC]">
              <div className="relative z-10 shrink-0 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
                <div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">
                        Your paragraph with AI highlights
                      </h4>

                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-mono font-bold text-amber-800">
                        {highlightedCount} highlighted note
                        {highlightedCount === 1 ? "" : "s"}
                      </span>
                    </div>

                    <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                      Hover over a highlight for a quick explanation. Click it to keep the feedback details open.
                    </p>
                  </div>

                </div>
              </div>

              <div
                className="max-h-[470px] w-full overflow-y-auto overscroll-contain scroll-smooth px-5 py-5 [scrollbar-gutter:stable] sm:px-7 sm:py-6"
              >
                <div className="w-full">
                  <HighlightedDraftPreview
                    reviewedText={reviewedText}
                    issues={issues}
                    assignment={activeAssignment || {}}
                    activeIssueId={selectedIssueId}
                    onSelectIssue={handleSelectIssue}
                  />

                  {generalIssues.length > 0 && (
                    <div className="mt-7 border-t border-slate-100 pt-4">
                      <button
                        type="button"
                        onClick={() =>
                          setShowGeneralNotes((current) => !current)
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"
                      >
                        {showGeneralNotes ? "Hide" : "View"}{" "}
                        {generalIssues.length} general note
                        {generalIssues.length === 1 ? "" : "s"}
                      </button>

                      {showGeneralNotes && (
                        <div className="mt-3 space-y-2">
                          {generalIssues.map((issue, index) => (
                            <div
                              key={issue.id || `general-note-${index}`}
                              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                            >
                              <p className="text-[9px] font-mono font-black uppercase tracking-wider text-amber-700">
                                General note {index + 1}
                              </p>

                              <p className="mt-1 text-xs leading-relaxed text-amber-950">
                                {issue.problem}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </article>
          </div>
        )}
      </section>

      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Use AI Feedback to locate issues, then return to Draft and revise in your own words.
          </p>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            {feedbackTransitionNoticeOpen ? (
              <div className="inline-flex items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-5 py-3 text-xs font-bold text-blue-700">
                Choose an option above
              </div>
            ) : (
              <button
                type="button"
                onClick={handleContinueToFinalSubmission}
                disabled={!draftText.trim()}
                className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold transition-all ${
                  draftText.trim()
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                    : "cursor-not-allowed bg-slate-100 text-slate-400"
                }`}
              >
                Continue to Rubric Check
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
