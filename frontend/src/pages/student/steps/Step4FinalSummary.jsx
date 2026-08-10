import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useStudentWorkspace } from "../../../hooks/useStudentWorkspace";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Eye,
  FileCheck,
  FileDown,
  Highlighter,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  ShieldCheck,
  X,
} from "lucide-react";

/* =====================================================
   GENERAL HELPERS
===================================================== */

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function countWords(text = "") {
  const clean = String(text || "").trim();

  if (!clean) return 0;

  return clean.split(/\s+/).filter(Boolean).length;
}

function calculateFluencySummary(submission = {}) {
  const events = safeArray(submission?.writingEvents);
  const keystrokes = safeArray(submission?.keystrokeLog);

  const insertionEvents = events.filter((event) =>
    String(event?.type || "").toLowerCase().includes("insert")
  );

  const insertedWords = insertionEvents.map((event) =>
    countWords(event?.insertedText || "")
  );

  const meanBurstLength = insertedWords.length
    ? insertedWords.reduce((sum, value) => sum + value, 0) /
      insertedWords.length
    : 0;

  const pauseCount = keystrokes.filter(
    (entry) => Number(entry?.gap || 0) >= 2000
  ).length;

  const deletionEvents = events.filter((event) =>
    String(event?.type || "").toLowerCase().includes("delete") ||
    Number(event?.deletedChars || 0) > 0
  );

  const microCorrections = deletionEvents.filter(
    (event) => Number(event?.deletedChars || String(event?.removedText || "").length) <= 3
  ).length;

  const substantiveRevisions = events.filter((event) =>
    Number(event?.addedChars || 0) + Number(event?.deletedChars || 0) >= 20
  ).length;

  const localRevisions = Math.max(
    0,
    deletionEvents.length - substantiveRevisions
  );

  const sessionCount = Math.max(
    1,
    events.filter((event) =>
      String(event?.type || "").toLowerCase().includes("session_start")
    ).length || (events.length ? 1 : 0)
  );

  return {
    meanBurstLength,
    pauseFrequency: pauseCount,
    microCorrections,
    localRevisions,
    substantiveRevisions,
    sessionCount,
    calculatedAt: new Date().toISOString(),
  };
}

function formatDateTime(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusLabel(status) {
  const value = String(status || "").toLowerCase();

  if (value === "graded") return "Graded";
  if (value === "submitted") return "Submitted";
  if (value === "reopened") return "Reopened";
  if (value === "late") return "Late";
  if (value === "missing") return "Missing";

  return "Draft";
}

function getSubmissionText(submission, typedText = "") {
  const source =
    submission &&
    typeof submission === "object"
      ? submission
      : {};

  return String(
    source.submittedText ||
      source.submissionText ||
      source.finalText ||
      source.content ||
      source.draftText ||
      source.text ||
      source.essay ||
      source.response ||
      typedText ||
      ""
  ).trim();
}

function getLatestAiFeedback(feedbackHistory = []) {
  return safeArray(feedbackHistory).find((item) => {
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
  });
}

function wrapPdfText(value, maxLength = 88) {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxLength) {
      line = next;
      return;
    }
    if (line) lines.push(line);
    line = word;
  });

  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function downloadGradeReportPdf({ assignment, submission, rubric }) {
  if (!submission) return;

  const criteria = safeArray(rubric?.criteria);
  const rubricScores = submission.rubricScores || {};
  const total =
    Number(submission.rubricTotal || rubric?.totalPoints || 0) ||
    criteria.reduce((sum, criterion) => sum + Number(criterion.points || 0), 0) ||
    100;
  const lines = [
    "PRAXIS GRADE REPORT",
    "",
    `Assignment: ${assignment?.title || submission.assignmentTitle || "Assignment"}`,
    `Attempt: ${Number(submission.attemptNumber || 1)}`,
    `Submitted: ${formatDateTime(submission.submittedAt) || "Not recorded"}`,
    `Reviewed: ${formatDateTime(submission.reviewedAt) || "Not recorded"}`,
    `Final grade: ${submission.score} / ${total}`,
    "",
    "INSTRUCTOR FEEDBACK",
    ...wrapPdfText(submission.feedback || "No overall feedback was provided."),
  ];

  if (criteria.length) {
    lines.push("", "RUBRIC RESULTS");
    criteria.forEach((criterion) => {
      const entry = getRubricScoreEntry(rubricScores, criterion.id);
      lines.push(
        "",
        `${criterion.name}: ${entry.score ?? "-"} / ${criterion.points}`,
        ...wrapPdfText(
          [entry.bandLabel, entry.comment].filter(Boolean).join(" - ") ||
            "No criterion-specific feedback was provided."
        )
      );
    });
  }

  const annotations = safeArray(submission.annotations);
  if (annotations.length) {
    lines.push("", "HIGHLIGHTED NOTES");
    annotations.forEach((annotation, index) => {
      lines.push(
        "",
        ...wrapPdfText(
          `${index + 1}. ${annotation.selectedText ? `\"${annotation.selectedText}\" - ` : ""}${
            annotation.comment || annotation.feedback || annotation.note || "Instructor note"
          }`
        )
      );
    });
  }

  const ascii = (value) =>
    String(value || "")
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
  const pages = [];
  for (let index = 0; index < lines.length; index += 48) {
    pages.push(lines.slice(index, index + 48));
  }

  const objects = [];
  const pageRefs = pages.map((_, index) => 4 + index * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageRefs.map((ref) => `${ref} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  pages.forEach((pageLines, index) => {
    const pageRef = 4 + index * 2;
    const contentRef = pageRef + 1;
    const stream = [
      "BT",
      "/F1 10 Tf",
      "50 790 Td",
      "14 TL",
      ...pageLines.map((line) => `(${ascii(line)}) Tj T*`),
      "ET",
    ].join("\n");
    objects[pageRef] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentRef} 0 R >>`;
    objects[contentRef] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = pdf.length;
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blobUrl = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  const link = document.createElement("a");
  const safeTitle = String(assignment?.title || "assignment")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  link.href = blobUrl;
  link.download = `${safeTitle || "assignment"}-grade.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

/* =====================================================
   RUBRIC HELPERS
===================================================== */

function roundToHalf(value) {
  return Math.round(Number(value || 0) * 2) / 2;
}

function buildDefaultBands(points = 0) {
  const max = Number(points || 0);

  return [
    {
      id: "excellent",
      label: "Excellent",
      points: roundToHalf(max),
      description: "Fully meets or exceeds the criterion expectations.",
    },
    {
      id: "good",
      label: "Good",
      points: roundToHalf(max * 0.85),
      description: "Meets the criterion well with only minor gaps.",
    },
    {
      id: "satisfactory",
      label: "Satisfactory",
      points: roundToHalf(max * 0.7),
      description: "Meets the basic expectations but still needs development.",
    },
    {
      id: "needs-work",
      label: "Needs Work",
      points: roundToHalf(max * 0.5),
      description: "Partially meets the criterion and needs revision.",
    },
    {
      id: "beginning",
      label: "Beginning",
      points: roundToHalf(max * 0.3),
      description: "Shows limited progress toward the criterion.",
    },
  ];
}

function normalizeRubricCriterion(criterion = {}, index = 0) {
  const points = Number(
    criterion.points ??
      criterion.maxPoints ??
      criterion.weight ??
      0
  );

  const rawBands =
    criterion.bands ||
    criterion.levels ||
    criterion.performanceLevels ||
    [];

  return {
    id: criterion.id || `criterion_${index + 1}`,
    name:
      criterion.name ||
      criterion.title ||
      `Criterion ${index + 1}`,
    description:
      criterion.description ||
      criterion.guidelines ||
      criterion.descriptor ||
      "",
    points,
    bands:
      Array.isArray(rawBands) && rawBands.length > 0
        ? rawBands.map((band, bandIndex) => ({
            id: band.id || `band_${bandIndex + 1}`,
            label:
              band.label ||
              band.name ||
              `Level ${bandIndex + 1}`,
            points: Number(
              band.points ??
                band.score ??
                band.value ??
                0
            ),
            description:
              band.description ||
              band.feedback ||
              band.descriptor ||
              "",
          }))
        : buildDefaultBands(points),
  };
}

function normalizeRubricForStudent(
  assignment = {},
  submission = {}
) {
  const rubric =
    assignment.rubricSchema ||
    assignment.rubric ||
    assignment.rubricCriteria ||
    submission.rubricSchema ||
    submission.rubric ||
    submission.rubricCriteria ||
    null;

  if (!rubric) return null;

  if (Array.isArray(rubric)) {
    const criteria = rubric.map(normalizeRubricCriterion);

    return {
      id: "student_rubric",
      title: "Assignment Rubric",
      criteria,
      totalPoints: criteria.reduce(
        (sum, criterion) =>
          sum + Number(criterion.points || 0),
        0
      ),
    };
  }

  const rawCriteria =
    rubric.criteria ||
    rubric.rubricCriteria ||
    rubric.items ||
    rubric.dimensions ||
    [];

  const criteria = Array.isArray(rawCriteria)
    ? rawCriteria.map(normalizeRubricCriterion)
    : [];

  return {
    ...rubric,
    id: rubric.id || "student_rubric",
    title:
      rubric.title ||
      rubric.name ||
      rubric.rubricTitle ||
      "Assignment Rubric",
    criteria,
    totalPoints:
      Number(rubric.totalPoints || rubric.maxPoints || 0) ||
      criteria.reduce(
        (sum, criterion) =>
          sum + Number(criterion.points || 0),
        0
      ),
  };
}

function getRubricScoreEntry(rubricScores, criterionId) {
  const value = rubricScores?.[criterionId];

  if (value && typeof value === "object") {
    return {
      score:
        value.score !== undefined &&
        value.score !== null &&
        value.score !== ""
          ? Number(value.score)
          : null,
      bandLabel:
        value.bandLabel ||
        value.level ||
        value.band ||
        "",
      comment:
        value.comment ||
        value.feedback ||
        value.reason ||
        "",
    };
  }

  if (
    value !== undefined &&
    value !== null &&
    value !== ""
  ) {
    return {
      score: Number(value),
      bandLabel: "",
      comment: "",
    };
  }

  return {
    score: null,
    bandLabel: "",
    comment: "",
  };
}

/* =====================================================
   TEACHER ANNOTATION HELPERS
===================================================== */

function getAnnotationRange(annotation, text, searchFrom = 0) {
  const rawStart = Number(annotation?.rangeStart);
  const rawEnd = Number(annotation?.rangeEnd);

  if (
    Number.isFinite(rawStart) &&
    Number.isFinite(rawEnd) &&
    rawStart >= 0 &&
    rawEnd > rawStart &&
    rawEnd <= text.length
  ) {
    return {
      start: rawStart,
      end: rawEnd,
    };
  }

  const selectedText = String(
    annotation?.selectedText || ""
  );

  if (!selectedText.trim()) return null;

  let index = text.indexOf(selectedText, searchFrom);

  if (index < 0) {
    index = text
      .toLowerCase()
      .indexOf(selectedText.toLowerCase(), searchFrom);
  }

  if (index < 0) return null;

  return {
    start: index,
    end: index + selectedText.length,
  };
}

function normalizeAnnotationRanges(text, annotations) {
  const normalized = [];
  let searchFrom = 0;

  safeArray(annotations).forEach((annotation, index) => {
    const range = getAnnotationRange(
      annotation,
      text,
      searchFrom
    );

    if (!range) return;

    normalized.push({
      ...annotation,
      id:
        annotation.id ||
        `teacher_annotation_${index + 1}`,
      rangeStart: range.start,
      rangeEnd: range.end,
    });

    searchFrom = range.end;
  });

  return normalized
    .sort((a, b) => a.rangeStart - b.rangeStart)
    .filter((annotation, index, sorted) => {
      if (index === 0) return true;

      return (
        annotation.rangeStart >=
        sorted[index - 1].rangeEnd
      );
    });
}

function getAnnotationTone(annotation = {}) {
  const code = String(annotation.code || "").toUpperCase();
  const type = String(annotation.type || "").toLowerCase();

  if (code === "GOOD" || type === "positive") {
    return {
      mark:
        "bg-emerald-100 text-emerald-950 decoration-emerald-500 hover:bg-emerald-200 focus:bg-emerald-200",
      badge:
        "border-emerald-200 bg-emerald-50 text-emerald-700",
      border: "border-emerald-200",
      title: "Positive feedback",
    };
  }

  if (code === "NOTE" || type === "note") {
    return {
      mark:
        "bg-sky-100 text-sky-950 decoration-sky-500 hover:bg-sky-200 focus:bg-sky-200",
      badge:
        "border-sky-200 bg-sky-50 text-sky-700",
      border: "border-sky-200",
      title: "Instructor note",
    };
  }

  return {
    mark:
      "bg-amber-100 text-amber-950 decoration-amber-500 hover:bg-amber-200 focus:bg-amber-200",
    badge:
      "border-amber-200 bg-amber-50 text-amber-800",
    border: "border-amber-200",
    title: "Revision mark",
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

  if (top > window.innerHeight - 250) {
    top = Math.max(margin, rect.top - 225);
  }

  return {
    left,
    top,
    width: Math.min(
      width,
      window.innerWidth - margin * 2
    ),
  };
}

function TeacherAnnotationMark({
  text,
  annotation,
  number,
}) {
  const markRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const tone = getAnnotationTone(annotation);

  function showTooltip(sticky = false) {
    if (!markRef.current) return;

    const rect =
      markRef.current.getBoundingClientRect();

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

  const code =
    annotation.code ||
    annotation.label ||
    annotation.type ||
    "NOTE";

  const comment =
    annotation.comment ||
    annotation.label ||
    "Instructor annotation";

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
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-mono font-black uppercase tracking-wider ${tone.badge}`}
                >
                  {code} · Note {number}
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

            <div className="mt-3">
              <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
                Instructor comment
              </p>

              <p className="mt-1 text-xs leading-relaxed text-slate-700">
                {comment}
              </p>
            </div>

            {annotation.selectedText && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-slate-400">
                  Selected text
                </p>

                <p className="mt-1 text-[11px] font-semibold leading-relaxed text-slate-700">
                  “{annotation.selectedText}”
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

function HighlightedTeacherSubmission({
  text,
  annotations,
}) {
  const ranges = useMemo(
    () =>
      normalizeAnnotationRanges(
        String(text || ""),
        annotations
      ),
    [text, annotations]
  );

  if (!text) {
    return (
      <p className="text-xs italic text-slate-400">
        No submitted text is available.
      </p>
    );
  }

  if (ranges.length === 0) {
    return (
      <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
        {text}
      </p>
    );
  }

  const parts = [];
  let cursor = 0;

  ranges.forEach((annotation, rangeIndex) => {
    if (annotation.rangeStart > cursor) {
      parts.push({
        type: "text",
        text: text.slice(
          cursor,
          annotation.rangeStart
        ),
      });
    }

    parts.push({
      type: "annotation",
      text: text.slice(
        annotation.rangeStart,
        annotation.rangeEnd
      ),
      annotation,
      number: rangeIndex + 1,
    });

    cursor = annotation.rangeEnd;
  });

  if (cursor < text.length) {
    parts.push({
      type: "text",
      text: text.slice(cursor),
    });
  }

  return (
    <p className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
      {parts.map((part, index) => {
        if (part.type === "annotation") {
          return (
            <TeacherAnnotationMark
              key={`annotation_${index}`}
              text={part.text}
              annotation={part.annotation}
              number={part.number}
            />
          );
        }

        return (
          <React.Fragment key={`text_${index}`}>
            {part.text}
          </React.Fragment>
        );
      })}
    </p>
  );
}

/* =====================================================
   TEACHER FEEDBACK MODAL
===================================================== */

function TeacherFeedbackModal({
  open,
  onClose,
  assignment,
  submission,
  rubric,
  finalText,
}) {
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (open) {
      setActiveTab("overview");
    }
  }, [open, submission?.id]);

  if (!open || !submission) return null;

  const annotations = safeArray(
    submission.annotations
  );

  const rubricCriteria = safeArray(
    rubric?.criteria
  );

  const rubricScores =
    submission.rubricScores || {};

  const rubricTotal =
    Number(
      submission.rubricTotal ||
        rubric?.totalPoints ||
        0
    ) ||
    rubricCriteria.reduce(
      (sum, criterion) =>
        sum + Number(criterion.points || 0),
      0
    ) ||
    100;

  const hasGrade =
    submission.score !== null &&
    submission.score !== undefined &&
    submission.score !== "";

  const gradedCriteriaCount =
    rubricCriteria.filter((criterion) => {
      const entry = getRubricScoreEntry(
        rubricScores,
        criterion.id
      );

      return entry.score !== null;
    }).length;

  const reviewTabs = [
    {
      id: "overview",
      label: "Feedback",
      icon: MessageSquare,
    },
    {
      id: "rubric",
      label: "Rubric",
      icon: ClipboardList,
      count: rubricCriteria.length,
    },
    {
      id: "annotations",
      label: "Highlights",
      icon: Highlighter,
      count: annotations.length,
    },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[2147483646]">
      <button
        type="button"
        aria-label="Close instructor feedback"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
      />

      <aside className="absolute inset-y-0 right-0 flex w-[min(96vw,760px)] flex-col border-l border-slate-200 bg-[#F8FAFC] shadow-2xl animate-slide-in-right">
        <header className="shrink-0 border-b border-slate-200 bg-white">
          <div className="flex items-start justify-between gap-4 px-5 py-3.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 shrink-0 text-blue-700" />

                <p className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                  Attempt {Number(submission?.attemptNumber || 1)} Instructor Review
                </p>
              </div>

              <h2 className="mt-1 truncate font-serif text-lg font-bold text-slate-950">
                {assignment?.title ||
                  submission.assignmentTitle ||
                  "Assignment Feedback"}
              </h2>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                <span>
                  Review your grade, instructor comments, rubric results, and highlighted notes.
                </span>

                <span className="hidden h-3 w-px bg-slate-200 sm:block" />

                <span className="font-mono">
                  Submitted: {formatDateTime(submission.submittedAt) || " - "}
                </span>

                <span className="hidden h-3 w-px bg-slate-200 sm:block" />

                <span className="font-mono">
                  Reviewed: {formatDateTime(submission.reviewedAt) || " - "}
                </span>

                <span className="hidden h-3 w-px bg-slate-200 sm:block" />

                <span className="max-w-[260px] truncate font-medium text-slate-600">
                  {rubric?.title ||
                    submission.rubricTitle ||
                    "Assignment Rubric"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-400 transition-colors hover:bg-white hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 border-t border-slate-100 px-3 pt-2">
            {reviewTabs.map((tab) => {
              const Icon = tab.icon;
              const selected =
                activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                  className={`relative inline-flex items-center justify-center gap-1.5 rounded-t-xl px-3 py-3 text-[11px] font-bold transition-colors ${
                    selected
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}

                  {tab.count !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[8px] font-mono font-black ${
                        selected
                          ? "bg-blue-100 text-blue-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}

                  {selected && (
                    <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-blue-600" />
                  )}
                </button>
              );
            })}
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5">
          {activeTab === "overview" && (
            <div className="space-y-3">
              <section className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-700 px-4 py-3 text-white shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-end gap-2">
                    <div>
                      <p className="font-mono text-[8px] font-black uppercase tracking-[0.16em] text-blue-200">
                        Final grade
                      </p>

                      <p className="mt-0.5 text-3xl font-mono font-black leading-none">
                        {hasGrade
                          ? submission.score
                          : " - "}
                        <span className="ml-1 text-sm text-blue-200">
                          / {rubricTotal}
                        </span>
                      </p>
                    </div>

                    <span className="mb-0.5 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[8px] font-mono font-black uppercase tracking-wider text-blue-100">
                      {getStatusLabel(
                        submission.status
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-4 sm:min-w-[300px]">
                    <div>
                      <p className="text-[7px] font-mono font-black uppercase text-blue-200">
                        Rubric
                      </p>

                      <p className="mt-0.5 text-[11px] font-bold">
                        {gradedCriteriaCount}/{rubricCriteria.length}
                      </p>
                    </div>

                    <div>
                      <p className="text-[7px] font-mono font-black uppercase text-blue-200">
                        Highlights
                      </p>

                      <p className="mt-0.5 text-[11px] font-bold">
                        {annotations.length}
                      </p>
                    </div>

                    <div>
                      <p className="text-[7px] font-mono font-black uppercase text-blue-200">
                        Words
                      </p>

                      <p className="mt-0.5 text-[11px] font-bold">
                        {countWords(finalText)}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                    <MessageSquare className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="font-mono text-[9px] font-black uppercase tracking-wider text-slate-400">
                      Overall instructor comment
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                      {submission.feedback ||
                        "Your instructor has not added an overall comment."}
                    </p>
                  </div>
                </div>
              </section>

            </div>
          )}

          {activeTab === "rubric" && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[9px] font-black uppercase tracking-wider text-indigo-600">
                      Rubric review
                    </p>

                    <h3 className="mt-1 font-serif text-base font-bold text-indigo-950">
                      {rubric?.title ||
                        submission.rubricTitle ||
                        "Assignment Rubric"}
                    </h3>
                  </div>

                  <span className="rounded-xl border border-indigo-200 bg-white px-3 py-1.5 font-mono text-sm font-black text-indigo-700">
                    {hasGrade
                      ? submission.score
                      : " - "}{" "}
                    / {rubricTotal}
                  </span>
                </div>
              </section>

              {rubricCriteria.length === 0 ? (
                <section className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
                  <ClipboardList className="mx-auto h-7 w-7 text-slate-300" />

                  <p className="mt-3 text-sm font-bold text-slate-900">
                    No rubric review available
                  </p>
                </section>
              ) : (
                <div className="space-y-3">
                  {rubricCriteria.map(
                    (criterion, index) => {
                      const entry =
                        getRubricScoreEntry(
                          rubricScores,
                          criterion.id
                        );

                      return (
                        <section
                          key={
                            criterion.id ||
                            `criterion_${index}`
                          }
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-sm font-bold text-slate-900">
                                {criterion.name}
                              </h4>

                              {criterion.description && (
                                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                                  {criterion.description}
                                </p>
                              )}
                            </div>

                            <span className="shrink-0 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 font-mono text-xs font-black text-indigo-700">
                              {entry.score !== null
                                ? entry.score
                                : " - "}{" "}
                              / {criterion.points}
                            </span>
                          </div>

                          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                            {entry.bandLabel && (
                              <span className="inline-flex rounded-lg border border-indigo-200 bg-white px-2 py-1 text-[9px] font-bold text-indigo-700">
                                {entry.bandLabel}
                              </span>
                            )}

                            <p className="mt-2 text-[11px] leading-5 text-slate-600">
                              {entry.comment ||
                                "No criterion-specific comment was added."}
                            </p>
                          </div>
                        </section>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "annotations" && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <Highlighter className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

                  <div>
                    <p className="text-xs font-bold text-amber-950">
                      Highlighted instructor feedback
                    </p>

                    <p className="mt-1 text-[10px] leading-relaxed text-amber-800">
                      Hover over a highlighted phrase to see the instructor comment. Click it to keep the note open.
                    </p>
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                  <div>
                    <h3 className="font-serif text-sm font-bold text-slate-950">
                      Submitted Assignment
                    </h3>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {countWords(finalText)} words ·{" "}
                      {annotations.length} highlighted note
                      {annotations.length === 1
                        ? ""
                        : "s"}
                    </p>
                  </div>
                </div>

                <div className="bg-[#F8FAFC] p-4">
                  <article className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
                    <HighlightedTeacherSubmission
                      text={finalText}
                      annotations={annotations}
                    />
                  </article>
                </div>
              </section>

            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white transition-colors hover:bg-slate-800"
          >
            <CheckCircle2 className="h-4 w-4" />
            Done Reviewing
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}

/* =====================================================
   MAIN STEP
===================================================== */

export default function Step4FinalSummary({
  showRubricOnOpen = false,
  onRubricSaved,
  onRubricClosed,
  rubricBackStep = 3,
}) {
  const {
    activeAssignment,
    activeSubmission,
    typedText,
    submitAssignment,
    saveDraftProgress,
    goToStudentStep,
    rememberStudentStep,
  } = useStudentWorkspace();

  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attested, setAttested] = useState(false);
  const [showTeacherFeedback, setShowTeacherFeedback] =
    useState(false);
  const [showSelfGrade, setShowSelfGrade] =
    useState(false);

  const submitLockRef = useRef(false);
  const rubricPromptedRef = useRef(false);
  const [selfRubricScores, setSelfRubricScores] =
    useState(
      activeSubmission?.selfRubricScores || {}
    );
  const [selfGradeMessage, setSelfGradeMessage] =
    useState("");
  const [isSavingSelfGrade, setIsSavingSelfGrade] = useState(false);

  useEffect(() => {
    setSelfRubricScores(
      activeSubmission?.selfRubricScores || {}
    );
  }, [
    activeSubmission?.id,
    activeSubmission?.attemptNumber,
    activeSubmission?.reopenedAt,
  ]);

  useEffect(() => {
    setAttested(false);
  }, [
    activeSubmission?.id,
    activeSubmission?.attemptNumber,
    activeSubmission?.reopenedAt,
  ]);

  const submissionStatus = String(
    activeSubmission?.status || ""
  ).toLowerCase();

  const canResubmit =
    submissionStatus === "reopened";

  const submittedEvidence = Boolean(
    activeSubmission?.submittedAt ||
      activeSubmission?.resubmittedAt ||
      String(
        activeSubmission?.submittedText ||
          activeSubmission?.submissionText ||
          ""
      ).trim()
  );

  /*
    A late label alone does not mean the student already submitted.
    Overdue-but-unsubmitted and missing work remain editable until a real
    submitted timestamp/text exists.
  */
  const isSubmitted =
    !canResubmit &&
    (
      submissionStatus === "submitted" ||
      submissionStatus === "graded" ||
      (
        submissionStatus === "late" &&
        submittedEvidence
      ) ||
      submittedEvidence
    );

  const typedTextValue = String(
    typedText ?? ""
  ).trim();

  const hasTypedText =
    typedTextValue.length > 0;

  const finalText = isSubmitted
    ? getSubmissionText(activeSubmission, typedText)
    : hasTypedText
      ? typedTextValue
      : getSubmissionText(activeSubmission);

  const wordCount = countWords(finalText);

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

  const belowMinWords =
    Number(minWords) > 0 &&
    wordCount < Number(minWords);

  const aboveMaxWords =
    Number(maxWords) > 0 &&
    wordCount > Number(maxWords);

  const wordCountIssue =
    belowMinWords || aboveMaxWords;

  const aiFeedback = useMemo(
    () =>
      getLatestAiFeedback(
        activeSubmission?.feedbackHistory
      ),
    [activeSubmission?.feedbackHistory]
  );

  const currentRubric = useMemo(
    () =>
      normalizeRubricForStudent(
        activeAssignment,
        activeSubmission
      ),
    [activeAssignment, activeSubmission]
  );

  const rubricCriteria = safeArray(
    currentRubric?.criteria
  );

  const rubricTotal =
    Number(
      activeSubmission?.rubricTotal ||
        currentRubric?.totalPoints ||
        0
    ) ||
    rubricCriteria.reduce(
      (sum, criterion) =>
        sum + Number(criterion.points || 0),
      0
    );

  const completedSelfCriteria =
    rubricCriteria.filter((criterion) => {
      const entry =
        selfRubricScores?.[criterion.id];

      return (
        entry?.bandId ||
        entry?.score !== undefined
      );
    }).length;

  const selfRubricTotal =
    rubricCriteria.reduce((sum, criterion) => {
      const entry =
        selfRubricScores?.[criterion.id];

      return sum + Number(entry?.score || 0);
    }, 0);

  const selfRubricPercentage =
    rubricTotal > 0
      ? Math.round(
          (selfRubricTotal / rubricTotal) * 100
        )
      : 0;

  const selfGradeRequired =
    rubricCriteria.length > 0;

  const selfGradeComplete =
    rubricCriteria.length > 0 &&
    completedSelfCriteria ===
      rubricCriteria.length;

  useEffect(() => {
    if (showRubricOnOpen && selfGradeRequired) {
      rubricPromptedRef.current = true;
      setShowSelfGrade(true);
      return;
    }

    if (
      !rubricPromptedRef.current &&
      selfGradeRequired &&
      !selfGradeComplete
    ) {
      rubricPromptedRef.current = true;
      setShowSelfGrade(true);
    }
  }, [selfGradeComplete, selfGradeRequired, showRubricOnOpen]);

  const currentAttemptReviewed =
    Boolean(activeSubmission) &&
    submissionStatus === "graded" &&
    ((
      activeSubmission.score !== null &&
      activeSubmission.score !== undefined &&
      activeSubmission.score !== ""
    ) ||
      Boolean(
        String(
          activeSubmission.feedback || ""
        ).trim()
      ) ||
      safeArray(
        activeSubmission.annotations
      ).length > 0 ||
      Object.keys(
        activeSubmission.rubricScores || {}
      ).length > 0);

  const hasGrade =
    currentAttemptReviewed &&
    activeSubmission?.score !== null &&
    activeSubmission?.score !== undefined &&
    activeSubmission?.score !== "";

  const teacherAnnotations =
    currentAttemptReviewed
      ? safeArray(
          activeSubmission?.annotations
        )
      : [];

  const hasTeacherFeedback =
    currentAttemptReviewed &&
    Boolean(
      String(
        activeSubmission?.feedback || ""
      ).trim()
    );

  const hasCurrentTeacherReview =
    currentAttemptReviewed &&
    (hasGrade ||
      hasTeacherFeedback ||
      teacherAnnotations.length > 0 ||
      Object.keys(
        activeSubmission?.rubricScores || {}
      ).length > 0);

  const previousTeacherReview =
    activeSubmission?.previousTeacherReview &&
    typeof activeSubmission.previousTeacherReview ===
      "object"
      ? activeSubmission.previousTeacherReview
      : null;

  const previousReviewAnnotations =
    safeArray(
      previousTeacherReview?.annotations
    );

  const previousReviewHasGrade =
    previousTeacherReview?.score !== null &&
    previousTeacherReview?.score !== undefined &&
    previousTeacherReview?.score !== "";

  const hasPreviousTeacherReview =
    Boolean(
      previousTeacherReview &&
      (previousReviewHasGrade ||
        String(
          previousTeacherReview.feedback || ""
        ).trim() ||
        previousReviewAnnotations.length > 0 ||
        Object.keys(
          previousTeacherReview.rubricScores ||
            {}
        ).length > 0)
    );

  const currentAttemptNumber =
    Number(
      activeSubmission?.attemptNumber || 1
    );

  const isCurrentRevisionAwaitingReview =
    currentAttemptNumber > 1 &&
    ["submitted", "late"].includes(
      submissionStatus
    ) &&
    !hasCurrentTeacherReview;

  const previousReviewSubmission =
    hasPreviousTeacherReview
      ? {
          ...activeSubmission,

          id:
            previousTeacherReview.sourceSubmissionId ||
            activeSubmission?.previousSubmissionId ||
            "previous_attempt",

          attemptNumber:
            Number(
              previousTeacherReview.attemptNumber ||
                Math.max(
                  1,
                  currentAttemptNumber - 1
                )
            ),

          status:
            previousTeacherReview.status ||
            "Graded",

          submittedAt:
            previousTeacherReview.submittedAt ||
            null,

          resubmittedAt:
            previousTeacherReview.resubmittedAt ||
            null,

          score:
            previousTeacherReview.score ??
            null,

          feedback:
            previousTeacherReview.feedback ||
            "",

          annotations:
            previousReviewAnnotations,

          rubricId:
            previousTeacherReview.rubricId ||
            null,

          rubricTitle:
            previousTeacherReview.rubricTitle ||
            null,

          rubricScores:
            previousTeacherReview.rubricScores ||
            {},

          rubricTotal:
            previousTeacherReview.rubricTotal ||
            null,

          rubricCalculatedScore:
            previousTeacherReview.rubricCalculatedScore ??
            null,

          rubricOverride:
            Boolean(
              previousTeacherReview.rubricOverride
            ),

          reviewedAt:
            previousTeacherReview.reviewedAt ||
            null,

          finalText:
            previousTeacherReview.finalText ||
            previousTeacherReview.submittedText ||
            previousTeacherReview.content ||
            previousTeacherReview.text ||
            "",

          submittedText:
            previousTeacherReview.submittedText ||
            previousTeacherReview.finalText ||
            previousTeacherReview.content ||
            previousTeacherReview.text ||
            "",

          content:
            previousTeacherReview.content ||
            previousTeacherReview.finalText ||
            previousTeacherReview.submittedText ||
            previousTeacherReview.text ||
            "",

          text:
            previousTeacherReview.text ||
            previousTeacherReview.finalText ||
            previousTeacherReview.submittedText ||
            previousTeacherReview.content ||
            "",
        }
      : null;

  const reviewSubmissionToShow =
    hasCurrentTeacherReview
      ? activeSubmission
      : previousReviewSubmission;

  const reviewAnnotationsToShow =
    safeArray(
      reviewSubmissionToShow?.annotations
    );

  const reviewHasGrade =
    reviewSubmissionToShow?.score !== null &&
    reviewSubmissionToShow?.score !== undefined &&
    reviewSubmissionToShow?.score !== "";

  const hasTeacherReview =
    Boolean(reviewSubmissionToShow) &&
    (reviewHasGrade ||
      String(
        reviewSubmissionToShow?.feedback || ""
      ).trim() ||
      reviewAnnotationsToShow.length > 0 ||
      Object.keys(
        reviewSubmissionToShow?.rubricScores ||
          {}
      ).length > 0);

  const reviewTextToShow =
    reviewSubmissionToShow
      ? getSubmissionText(
          reviewSubmissionToShow,
          finalText
        ) || finalText
      : finalText;

  const reviewRubricTotal =
    Number(
      reviewSubmissionToShow?.rubricTotal ||
        rubricTotal ||
        0
    ) ||
    100;

  const reviewAttemptNumber =
    Number(
      reviewSubmissionToShow?.attemptNumber ||
        currentAttemptNumber
    );

  const canSubmit =
    Boolean(activeAssignment) &&
    Boolean(finalText) &&
    attested &&
    submitLockRef.current === false;

  const workspaceUnavailable =
    !activeAssignment ||
    !activeSubmission;

  if (workspaceUnavailable) {
    return (
      <div className="flex h-full min-h-[360px] items-center justify-center rounded-2xl border border-amber-200 bg-amber-50/70 p-6">
        <div className="max-w-md text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-700" />

          <h3 className="mt-3 font-serif text-lg font-bold text-slate-950">
            Assignment data is still loading
          </h3>

          <p className="mt-2 text-xs leading-6 text-slate-600">
            Return to the previous step and open Submit again. Your draft and
            saved feedback remain stored.
          </p>

          <button
            type="button"
            onClick={() => goToStudentStep(3)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Feedback
          </button>
        </div>
      </div>
    );
  }

  const requirementState = belowMinWords
    ? `${Number(minWords) - wordCount} words below minimum`
    : aboveMaxWords
    ? `${wordCount - Number(maxWords)} words above maximum`
    : "Word count ready";

  function selectSelfRubricBand(
    criterion,
    band
  ) {
    setSelfRubricScores((previous) => ({
      ...previous,
      [criterion.id]: {
        criterionId: criterion.id,
        criterionName: criterion.name,
        maxPoints: criterion.points,
        bandId: band.id,
        bandLabel: band.label,
        score: Number(band.points || 0),
        comment: "",
      },
    }));

    setSelfGradeMessage("");
  }

  async function saveSelfAssessment() {
    if (
      !currentRubric ||
      rubricCriteria.length === 0
    ) {
      setSelfGradeMessage(
        "No rubric is attached to this assignment."
      );
      return;
    }

    if (!selfGradeComplete) {
      setSelfGradeMessage(
        "Please select one level for every rubric criterion."
      );
      return;
    }

    const selfAssessedAt =
      new Date().toISOString();

    if (!activeAssignment?.id || typeof saveDraftProgress !== "function") {
      setSelfGradeMessage("This rubric could not be connected to the assignment.");
      return;
    }

    setIsSavingSelfGrade(true);
    setSelfGradeMessage("Saving self-assessment…");
    try {
      await saveDraftProgress(activeAssignment.id, {
        selfRubricAssessment: true,
        selfAssessmentComplete: true,
        selfRubricScores,
        selfRubricTotal,
        selfRubricMax: rubricTotal,
        selfRubricPercentage,
        selfAssessedAt,
      });
      setSelfGradeMessage("Self-assessment saved.");
      setShowSelfGrade(false);
      onRubricSaved?.();
    } catch (error) {
      console.error("Self-assessment persistence failed:", error);
      setSelfGradeMessage(
        error?.conflict
          ? "A newer autosave finished first. Your selections are still here; please save the rubric again."
          : "The rubric could not reach the database. Your selections remain here; please try again."
      );
    } finally {
      setIsSavingSelfGrade(false);
    }
  }

  function saveFinalProgress() {
    if (
      !activeAssignment?.id ||
      typeof saveDraftProgress !== "function"
    ) {
      return;
    }

    saveDraftProgress(activeAssignment.id, {
      finalText,
      wordCount,
      finalReviewedAt:
        new Date().toISOString(),
      fluencySummary: calculateFluencySummary(activeSubmission),
      selfRubricAssessment:
        selfGradeComplete,
      selfAssessmentComplete: selfGradeComplete,
      selfRubricScores,
      selfRubricTotal,
      selfRubricMax: rubricTotal,
      selfRubricPercentage,
      selfAssessedAt:
        activeSubmission?.selfAssessedAt ||
        (selfGradeComplete
          ? new Date().toISOString()
          : null),
    });
  }

  async function handleSubmit() {
    /* Synchronous lock to prevent double-click race conditions. */
    if (submitLockRef.current === true) {
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    setSubmitMessage("");

    if (!activeAssignment) {
      setSubmitMessage(
        "No active assignment selected."
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (!finalText) {
      setSubmitMessage(
        "Please write your assignment before submitting it."
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (!attested) {
      setSubmitMessage(
        "Please confirm the Academic Honor statement before submitting."
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    const honorConfirmedAt = new Date().toISOString();

    let result = false;
    try {
      result = await submitAssignment(
        activeAssignment.id,
        finalText,
        {
          honorConfirmed: true,
          honorConfirmedAt,
        }
      );
    } catch (error) {
      console.error("Submission persistence failed:", error);
      setSubmitMessage(
        error?.conflict
          ? "A newer autosave finished first. Your work is still here; please submit again."
          : "Submission could not reach the database. Your local draft is still saved; please try again."
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }

    if (result) {
      setSubmitMessage(
        "Assignment submitted successfully."
      );
      /* Save that student is on Step 4 (success screen). */
      rememberStudentStep(activeAssignment.id, 4);
      /* Stay on success screen; do not auto-close. */
      submitLockRef.current = false;
      setIsSubmitting(false);
    } else {
      setSubmitMessage(
        "Submission could not be saved."
      );
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="relative h-full min-h-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(37,99,235,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,99,235,0.035)_1px,transparent_1px)] bg-[size:32px_32px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-28 top-8 h-80 w-80 rounded-full bg-emerald-100/60 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-blue-100/70 blur-3xl" />

        <div className="relative z-10 h-full overflow-y-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
          <SubmissionConfirmation
            submission={activeSubmission}
            attemptNumber={currentAttemptNumber}
            hasGrade={reviewHasGrade}
            grade={reviewSubmissionToShow?.score}
            rubricTotal={reviewRubricTotal}
          />

          <TeacherReviewLauncher
            hasTeacherReview={hasTeacherReview}
            hasGrade={reviewHasGrade}
            grade={reviewSubmissionToShow?.score}
            rubricTotal={reviewRubricTotal}
            annotationCount={reviewAnnotationsToShow.length}
            reviewAttemptNumber={reviewAttemptNumber}
            currentAttemptNumber={currentAttemptNumber}
            currentAttemptPending={isCurrentRevisionAwaitingReview}
            onOpen={() => setShowTeacherFeedback(true)}
            onDownloadGrade={
              reviewHasGrade
                ? () =>
                    downloadGradeReportPdf({
                      assignment: activeAssignment,
                      submission: reviewSubmissionToShow,
                      rubric: currentRubric,
                    })
                : undefined
            }
          />
          </div>
        </div>

        <TeacherFeedbackModal
          open={showTeacherFeedback}
          onClose={() =>
            setShowTeacherFeedback(false)
          }
          assignment={activeAssignment}
          submission={
            reviewSubmissionToShow
          }
          rubric={currentRubric}
          finalText={
            reviewTextToShow
          }
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <div
        aria-hidden={showSelfGrade ? "true" : undefined}
        className={`flex h-full min-h-0 flex-col gap-3 ${
          showSelfGrade ? "hidden" : ""
        }`}
      >
        {canResubmit && (
          <div className="shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

              <div>
                <p className="text-xs font-bold text-amber-900">
                  Assignment reopened for revision
                </p>

                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800">
                  Review the instructor feedback, revise the draft, then submit the updated version.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.55fr)_360px] 2xl:grid-cols-[minmax(0,1.55fr)_390px]">
          <FinalDraftPreview
            finalText={finalText}
            wordCount={wordCount}
            maxWords={maxWords}
            requirementState={requirementState}
            wordCountIssue={wordCountIssue}
          />

          <FinalCheckPanel
            completedSelfCriteria={
              completedSelfCriteria
            }
            rubricCriteriaCount={
              rubricCriteria.length
            }
            selfRubricTotal={selfRubricTotal}
            rubricTotal={rubricTotal}
            selfGradeComplete={
              selfGradeComplete
            }
            selfGradeRequired={
              selfGradeRequired
            }
            onOpenSelfGrade={() =>
              setShowSelfGrade(true)
            }
            belowMinWords={belowMinWords}
            aboveMaxWords={aboveMaxWords}
            attested={attested}
            onToggleAttested={setAttested}
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            canResubmit={canResubmit}
            submitMessage={submitMessage}
            handleSubmit={handleSubmit}
            onBack={() => {
              goToStudentStep(2);
            }}
          />
        </div>
      </div>

      <SelfGradeDrawer
          open={showSelfGrade}
          onClose={() => {
            if (selfGradeComplete) {
              setShowSelfGrade(false);
              onRubricClosed?.();
              return;
            }

            goToStudentStep(rubricBackStep === 2 ? 2 : 3);
          }}
          rubric={currentRubric}
          rubricCriteria={rubricCriteria}
          selfRubricScores={
            selfRubricScores
          }
          selectSelfRubricBand={
            selectSelfRubricBand
          }
          completedSelfCriteria={
            completedSelfCriteria
          }
          selfRubricTotal={selfRubricTotal}
          rubricTotal={rubricTotal}
          selfRubricPercentage={
            selfRubricPercentage
          }
          selfGradeMessage={
            selfGradeMessage
          }
          onSave={saveSelfAssessment}
          isSaving={isSavingSelfGrade}
          backLabel={
            "Back to Draft"
          }
      />

    </div>
  );
}

/* =====================================================
   SUBMITTED VIEW
===================================================== */

function SubmissionConfirmation({
  submission,
  attemptNumber,
  hasGrade,
  grade,
  rubricTotal,
}) {
  return (
    <section className="relative shrink-0 overflow-hidden rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 shadow-sm">
      <div aria-hidden="true" className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-blue-100/50 blur-2xl" />
      <div aria-hidden="true" className="absolute -bottom-20 left-12 h-40 w-40 rounded-full bg-emerald-100/60 blur-2xl" />

      <div className="relative grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-600 shadow-sm ring-4 ring-emerald-100/70">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div>
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-100/80 px-2.5 py-1 font-mono text-[9px] font-black uppercase tracking-wider text-emerald-700">
              {hasGrade ? "Review complete" : "Successfully submitted"}
            </span>

            <h3 className="mt-2 font-serif text-2xl font-bold text-slate-950">
              Your assignment has been submitted
            </h3>

            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">
              {hasGrade
                ? "Your instructor has finished grading. Your complete review is ready below."
                : `Attempt ${attemptNumber} is with your instructor and ready for grading.`}
            </p>

            {!hasGrade && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-white/80 px-3 py-2 text-[11px] text-slate-500">
                <Info className="h-3.5 w-3.5 text-blue-600" />
                You can return here when your instructor publishes the review.
              </p>
            )}
          </div>
        </div>

        <div className="grid min-w-[250px] grid-cols-2 overflow-hidden rounded-2xl border border-white/80 bg-white/80 shadow-sm backdrop-blur-sm">
          <div className="border-r border-slate-100 px-4 py-3.5">
            <p className="font-mono text-[8px] font-black uppercase tracking-wider text-slate-400">
              Attempt
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">#{attemptNumber}</p>
          </div>
          <div className="px-4 py-3.5">
            <p className="font-mono text-[8px] font-black uppercase tracking-wider text-slate-400">
              Status
            </p>
            <p className={`mt-1 text-sm font-bold ${hasGrade ? "text-blue-700" : "text-emerald-700"}`}>
              {hasGrade ? "Graded" : "Submitted"}
            </p>
          </div>
          <div className="col-span-2 border-t border-slate-100 px-4 py-3.5">
            <p className="font-mono text-[8px] font-black uppercase tracking-wider text-slate-400">
              {hasGrade ? "Final grade" : "Submitted on"}
            </p>
            <p className={`mt-1 font-mono font-black ${hasGrade ? "text-2xl text-blue-700" : "text-xs text-slate-700"}`}>
              {hasGrade
                ? `${grade} / ${rubricTotal}`
                : formatDateTime(submission?.submittedAt) || "Recorded"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TeacherReviewLauncher({
  hasTeacherReview,
  hasGrade,
  grade,
  rubricTotal,
  annotationCount,
  reviewAttemptNumber,
  currentAttemptNumber,
  currentAttemptPending,
  onOpen,
  onDownloadGrade,
}) {
  return (
    <section className="shrink-0 overflow-hidden rounded-3xl border border-blue-200 bg-white shadow-sm">
      <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500" />
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
            {hasTeacherReview ? <Award className="h-6 w-6" /> : <MessageSquare className="h-5 w-5" />}
          </div>

          <div>
            <p className="font-mono text-[9px] font-black uppercase tracking-wider text-blue-600">
              {hasTeacherReview ? "Ready to review" : "Next step"}
            </p>
            <h3 className="mt-1 font-serif text-lg font-bold text-slate-950">
              {currentAttemptPending &&
              hasTeacherReview
                ? `Attempt ${reviewAttemptNumber} Instructor Review`
                : "Instructor Review"}
            </h3>

            <p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-500">
              {currentAttemptPending &&
              hasTeacherReview
                ? `Attempt ${currentAttemptNumber} feedback is not available yet. You can still review the completed feedback from Attempt ${reviewAttemptNumber}.`
                : hasTeacherReview
                ? `Your instructor returned ${
                    hasGrade
                      ? `a grade of ${grade}/${rubricTotal}, `
                      : ""
                  }overall feedback, and ${annotationCount} highlighted note${
                    annotationCount === 1 ? "" : "s"
                  }.`
                : currentAttemptPending
                ? `Instructor feedback for Attempt ${currentAttemptNumber} will be available after review.`
                : "Your instructor has not published feedback yet."}
            </p>
          </div>
        </div>

        <div className="grid shrink-0 gap-2 sm:min-w-[210px]">
          {onDownloadGrade && (
            <button
              type="button"
              onClick={onDownloadGrade}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-bold text-blue-700 transition-all hover:border-blue-300 hover:bg-blue-100"
            >
              <FileDown className="h-4 w-4" />
              Download Grade PDF
            </button>
          )}

          <button
            type="button"
            disabled={!hasTeacherReview}
            onClick={onOpen}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
          >
            <Eye className="h-4 w-4" />
            {currentAttemptPending &&
            hasTeacherReview
              ? `View Attempt ${reviewAttemptNumber} Feedback`
              : "Check Instructor Feedback"}
          </button>
        </div>
      </div>
    </section>
  );
}

/* =====================================================
   PRE-SUBMISSION VIEW
===================================================== */

function FinalDraftPreview({
  finalText,
  wordCount,
  maxWords,
  requirementState,
  wordCountIssue,
}) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-blue-700" />

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Final Draft Preview
              </h3>

              <p className="mt-0.5 text-[11px] text-slate-500">
                This exact version will be sent to your instructor.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-2.5 py-1.5 text-[10px] font-mono font-bold text-slate-700">
              {wordCount}
              {Number(maxWords) > 0
                ? ` / ${maxWords}`
                : ""}{" "}
              words
            </span>

            <span
              className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-mono font-bold ${
                wordCountIssue
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {requirementState}
            </span>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] px-6 py-5">
        <article className="w-full">
          {finalText ? (
            <p className="whitespace-pre-wrap text-[14px] leading-7 text-slate-700">
              {finalText}
            </p>
          ) : (
            <p className="text-xs italic text-slate-400">
              No draft text available yet.
            </p>
          )}
        </article>
      </div>
    </section>
  );
}

function FinalCheckPanel({
  completedSelfCriteria,
  rubricCriteriaCount,
  selfRubricTotal,
  rubricTotal,
  selfGradeComplete,
  selfGradeRequired,
  onOpenSelfGrade,
  belowMinWords,
  aboveMaxWords,
  attested,
  onToggleAttested,
  canSubmit,
  isSubmitting,
  canResubmit,
  submitMessage,
  handleSubmit,
  onBack,
}) {
  const [showOwnWorkMeaning, setShowOwnWorkMeaning] = useState(false);
  const wordCountReady =
    !belowMinWords && !aboveMaxWords;
  const submitDisabledReason = attested
    ? "Add some writing before submitting."
    : "";

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-3 py-2">
        <div className="flex items-start gap-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Submit Assignment
              </h3>

              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                Review, confirm, and submit your work.
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        <div className={`rounded-xl border p-3.5 ${attested ? "border-emerald-200 bg-emerald-50/70" : "border-blue-200 bg-blue-50/70"}`}>
          <p className="mb-2 font-mono text-[9px] font-black uppercase tracking-widest text-blue-700">
            Before you submit
          </p>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={attested}
              onChange={(event) => onToggleAttested(event.target.checked)}
              className="sr-only"
            />
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-colors ${attested ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-transparent"}`}>
              <Check className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-xs font-bold text-slate-900">Confirm your work</span>
              <span className="mt-1 block text-[11px] font-medium leading-[1.15rem] text-slate-600">
                I confirm this is my own work. I planned and wrote it, the choices are mine, and I only used AI in the ways allowed for this assignment.
              </span>
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowOwnWorkMeaning((current) => !current)}
            aria-expanded={showOwnWorkMeaning}
            className="ml-9 mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 hover:text-blue-900"
          >
            What does &ldquo;my own work&rdquo; mean?
          </button>

          <OwnWorkDefinition
            open={showOwnWorkMeaning}
            onClose={() => setShowOwnWorkMeaning(false)}
          />
        </div>

        {selfGradeRequired && (
          <button
            type="button"
            onClick={onOpenSelfGrade}
            className="flex w-full items-center justify-between gap-3 border-y border-slate-100 bg-white px-1 py-2 text-left transition-all hover:bg-slate-50"
          >
            <div className="flex items-center gap-2">
              <ClipboardList
                className={`h-4 w-4 shrink-0 ${
                  selfGradeComplete
                    ? "text-emerald-600"
                    : "text-slate-500"
                }`}
              />

              <div>
                <p className="text-xs font-bold text-slate-900">
                  Optional rubric reflection
                </p>

                <p className="mt-0.5 text-[10px] text-slate-500">
                  {selfGradeComplete
                    ? `Saved ${selfRubricTotal}/${rubricTotal}`
                    : `${completedSelfCriteria}/${rubricCriteriaCount} criteria completed · optional`}
                </p>

              </div>
            </div>

            {selfGradeComplete ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <ChevronRight className="h-4 w-4 shrink-0 text-blue-700" />
            )}
          </button>
        )}
        {submitMessage && (
          <div
            className={`rounded-xl border px-3 py-1.5 text-[11px] font-semibold ${
              submitMessage.includes(
                "successfully"
              )
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {submitMessage}
          </div>
        )}

        {!canSubmit && submitDisabledReason && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-semibold leading-snug text-amber-800">
            {submitDisabledReason}
          </p>
        )}

        <div className="sticky bottom-0 -mx-1 mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 bg-white px-1 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-2.5 text-xs font-bold text-slate-600 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            {wordCountReady ? "Back" : "Edit Draft"}
          </button>

          <button
            type="button"
            disabled={!canSubmit}
            title={submitDisabledReason || "Submit assignment"}
            onClick={handleSubmit}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition-all ${
              canSubmit
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700"
                : "cursor-not-allowed bg-slate-100 text-slate-400"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Submitting
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                {canResubmit
                  ? "Resubmit"
                  : "Submit"}
              </>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function OwnWorkDefinition({ open, onClose }) {
  if (!open) return null;

  const principles = [
    ["You did the thinking.", "The ideas and the plan are yours."],
    ["You wrote the text.", "The final words are yours. They were not copied from someone else or generated by AI for you to hand in as your own."],
    ["You made the choices.", "When you used help, including AI, you decided what to accept, change, or reject."],
    ["You can explain it.", "You understand your writing and could talk about why you made your choices."],
  ];

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close own-work explanation" />
      <section role="dialog" aria-modal="true" aria-labelledby="own-work-title" className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-emerald-50 px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-600/20"><ShieldCheck className="h-5 w-5" /></span>
            <div>
              <p className="font-mono text-[9px] font-black uppercase tracking-widest text-blue-700">Before you submit</p>
              <h2 id="own-work-title" className="mt-1 font-serif text-xl font-black text-slate-950">Your work, your voice</h2>
              <p className="mt-1 text-xs leading-5 text-slate-600">Here is exactly what Praxis means by &ldquo;my own work.&rdquo;</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 hover:text-slate-900" aria-label="Close"><X className="h-4 w-4" /></button>
        </header>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {principles.map(([title, text]) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Check className="h-4 w-4" /></span>
                  <div><h3 className="text-xs font-bold text-slate-900">{title}</h3><p className="mt-1 text-[11px] leading-5 text-slate-600">{text}</p></div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs leading-5 text-blue-900"><strong>Using AI is allowed in Praxis.</strong> You can use the Coach to help you think and AI feedback on your draft when your teacher allows it. That is normal and encouraged.</p>
            <p className="mt-3 border-t border-blue-200 pt-3 text-xs font-bold leading-5 text-blue-950">AI can support your work, but it should not do the work for you. The thinking, decisions, and final writing must be yours.</p>
          </div>
        </div>

        <footer className="border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm hover:bg-blue-700">I understand</button>
        </footer>
      </section>
    </div>,
    document.body
  );
}

export function HonorAgreementModal({ open, onClose, onAccept }) {
  const scrollRef = useRef(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) return;

    setReadToEnd(false);
    setAccepted(false);
    setProgress(0);

    const frame = window.requestAnimationFrame(() => {
      const element = scrollRef.current;
      if (!element) return;
      if (element.scrollHeight <= element.clientHeight + 2) {
        setProgress(100);
        setReadToEnd(true);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

  const handleScroll = (event) => {
    const element = event.currentTarget;
    const available = element.scrollHeight - element.clientHeight;
    const nextProgress = available > 0
      ? Math.min(100, Math.round((element.scrollTop / available) * 100))
      : 100;
    setProgress(nextProgress);

    if (element.scrollTop + element.clientHeight >= element.scrollHeight - 8) {
      setReadToEnd(true);
      setProgress(100);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close honor agreement"
        onClick={onClose}
        className="absolute inset-0"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="honor-agreement-title"
        className="relative flex max-h-[min(760px,94vh)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="shrink-0 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-200 bg-white text-blue-700 shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="font-mono text-[9px] font-black uppercase tracking-widest text-blue-700">
                  Before you submit
                </p>
                <h2 id="honor-agreement-title" className="mt-1 font-serif text-xl font-bold text-slate-950">
                  Academic Honor Agreement
                </h2>
                <p className="mt-1 text-xs text-slate-600">
                  Please read the complete agreement before accepting it.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-colors hover:text-slate-900"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="shrink-0 bg-slate-100">
          <div
            className="h-1 bg-blue-600 transition-[width] duration-150"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7"
        >
          <div className="space-y-5 text-sm leading-7 text-slate-700">
            <p>
              By submitting this assignment, I confirm that the work represents my own learning and effort. I understand that academic honesty protects the value of my work and the learning community.
            </p>

            <AgreementItem number="1" title="My own work">
              I wrote and reviewed this submission myself. I have not presented another person’s work as my own.
            </AgreementItem>
            <AgreementItem number="2" title="Sources and collaboration">
              I have acknowledged sources, quotations, ideas, and permitted collaboration according to my instructor’s requirements.
            </AgreementItem>
            <AgreementItem number="3" title="Responsible use of AI">
              Any AI assistance followed the rules for this assignment. I remain responsible for the accuracy, originality, and final wording of what I submit.
            </AgreementItem>
            <AgreementItem number="4" title="Accurate submission">
              This is the version I intend my instructor to grade. I understand that my instructor may review the writing process and supporting activity connected to this assignment.
            </AgreementItem>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-900">
              I understand that submitting work that does not follow these commitments may be handled under my institution’s academic-integrity policies.
            </div>
          </div>
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          {!readToEnd && (
            <p className="mb-3 flex items-center justify-center gap-2 text-[10px] font-semibold text-amber-700">
              <ChevronDown className="h-3.5 w-3.5" />
              Scroll to the end to unlock acceptance
            </p>
          )}

          <label
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
              readToEnd
                ? "cursor-pointer border-emerald-200 bg-white"
                : "cursor-not-allowed border-slate-200 bg-slate-100 opacity-60"
            }`}
          >
            <input
              type="checkbox"
              checked={accepted}
              disabled={!readToEnd}
              onChange={(event) => setAccepted(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-emerald-600"
            />
            <span className="text-xs font-semibold leading-5 text-slate-700">
              I have read and agree to the Academic Honor Agreement.
            </span>
          </label>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!accepted}
              onClick={onAccept}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              <ShieldCheck className="h-4 w-4" />
              Accept Agreement
            </button>
          </div>
        </footer>
      </section>
    </div>,
    document.body
  );
}

function AgreementItem({ number, title, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-[10px] font-black text-white">
        {number}
      </span>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-sm leading-6 text-slate-600">{children}</p>
      </div>
    </div>
  );
}

function HorizontalRubricCriteria({
  rubricCriteria,
  selfRubricScores,
  openCriterionKey,
  onOpenCriterion,
  onSelectBand,
}) {
  const activeIndex = Math.max(
    0,
    rubricCriteria.findIndex(
      (criterion, index) =>
        `${criterion.id || "criterion"}::${index}` === openCriterionKey
    )
  );

  const activeCriterion = rubricCriteria[activeIndex];
  const activeSelection = selfRubricScores?.[activeCriterion?.id];

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {rubricCriteria.map((criterion, index) => {
          const criterionKey = `${criterion.id || "criterion"}::${index}`;
          const selected = selfRubricScores?.[criterion.id];
          const selectedBand = safeArray(criterion.bands).find(
            (band) => String(band.id) === String(selected?.bandId)
          );
          const isActive = index === activeIndex;
          const isCompleted = Boolean(
            selected?.bandId || selected?.score !== undefined
          );

          return (
            <button
              key={criterionKey}
              type="button"
              aria-pressed={isActive}
              onClick={() => onOpenCriterion(criterionKey)}
              className={`min-w-[190px] flex-1 rounded-xl border px-3 py-2 text-left transition-all ${
                isCompleted
                  ? "border-emerald-300 bg-emerald-50 shadow-sm"
                  : isActive
                  ? "border-blue-300 bg-blue-50 shadow-sm ring-2 ring-blue-500/10"
                  : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-1 text-[11px] font-bold leading-4 text-slate-900">
                    {criterion.name}
                  </p>
                  <p className={`mt-0.5 text-[8px] font-semibold ${selectedBand ? "text-emerald-700" : "text-slate-400"}`}>
                    {selectedBand ? selectedBand.label : "Not assessed"}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] font-mono font-bold text-slate-500">
                  {criterion.points} pts
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {activeCriterion && (
        <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
          <div className="border-b border-blue-100 bg-blue-50/70 px-4 py-2.5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-mono font-black uppercase tracking-wider text-blue-600">
                  Criterion {activeIndex + 1} of {rubricCriteria.length}
                </p>
                <h3 className="mt-0.5 text-sm font-bold text-slate-950">
                  {activeCriterion.name}
                </h3>
                {activeCriterion.description && (
                  <p className="mt-0.5 line-clamp-2 max-w-5xl text-[10px] leading-4 text-slate-500">
                    {activeCriterion.description}
                  </p>
                )}
              </div>
              <span className="rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[10px] font-mono font-bold text-blue-700">
                {activeCriterion.points} points
              </span>
            </div>
          </div>

          <div className="grid gap-2 p-2.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {safeArray(activeCriterion.bands).map((band) => {
              const isSelected =
                String(activeSelection?.bandId) === String(band.id);

              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() =>
                    onSelectBand(activeCriterion, band, activeIndex)
                  }
                  className={`h-full rounded-xl border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/10"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                  }`}
                >
                  <div className="flex h-full items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">
                        {band.label}
                      </p>
                      {band.description && (
                        <p
                          className="mt-1 line-clamp-7 text-[9px] leading-[1.45] text-slate-500"
                          title={band.description}
                        >
                          {band.description}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-mono text-xs font-black text-blue-700">
                      {band.points}/{activeCriterion.points}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

/* =====================================================
   SELF-GRADE DRAWER
===================================================== */

function SelfGradeDrawer({
  open,
  onClose,
  rubric,
  rubricCriteria,
  selfRubricScores,
  selectSelfRubricBand,
  completedSelfCriteria,
  selfRubricTotal,
  rubricTotal,
  selfRubricPercentage,
  selfGradeMessage,
  onSave,
  isSaving,
  backLabel,
}) {
  const [openCriterionKey, setOpenCriterionKey] =
    useState(null);

  useEffect(() => {
    if (!open || rubricCriteria.length === 0) {
      return;
    }

    const firstIncompleteIndex =
      rubricCriteria.findIndex(
        (criterion) =>
          !selfRubricScores?.[
            criterion.id
          ]
      );

    const preferredIndex =
      firstIncompleteIndex >= 0
        ? firstIncompleteIndex
        : 0;

    const preferredCriterion =
      rubricCriteria[
        preferredIndex
      ];

    setOpenCriterionKey(
      preferredCriterion
        ? `${preferredCriterion.id || "criterion"}::${preferredIndex}`
        : null
    );
  }, [
    open,
    rubric?.id,
    rubricCriteria.length,
  ]);

  function toggleCriterion(criterionKey) {
    setOpenCriterionKey(criterionKey);
  }

  function handleSelectBand(
    criterion,
    band,
    criterionIndex
  ) {
    selectSelfRubricBand(
      criterion,
      band
    );

    const nextCriterionIndex =
      criterionIndex + 1;

    const nextCriterion =
      rubricCriteria[
        nextCriterionIndex
      ];

    if (nextCriterion) {
      setOpenCriterionKey(
        `${nextCriterion.id || "criterion"}::${nextCriterionIndex}`
      );
    }
  }

  if (!open) return null;

  return (
      <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-blue-700" />

              <h2 className="font-serif text-lg font-bold text-slate-950">
                Rubric Self-Assessment
              </h2>
            </div>

            <p className="mt-1 text-[11px] text-slate-500">
              Select the level that best represents your work for every criterion.
            </p>

            {rubric?.title && (
              <p className="mt-1 text-[10px] font-mono text-slate-400">
                {rubric.title}
              </p>
            )}
          </div>

        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#F8FAFC] p-3">
          {rubricCriteria.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center">
              <Info className="mx-auto h-7 w-7 text-slate-300" />

              <p className="mt-3 text-sm font-bold text-slate-900">
                No rubric attached
              </p>
            </div>
          ) : (
            <HorizontalRubricCriteria
              rubricCriteria={rubricCriteria}
              selfRubricScores={selfRubricScores}
              openCriterionKey={openCriterionKey}
              onOpenCriterion={toggleCriterion}
              onSelectBand={handleSelectBand}
            />
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="shrink-0 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 xl:w-[250px]">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-mono text-[8px] font-black uppercase tracking-wider text-blue-600">
                  Progress
                </p>

                <p className="mt-0.5 text-[10px] font-bold text-slate-800">
                  {completedSelfCriteria}/
                  {rubricCriteria.length} criteria
                </p>
              </div>

              <div className="text-right">
                <p className="font-mono text-base font-black text-blue-800">
                  {selfRubricTotal}/
                  {rubricTotal}
                </p>

                <p className="text-[9px] font-bold text-blue-600">
                  {selfRubricPercentage}%
                </p>
              </div>
            </div>
          </div>

          {selfGradeMessage && (
            <p className="min-w-0 flex-1 text-[10px] font-semibold text-amber-700 xl:px-2">
              {selfGradeMessage}
            </p>
          )}

          <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2 xl:max-w-[720px]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              {completedSelfCriteria === rubricCriteria.length
                ? "Back to Draft"
                : backLabel || "Back to Draft"}
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={
                isSaving ||
                completedSelfCriteria !==
                rubricCriteria.length
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isSaving ? "Saving…" : "Save & Continue to Submit"}
            </button>
          </div>
          </div>
        </footer>
      </section>
  );
}
