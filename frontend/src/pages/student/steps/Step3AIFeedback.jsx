import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useStudentWorkspace } from "../../../contexts/StudentWorkspaceContext";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  Highlighter,
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

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function normalizeIssue(issue, index) {
  return {
    id: issue?.id || `issue_${index + 1}`,
    excerpt: getText(issue?.excerpt || issue?.quote || issue?.text),
    problem: getText(issue?.problem || issue?.issue || issue?.comment),
    suggestion: getText(issue?.suggestion || issue?.advice || issue?.fix),
    severity: getText(issue?.severity || "medium").toLowerCase(),
  };
}

function normalizeFeedback(data) {
  const responseText =
    data?.response ||
    data?.reply ||
    data?.message ||
    "";

  const parsed = extractJsonFromText(responseText);

  if (!parsed) {
    return {
      overall:
        responseText ||
        "The AI feedback was received, but it could not be structured.",
      strengths: [],
      issues: [],
      nextSteps: [],
      rawText: responseText,
      createdAt: new Date().toISOString(),
    };
  }

  return {
    overall: getText(parsed.overall || parsed.summary || ""),
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.map(getText).filter(Boolean)
      : [],
    issues: Array.isArray(parsed.issues)
      ? parsed.issues
          .map(normalizeIssue)
          .filter((issue) => issue.problem || issue.suggestion)
          .slice(0, 5)
      : [],
    nextSteps: Array.isArray(parsed.nextSteps)
      ? parsed.nextSteps.map(getText).filter(Boolean)
      : [],
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

  return {
    overall: getText(source.overall || source.summary || source.text || ""),
    strengths: safeArray(source.strengths).map(getText).filter(Boolean),
    issues: safeArray(source.issues)
      .map(normalizeIssue)
      .filter((issue) => issue.problem || issue.suggestion)
      .slice(0, 5),
    nextSteps: safeArray(source.nextSteps).map(getText).filter(Boolean),
    rawText: source.rawText || record.rawText || "",
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
  const savedAiReview = safeArray(feedbackHistory).find((item) => {
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

function buildDraftReviewSystemPrompt({
  assignmentTitle,
  assignmentPrompt,
  minWords,
  maxWords,
  rubricText,
}) {
  return `
You are the Praxis Draft Review Coach.

You review a student's draft and give revision feedback.

Important rules:
- Do not rewrite the full essay.
- Do not produce a final version for the student.
- Do not write replacement paragraphs.
- Give feedback only.
- Be specific and helpful.
- When pointing out a problem, quote a short exact excerpt from the student's draft.
- The excerpt must be copied exactly from the student's draft so the app can highlight it.
- Keep excerpts short, ideally 3 to 18 words.
- Focus on clarity, organization, assignment alignment, evidence/details, word count, and grammar/style.
- Be encouraging but honest.

Assignment context:
Title: ${assignmentTitle || "Untitled Assignment"}

Prompt / Instructions:
${assignmentPrompt || "No assignment prompt provided."}

Word limits:
Minimum words: ${minWords || "Not specified"}
Maximum words: ${maxWords || "Not specified"}

Rubric / Evaluation criteria:
${rubricText || "No rubric provided."}

Return a maximum of 5 issues. Choose the most important issues only.
Keep the JSON concise so the review can finish quickly.

Return ONLY valid JSON with this exact shape:
{
  "overall": "brief overall feedback",
  "strengths": ["strength 1", "strength 2"],
  "issues": [
    {
      "excerpt": "exact short phrase from the student draft",
      "problem": "what is wrong or weak",
      "suggestion": "how the student can improve it without rewriting the essay",
      "severity": "minor"
    }
  ],
  "nextSteps": ["step 1", "step 2", "step 3"]
}

Use severity as one of: minor, medium, major.
`;
}

function findHighlightRanges(text, issues) {
  const draft = String(text || "");
  const lowerDraft = draft.toLowerCase();
  const ranges = [];

  issues.forEach((issue, issueIndex) => {
    const excerpt = getText(issue.excerpt);

    if (!excerpt || excerpt.length < 3) return;

    const lowerExcerpt = excerpt.toLowerCase();
    const start = lowerDraft.indexOf(lowerExcerpt);

    if (start === -1) return;

    ranges.push({
      start,
      end: start + excerpt.length,
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
    overall: feedback.overall || "",
    strengths: safeArray(feedback.strengths),
    issues: safeArray(feedback.issues),
    nextSteps: safeArray(feedback.nextSteps),
    rawText: feedback.rawText || "",
  };
}

function getIssueTone(issue = {}) {
  const severity = String(issue.severity || "medium").toLowerCase();

  if (severity === "major") {
    return {
      mark:
        "bg-red-100 text-red-950 decoration-red-500 hover:bg-red-200 focus:bg-red-200",
      badge: "border-red-200 bg-red-50 text-red-700",
      border: "border-red-200",
      title: "Major revision",
    };
  }

  if (severity === "minor") {
    return {
      mark:
        "bg-sky-100 text-sky-950 decoration-sky-500 hover:bg-sky-200 focus:bg-sky-200",
      badge: "border-sky-200 bg-sky-50 text-sky-700",
      border: "border-sky-200",
      title: "Small improvement",
    };
  }

  return {
    mark:
      "bg-amber-100 text-amber-950 decoration-amber-500 hover:bg-amber-200 focus:bg-amber-200",
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

function InlineFeedbackMark({ text, issue, number }) {
  const markRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const tone = getIssueTone(issue);

  function showTooltip(sticky = false) {
    if (!markRef.current) return;

    const rect = markRef.current.getBoundingClientRect();

    setTooltip({
      ...getFloatingCommentPosition(rect),
      sticky,
    });
  }

  function hideTooltip() {
    setTooltip((current) => {
      if (current?.sticky) return current;
      return null;
    });
  }

  return (
    <>
      <mark
        ref={markRef}
        tabIndex={0}
        onMouseEnter={() => showTooltip(false)}
        onMouseLeave={hideTooltip}
        onFocus={() => showTooltip(false)}
        onBlur={hideTooltip}
        onClick={(event) => {
          event.stopPropagation();
          showTooltip(true);
        }}
        className={`relative cursor-help rounded px-1 font-semibold underline decoration-2 underline-offset-2 outline-none transition-colors focus:ring-4 focus:ring-blue-500/10 ${tone.mark}`}
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
            onMouseEnter={() =>
              setTooltip((current) =>
                current ? { ...current } : current
              )
            }
            onMouseLeave={() => {
              if (!tooltip.sticky) {
                setTooltip(null);
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
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {issue.problem && (
              <div className="mt-3">
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
                  What to revise
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-700">
                  {issue.problem}
                </p>
              </div>
            )}

            {issue.suggestion && (
              <div className="mt-3 rounded-xl bg-blue-50 px-3 py-2.5">
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-blue-700">
                  How to improve
                </p>

                <p className="mt-1 text-xs leading-relaxed text-blue-900">
                  {issue.suggestion}
                </p>
              </div>
            )}

            {!tooltip.sticky && (
              <p className="mt-3 text-[9px] font-mono text-slate-400">
                Click the highlight to keep this note open.
              </p>
            )}
          </div>,
          document.body
        )}
    </>
  );
}

function HighlightedDraftPreview({ draftText, issues }) {
  const ranges = useMemo(
    () => findHighlightRanges(draftText, issues),
    [draftText, issues]
  );

  if (!draftText) {
    return (
      <p className="text-xs italic text-slate-400">
        No draft text available yet.
      </p>
    );
  }

  if (ranges.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
        {draftText}
      </p>
    );
  }

  const parts = [];
  let cursor = 0;

  ranges.forEach((range, rangeIndex) => {
    if (range.start > cursor) {
      parts.push({
        type: "text",
        text: draftText.slice(cursor, range.start),
      });
    }

    parts.push({
      type: "highlight",
      text: draftText.slice(range.start, range.end),
      issue: range.issue,
      number: rangeIndex + 1,
    });

    cursor = range.end;
  });

  if (cursor < draftText.length) {
    parts.push({
      type: "text",
      text: draftText.slice(cursor),
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

function FeedbackSummaryDrawer({
  open,
  onClose,
  feedback,
  highlightedCount,
}) {
  if (!open || !feedback) return null;

  const strengths = safeArray(feedback.strengths);
  const nextSteps = safeArray(feedback.nextSteps);

  return createPortal(
    <div className="fixed inset-0 z-[2147483646]">
      <button
        type="button"
        aria-label="Close feedback summary"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
      />

      <aside className="absolute inset-y-0 right-0 flex w-[min(92vw,430px)] flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-700" />
                <h3 className="font-serif text-lg font-bold text-slate-950">
                  Feedback Summary
                </h3>
              </div>

              <p className="mt-1 text-[11px] text-slate-500">
                Review the overall guidance without losing your place in the draft.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4">
          <div className="space-y-3">
            <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                <h4 className="text-xs font-bold text-emerald-950">
                  Overall Feedback
                </h4>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-emerald-900">
                {feedback.overall || "Your draft was reviewed."}
              </p>
            </section>

            {strengths.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900">
                    Strengths
                  </h4>

                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-mono font-bold text-emerald-700">
                    {strengths.length}
                  </span>
                </div>

                <ul className="mt-3 space-y-2">
                  {strengths.map((strength, index) => (
                    <li
                      key={`drawer-strength-${index}`}
                      className="flex items-start gap-2 text-xs leading-relaxed text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>{strength}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-amber-950">
                  Inline Revision Notes
                </h4>

                <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-mono font-bold text-amber-800">
                  {highlightedCount}
                </span>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-amber-900">
                Hover over highlighted phrases in the draft to view each comment.
                Click a highlight to pin its comment open.
              </p>
            </section>

            {nextSteps.length > 0 && (
              <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-blue-950">
                    Next Revision Steps
                  </h4>

                  <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-mono font-bold text-blue-700">
                    {nextSteps.length}
                  </span>
                </div>

                <ol className="mt-3 space-y-2">
                  {nextSteps.map((step, index) => (
                    <li
                      key={`drawer-step-${index}`}
                      className="flex items-start gap-2 text-xs leading-relaxed text-blue-900"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-mono font-black text-blue-700">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>
      </aside>
    </div>,
    document.body
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
            The coach is checking the full draft and matching exact excerpts.
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
    setStudentStep,
    saveDraftProgress,
  } = useStudentWorkspace();

  const [isChecking, setIsChecking] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [reviewError, setReviewError] = useState("");
  const [progressMessage, setProgressMessage] = useState("");
  const [showSummary, setShowSummary] = useState(false);

  const assignmentId =
    activeAssignment?.id ||
    activeSubmission?.assignmentId ||
    null;

  const draftText = (
    typedText ||
    activeSubmission?.draftText ||
    activeSubmission?.content ||
    ""
  ).trim();

  const wordCount = countWords(draftText);

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
    activeAssignment?.aiFeedback !== false &&
    activeAssignment?.allowAI !== false;

  const feedbackLimit = Number(
    activeAssignment?.feedbackRequestLimit ??
      activeAssignment?.feedbackChecks ??
      activeSubmission?.feedbackRequestLimit ??
      0
  );

  const feedbackHistory = safeArray(activeSubmission?.feedbackHistory);

  const feedbackChecksUsed =
    Number(activeSubmission?.feedbackChecksUsed || 0) ||
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

  const feedbackChecksRemaining =
    feedbackLimit > 0
      ? Math.max(0, feedbackLimit - feedbackChecksUsed)
      : null;

  const feedbackLimitReached =
    feedbackLimit > 0 && feedbackChecksRemaining <= 0;

  useEffect(() => {
    const savedFeedback = getLatestSavedAiFeedback(
      activeSubmission?.feedbackHistory
    );

    setFeedback(savedFeedback || null);
  }, [
    activeSubmission?.id,
    activeSubmission?.lastFeedbackAt,
    activeSubmission?.feedbackHistory,
  ]);

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
      feedbackEntry,
      ...previousHistory,
    ].slice(0, 20);

    return saveDraftProgress(assignmentId, {
      draftText,
      content: draftText,
      finalText: draftText,
      wordCount,
      feedbackHistory: nextFeedbackHistory,
      feedbackChecksUsed: feedbackChecksUsed + 1,
      lastFeedbackAt: feedbackEntry.createdAt,
    });
  }

  async function handleCheckDraft() {
    setReviewError("");

    if (!draftText) {
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
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system: buildDraftReviewSystemPrompt({
            assignmentTitle,
            assignmentPrompt,
            minWords,
            maxWords,
            rubricText,
          }),
          messages: [
            {
              role: "user",
              content: `
Please review this student draft.

Student draft:
"""
${draftText}
"""

Remember:
- Do not rewrite the full essay.
- Give feedback only.
- Quote exact short excerpts from the draft when identifying issues.
- Return valid JSON only.
`,
            },
          ],
          maxTokens: 900,
          temperature: 0.2,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Draft review failed with status ${response.status}.`
        );
      }

      const normalizedFeedback = normalizeFeedback(data);
      const feedbackToSave = {
        ...normalizedFeedback,
        createdAt: new Date().toISOString(),
        saved: true,
      };

      setFeedback(feedbackToSave);
      saveFeedbackToProgress(feedbackToSave);
    } catch (error) {
      console.error("Claude draft review error:", error);

      setReviewError(
        error?.message ||
          "The AI feedback could not be generated right now."
      );
    } finally {
      window.clearInterval(progressTimer);
      setProgressMessage("");
      setIsChecking(false);
    }
  }

  function handleContinueToFinalSubmission() {
    if (assignmentId && typeof saveDraftProgress === "function") {
      saveDraftProgress(assignmentId, {
        draftText,
        content: draftText,
        finalText: draftText,
        wordCount,
      });
    }

    setStudentStep(4);
  }

  const issues = safeArray(feedback?.issues);
  const highlightedCount = findHighlightRanges(draftText, issues).length;
  const lastFeedbackTime = formatReviewTime(feedback?.createdAt);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {reviewError && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{reviewError}</span>
          </div>
        </div>
      )}

      {isChecking && (
        <div className="shrink-0">
          <ReviewProgressBox progressMessage={progressMessage} />
        </div>
      )}

      {/* Full-width draft with inline feedback */}
      <section className="flex flex-1 min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  Draft with Inline Feedback
                </h3>

                <span className="rounded-full border border-slate-200 bg-[#F8FAFC] px-2.5 py-1 text-[9px] font-mono font-bold text-slate-700">
                  {wordCount}
                  {Number(maxWords) > 0 ? ` / ${maxWords}` : ""} words
                </span>

                {highlightedCount > 0 && (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[9px] font-mono font-bold text-amber-800">
                    {highlightedCount} revision note
                    {highlightedCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <p className="mt-1 text-[11px] text-slate-500">
                Hover over a highlighted phrase to see the comment. Click it to keep the note open.
              </p>

              {lastFeedbackTime && (
                <p className="mt-1 text-[9px] font-mono text-slate-400">
                  Last feedback saved {lastFeedbackTime}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {feedbackChecksRemaining !== null && (
                <span
                  className={`inline-flex items-center rounded-lg border px-2.5 py-1.5 text-[9px] font-mono font-bold ${
                    feedbackChecksRemaining > 0
                      ? "border-blue-100 bg-blue-50 text-blue-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {feedbackChecksRemaining} check
                  {feedbackChecksRemaining === 1 ? "" : "s"} left
                </span>
              )}

              {feedback && (
                <button
                  type="button"
                  onClick={() => setShowSummary(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-2.5 text-xs font-bold text-blue-700 transition-all hover:bg-blue-100"
                >
                  <Eye className="h-4 w-4" />
                  View Feedback Summary
                </button>
              )}

              <button
                type="button"
                onClick={handleCheckDraft}
                disabled={
                  isChecking ||
                  !draftText ||
                  !aiFeedbackAllowed ||
                  feedbackLimitReached
                }
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
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
                  ? "Run Again"
                  : "Get AI Feedback"}
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[430px] overflow-y-auto bg-[#F8FAFC] px-6 py-6">
          <article className="mx-auto w-full max-w-[980px] rounded-2xl border border-slate-200 bg-white px-7 py-7 shadow-sm">
            <HighlightedDraftPreview
              draftText={draftText}
              issues={issues}
            />
          </article>
        </div>
      </section>

      <FeedbackSummaryDrawer
        open={showSummary}
        onClose={() => setShowSummary(false)}
        feedback={feedback}
        highlightedCount={highlightedCount}
      />

      {/* Compact bottom navigation */}
      <div className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] leading-relaxed text-slate-500">
            Review the inline notes, revise your draft if needed, or continue when ready.
          </p>

          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setStudentStep(2)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-slate-600 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Draft
            </button>

            <button
              type="button"
              onClick={handleContinueToFinalSubmission}
              disabled={!draftText}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-xs font-bold transition-all ${
                draftText
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              Continue to Submit
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarPill({ icon: Icon, label, tone = "slate" }) {
  const styles = {
    slate: "border-slate-200 bg-[#F8FAFC] text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-mono font-bold ${
        styles[tone] || styles.slate
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}