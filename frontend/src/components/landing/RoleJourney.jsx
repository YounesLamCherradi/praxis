import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Highlighter,
  MessageSquare,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Sparkles,
  User,
} from "lucide-react";

const STUDENT_STEPS = [
  {
    title: "Plan it out loud",
    text: "Use the Coach to develop ideas and turn the conversation into useful outline notes.",
    icon: MessageSquare,
  },
  {
    title: "Write your draft",
    text: "Draft inside Praxis with autosave, word count, and a workspace focused on the assignment.",
    icon: PenLine,
  },
  {
    title: "Ask for feedback, then revise",
    text: "AI points to specific places in the draft and gives feedback without rewriting the paper.",
    icon: Sparkles,
  },
  {
    title: "Read what came back",
    text: "See the submitted grade, rubric decisions, annotations, and instructor feedback together.",
    icon: FileText,
  },
];

const INSTRUCTOR_STEPS = [
  {
    title: "Mark the exact words",
    text: "Select the student's wording and attach a correction code or instructor note directly to it.",
    icon: Highlighter,
  },
  {
    title: "Grade against your rubric",
    text: "Choose criterion scores and keep the work private until you submit the grade.",
    icon: ClipboardCheck,
  },
  {
    title: "Review the writing activity",
    text: "Replay how the draft developed and inspect changes in the order they happened.",
    icon: Activity,
  },
  {
    title: "See what the student receives",
    text: "Preview the returned grade and feedback from the student's point of view.",
    icon: GraduationCap,
  },
];

export default function RoleJourney() {
  const [role, setRole] = useState("student");
  const [step, setStep] = useState(0);

  const [rubricValues, setRubricValues] =
    useState({
      ideas: 4,
      organization: 4,
      language: 3,
    });

  const [submittedGrade, setSubmittedGrade] =
    useState(null);

  // Steps 2 and 3 use this exact same text.
  const [studentDraft, setStudentDraft] = useState(
    "Planning before beginning a difficult task can make the whole process easier. First, prepare the tools and information you need. Next, complete each stage carefully instead of rushing. Finally, check the result and correct any problems."
  );

  useEffect(() => {
    function handleRole(event) {
      if (
        event.detail !== "student" &&
        event.detail !== "instructor"
      ) {
        return;
      }

      setRole(event.detail);
      setStep(0);
    }

    window.addEventListener(
      "praxis-landing-role",
      handleRole
    );

    return () =>
      window.removeEventListener(
        "praxis-landing-role",
        handleRole
      );
  }, []);

  const steps =
    role === "student"
      ? STUDENT_STEPS
      : INSTRUCTOR_STEPS;

  function changeRole(nextRole) {
    setRole(nextRole);
    setStep(0);
  }

  return (
    <section
      id="role-journey"
      className="relative overflow-hidden border-y border-slate-200 bg-[#F8FAFC] py-10 sm:py-20"
    >
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(37,99,235,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,.045) 1px, transparent 1px)",
          backgroundSize: "4rem 4rem",
        }}
      />

      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[800px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[140px]" />

      <div className="relative z-10 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-blue-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            Experience the assignment
          </span>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:mt-4 sm:text-5xl">
            Pick your side of the assignment.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Follow the same writing assignment from both perspectives
            and see how planning, revision, grading, and feedback connect.
          </p>

          <div className="mx-auto mt-6 flex w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm sm:mt-7 sm:inline-flex sm:w-auto">
            <RoleButton
              active={role === "student"}
              onClick={() =>
                changeRole("student")
              }
              icon={User}
            >
              For students
            </RoleButton>

            <RoleButton
              active={role === "instructor"}
              onClick={() =>
                changeRole("instructor")
              }
              icon={GraduationCap}
            >
              For instructors
            </RoleButton>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:mt-12 sm:gap-5 lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-6">
          <div className="grid grid-cols-2 gap-2 lg:block lg:space-y-3">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = step === index;

              return (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setStep(index)}
                  className={`min-w-0 rounded-xl border p-2.5 text-left transition-all sm:rounded-2xl sm:p-3.5 lg:w-full lg:p-4 ${
                    active
                      ? "border-blue-200 bg-blue-50 shadow-[0_18px_45px_rgba(37,99,235,.10)]"
                      : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border sm:h-10 sm:w-10 sm:rounded-xl ${
                        active
                          ? "border-blue-200 bg-white text-blue-600"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] font-bold text-blue-400">
                          0{index + 1}
                        </span>

                        <h3 className="text-[12px] font-bold leading-4 text-slate-900 sm:text-sm sm:leading-normal">
                          {item.title}
                        </h3>
                      </div>

                      <p className="mt-1.5 hidden text-xs leading-relaxed text-slate-500 lg:block">
                        {item.text}
                      </p>
                    </div>

                    <ArrowRight
                      className={`ml-auto mt-1 hidden h-4 w-4 shrink-0 lg:block ${
                        active
                          ? "text-blue-600"
                          : "text-slate-300"
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-md shadow-slate-200/60 transition-all duration-300 sm:min-h-[360px] sm:rounded-[30px] sm:shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-3.5 py-3 sm:items-center sm:px-5 sm:py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {role === "student"
                    ? "Student workspace"
                    : "Instructor workspace"}
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  {steps[step].title}
                </p>
              </div>

              <span className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold text-slate-500 sm:px-3 sm:py-1.5 sm:text-[10px]">
                Interactive example
              </span>
            </div>

            <div className="p-3 sm:p-6">
              {role === "student" && step === 0 && (
                <StudentPlanDemo />
              )}

              {role === "student" && step === 1 && (
                <StudentDraftDemo
                  text={studentDraft}
                  setText={setStudentDraft}
                  onContinue={() => setStep(2)}
                />
              )}

              {role === "student" && step === 2 && (
                <StudentFeedbackDemo
                  draft={studentDraft}
                  setDraft={setStudentDraft}
                />
              )}

              {role === "student" && step === 3 && (
                <ReturnedWorkDemo
                  submittedGrade={
                    submittedGrade
                  }
                />
              )}

              {role === "instructor" &&
                step === 0 && (
                  <InstructorMarkDemo />
                )}

              {role === "instructor" &&
                step === 1 && (
                  <InstructorRubricDemo
                    values={rubricValues}
                    setValues={setRubricValues}
                    submittedGrade={
                      submittedGrade
                    }
                    onSubmit={(grade) =>
                      setSubmittedGrade(grade)
                    }
                  />
                )}

              {role === "instructor" &&
                step === 2 && (
                  <WritingReplayDemo />
                )}

              {role === "instructor" &&
                step === 3 && (
                  <ReturnedWorkDemo
                    submittedGrade={
                      submittedGrade
                    }
                    instructorPreview
                  />
                )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoleButton({
  active,
  icon: Icon,
  children,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all sm:flex-none sm:px-5 ${
        active
          ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
          : "text-slate-500 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function StudentPlanDemo() {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.08fr_.92fr]">
      <DemoCard title="Ideas chat">
        <ChatMessage student>
          I want to explain how planning makes a difficult
          task easier.
        </ChatMessage>

        <ChatMessage>
          What are the main stages your reader needs to
          understand?
        </ChatMessage>

        <ChatMessage student>
          Prepare first, do the task carefully, then check
          the result.
        </ChatMessage>

        <ChatMessage>
          That gives you a clear sequence. What detail could
          you add to each stage?
        </ChatMessage>
      </DemoCard>

      <DemoCard title="Outline notes">
        {[
          "Introduction: why planning matters",
          "Stage 1: preparation",
          "Stage 2: completing the task",
          "Stage 3: checking the result",
          "Conclusion: make the process manageable",
        ].map((item, index) => (
          <div
            key={item}
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <span className="font-mono text-[10px] font-bold text-blue-600">
              {index + 1}
            </span>

            <span className="text-xs leading-relaxed text-slate-700">
              {item}
            </span>
          </div>
        ))}
      </DemoCard>
    </div>
  );
}

function ChatMessage({
  children,
  student = false,
}) {
  return (
    <div
      className={`flex ${
        student
          ? "justify-end"
          : "justify-start"
      }`}
    >
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
          student
            ? "rounded-tr-md bg-blue-600 text-white"
            : "rounded-tl-md border border-slate-200 bg-slate-50 text-slate-700"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function StudentDraftDemo({
  text,
  setText,
  onContinue,
}) {
  const words = useMemo(() => {
    const value = String(text || "").trim();

    return value
      ? value.split(/\s+/).length
      : 0;
  }, [text]);

  return (
    <DemoCard title="Draft editor">
      <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700">
        <span>Autosaved</span>
        <span>{words} words</span>
      </div>

      <textarea
        value={text}
        onChange={(event) =>
          setText(event.target.value)
        }
        rows={12}
        className="w-full resize-none rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] text-slate-400">
          The exact writing entered here will appear in AI feedback.
        </p>

        <button
          type="button"
          onClick={onContinue}
          disabled={!String(text || "").trim()}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-[11px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          Continue to AI feedback
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </DemoCard>
  );
}

function escapeLandingHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeLandingRegExp(value) {
  return String(value || "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createLandingFeedback(draft) {
  const value = String(draft || "").trim();

  const vagueWord =
    value.match(
      /\b(stuff|things|everything|something|good|bad|very)\b/i
    )?.[0];

  if (vagueWord) {
    return {
      target: vagueWord,
      message:
        `“${vagueWord}” is too general. Replace it with more specific wording.`,
    };
  }

  const words = value.match(/\S+/g) || [];

  const opening = words
    .slice(0, Math.min(6, words.length))
    .join(" ")
    .replace(/[.,!?;:]+$/, "");

  return {
    target: opening,
    message:
      "Review this opening. Make the main idea more specific and direct.",
  };
}

function StudentFeedbackDemo({
  draft,
  setDraft,
}) {
  const feedback = useMemo(
    () => createLandingFeedback(draft),
    []
  );

  const [addressed, setAddressed] =
    useState(false);

  // Keep typing inside the browser-managed editable element.
  // Updating React state on every character would rebuild the
  // HTML and move the caret to the beginning.
  const pendingDraftRef =
    useRef(draft);

  function highlightedMarkup() {
    const safeDraft =
      escapeLandingHtml(draft);

    if (!feedback.target) {
      return safeDraft;
    }

    const expression =
      new RegExp(
        escapeLandingRegExp(
          feedback.target
        ),
        "i"
      );

    return safeDraft.replace(
      expression,
      (matchedText) =>
        `<mark
          data-feedback-target="true"
          class="rounded bg-amber-100 px-1 py-0.5 text-slate-900 ring-1 ring-amber-300"
        >${matchedText}</mark>`
    );
  }

  function readEditorText(element) {
    return String(
      element?.innerText || ""
    ).replace(/\u00a0/g, " ");
  }

  function handleEditorInput(event) {
    // Do not call setDraft here. A React render during typing
    // would reset the contentEditable caret.
    pendingDraftRef.current =
      readEditorText(event.currentTarget);
  }

  function handleEditorBlur(event) {
    const nextText =
      readEditorText(event.currentTarget);

    pendingDraftRef.current =
      nextText;

    const targetStillExists =
      nextText
        .toLowerCase()
        .includes(
          feedback.target.toLowerCase()
        );

    const nextAddressed =
      Boolean(feedback.target) &&
      !targetStillExists &&
      Boolean(nextText.trim());

    setDraft(nextText);
    setAddressed(nextAddressed);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <DemoCard title="Draft with AI feedback">
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[10px] font-semibold text-blue-700">
          This is the exact writing entered in the previous step.
        </div>

        <div
          key={feedback.target}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Editable AI feedback demonstration"
          onInput={handleEditorInput}
          onBlur={handleEditorBlur}
          dangerouslySetInnerHTML={{
            __html: highlightedMarkup(),
          }}
          className={`min-h-[220px] cursor-text whitespace-pre-wrap rounded-2xl border bg-white p-4 text-sm leading-7 text-slate-700 outline-none transition focus:ring-4 ${
            addressed
              ? "border-emerald-300 focus:ring-emerald-100"
              : "border-amber-300 focus:ring-amber-100"
          }`}
        />

        <div
          className={`rounded-xl border px-3 py-2.5 text-[10px] font-semibold ${
            addressed
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {addressed
            ? "✓ Revision addressed and saved in the shared draft."
            : "Edit the highlighted wording directly."}
        </div>
      </DemoCard>

      <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />

          <span className="text-xs font-bold text-slate-900">
            Revision point
          </span>
        </div>

        <p className="mt-3 text-xs leading-6 text-slate-600">
          {feedback.message}
        </p>

        <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[10px] leading-5 text-blue-700">
          Any edit made here also updates the draft from the
          previous step.
        </div>
      </div>
    </div>
  );
}

function InstructorMarkDemo() {
  const initialText =
    "Planning before beginning a difficult task can make the whole process easier. First you should prepare everything because that makes stuff better. Next, complete each stage carefully.";

  const passageRef = useRef(null);

  const defaultStart = initialText.indexOf(
    "First you should prepare everything"
  );

  const defaultEnd =
    defaultStart +
    "First you should prepare everything because that makes stuff better."
      .length;

  const [code, setCode] = useState("CS");

  const [selection, setSelection] = useState({
    start: defaultStart,
    end: defaultEnd,
    text: initialText.slice(defaultStart, defaultEnd),
  });

  const [annotation, setAnnotation] = useState({
    start: defaultStart,
    end: defaultEnd,
    text: initialText.slice(defaultStart, defaultEnd),
    code: "CS",
  });

  function getTextOffset(root, node, offset) {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(node, offset);

    return range.toString().length;
  }

  function captureSelection() {
    const root = passageRef.current;
    const browserSelection = window.getSelection();

    if (
      !root ||
      !browserSelection ||
      browserSelection.rangeCount === 0 ||
      browserSelection.isCollapsed
    ) {
      return;
    }

    const range = browserSelection.getRangeAt(0);

    if (
      !root.contains(range.startContainer) ||
      !root.contains(range.endContainer)
    ) {
      return;
    }

    const start = getTextOffset(
      root,
      range.startContainer,
      range.startOffset
    );

    const end = getTextOffset(
      root,
      range.endContainer,
      range.endOffset
    );

    const safeStart = Math.min(start, end);
    const safeEnd = Math.max(start, end);

    if (safeEnd <= safeStart) return;

    setSelection({
      start: safeStart,
      end: safeEnd,
      text: initialText.slice(safeStart, safeEnd),
    });
  }

  function applyAnnotation(nextCode) {
    if (!selection.text.trim()) return;

    setCode(nextCode);

    setAnnotation({
      ...selection,
      code: nextCode,
    });

    window.getSelection()?.removeAllRanges();
  }

  function resetAnnotation() {
    setCode("CS");

    const next = {
      start: defaultStart,
      end: defaultEnd,
      text: initialText.slice(defaultStart, defaultEnd),
    };

    setSelection(next);

    setAnnotation({
      ...next,
      code: "CS",
    });
  }

  const highlightStyles = {
    CS:
      "bg-amber-100 text-slate-900 ring-1 ring-inset ring-amber-300",
    AGR:
      "bg-rose-100 text-slate-900 ring-1 ring-inset ring-rose-300",
    RO:
      "bg-violet-100 text-slate-900 ring-1 ring-inset ring-violet-300",
    FR:
      "bg-sky-100 text-slate-900 ring-1 ring-inset ring-sky-300",
    GOOD:
      "bg-emerald-100 text-slate-900 ring-1 ring-inset ring-emerald-300",
  };

  return (
    <DemoCard title="Exact-text annotation">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
        <span className="text-[10px] font-semibold text-blue-700">
          Drag across exact words below, then choose an annotation code.
        </span>

        <button
          type="button"
          onClick={resetAnnotation}
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-[10px] font-bold text-blue-700"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>

      <div
        ref={passageRef}
        onMouseUp={captureSelection}
        onKeyUp={captureSelection}
        role="textbox"
        tabIndex={0}
        aria-label="Select student writing to annotate"
        className="min-h-[150px] cursor-text select-text rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-8 text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
      >
        {initialText.slice(0, annotation.start)}

        <mark
          className={`rounded px-1 py-0.5 ${
            highlightStyles[annotation.code] ||
            highlightStyles.CS
          }`}
        >
          {initialText.slice(
            annotation.start,
            annotation.end
          )}
        </mark>

        {initialText.slice(annotation.end)}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
          Current text selection
        </p>

        <p className="mt-1 min-h-[20px] text-xs font-semibold leading-5 text-slate-700">
          {selection.text ||
            "Drag across words in the passage above."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {["CS", "AGR", "RO", "FR", "GOOD"].map(
          (item) => (
            <button
              key={item}
              type="button"
              onClick={() => applyAnnotation(item)}
              disabled={!selection.text.trim()}
              className={`rounded-lg border px-3 py-2 font-mono text-[10px] font-bold transition ${
                code === item
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-200"
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {item === "GOOD"
                ? "✓ Good"
                : item}
            </button>
          )
        )}
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
          Selected annotation
        </p>

        <div className="mt-2 flex items-start gap-3">
          <span className="shrink-0 rounded-lg border border-blue-200 bg-white px-2.5 py-1 font-mono text-xs font-black text-blue-700">
            {annotation.code === "GOOD"
              ? "✓ Good"
              : annotation.code}
          </span>

          <p className="text-xs leading-5 text-slate-700">
            “{annotation.text}”
          </p>
        </div>

        <p className="mt-3 text-[10px] leading-5 text-slate-500">
          The highlighted words show exactly where the
          instructor attached this annotation.
        </p>
      </div>
    </DemoCard>
  );
}

function InstructorRubricDemo({
  values,
  setValues,
  submittedGrade,
  onSubmit,
}) {
  const criteria = [
    ["ideas", "Ideas & development"],
    ["organization", "Organization"],
    ["language", "Language"],
  ];

  const total = Object.values(values).reduce(
    (sum, value) => sum + Number(value),
    0
  );

  return (
    <DemoCard title="Rubric grading">
      <div className="rounded-xl border border-violet-100 bg-violet-50 px-3 py-2.5 text-[10px] leading-5 text-violet-700">
        Rubric choices remain instructor-only until the
        grade is submitted.
      </div>

      <div className="space-y-2">
        {criteria.map(([key, label]) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <span className="text-xs font-semibold text-slate-700">
              {label}
            </span>

            <select
              value={values[key]}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [key]: Number(
                    event.target.value
                  ),
                }))
              }
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 outline-none"
            >
              {[0, 1, 2, 3, 4, 5].map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value} / 5
                  </option>
                )
              )}
            </select>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] text-slate-400">
            Current total
          </p>

          <p className="text-2xl font-black text-slate-900">
            {total}{" "}
            <span className="text-sm text-slate-400">
              / 15
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onSubmit(total)}
          className="rounded-xl bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
        >
          Submit grade
        </button>
      </div>

      {submittedGrade !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" />
          Grade submitted. Switch to the student “Read what
          came back” demo to see it.
        </div>
      )}
    </DemoCard>
  );
}

function buildReplayFrames() {
  const frames = [];
  let text = "";

  let persistentPasteStart = null;
  let persistentPasteEnd = null;

  function frame(
    action,
    label,
    detail = "",
    activeStart = null,
    activeEnd = null
  ) {
    frames.push({
      text,
      action,
      label,
      detail,
      activeStart,
      activeEnd,
      pasteStart: persistentPasteStart,
      pasteEnd: persistentPasteEnd,
    });
  }

  function type(
    value,
    detail = "Student typing",
    action = "typing"
  ) {
    for (const char of value) {
      const start = text.length;

      text += char;

      frame(
        action,
        action === "edit" ? "Edit" : "Typing",
        detail,
        action === "edit" ? start : null,
        action === "edit" ? text.length : null
      );
    }
  }

  function remove(
    count,
    detail = "Student deletes text"
  ) {
    for (let index = 0; index < count; index += 1) {
      const oldLength = text.length;

      text = text.slice(0, -1);

      frame(
        "delete",
        "Delete",
        detail,
        Math.max(0, oldLength - 2),
        text.length
      );
    }
  }

  function paste(
    value,
    detail = "Student pasted text"
  ) {
    persistentPasteStart = text.length;

    text += value;

    persistentPasteEnd = text.length;

    frame(
      "paste",
      "Paste",
      detail,
      persistentPasteStart,
      persistentPasteEnd
    );
  }

  frame(
    "ready",
    "Ready",
    "Replay begins with an empty draft."
  );

  type(
    "Planning before beginning a difficult task can make the whole process easier.\n\n",
    "Student types the opening sentence."
  );

  type(
    "First you should prepare stuff",
    "Student writes an initial version."
  );

  remove(
    "stuff".length,
    "Student backspaces to remove vague wording."
  );

  type(
    "the ",
    "Student starts replacing the deleted wording.",
    "edit"
  );

  paste(
    "tools and information you need",
    "Student pastes this phrase into the draft."
  );

  type(
    ".\n\nNext, complete each stage carefuly",
    "Student continues typing after the pasted text."
  );

  remove(
    "carefuly".length,
    "Student deletes the misspelled word."
  );

  type(
    "carefully",
    "Student types the corrected word.",
    "edit"
  );

  type(
    " and check the result before finishing.",
    "Student completes the paragraph."
  );

  frame(
    "complete",
    "Complete",
    "The replay preserves visible evidence of the pasted phrase."
  );

  return frames;
}

const REPLAY_FRAMES = buildReplayFrames();

function ReplayText({ frame }) {
  const {
    text,
    action,
    activeStart,
    activeEnd,
    pasteStart,
    pasteEnd,
  } = frame;

  if (!text) {
    return (
      <span className="text-slate-300">
        Replay begins with an empty draft.
      </span>
    );
  }

  const boundaries = new Set([
    0,
    text.length,
  ]);

  if (
    Number.isInteger(pasteStart) &&
    Number.isInteger(pasteEnd)
  ) {
    boundaries.add(
      Math.max(0, Math.min(text.length, pasteStart))
    );
    boundaries.add(
      Math.max(0, Math.min(text.length, pasteEnd))
    );
  }

  if (
    Number.isInteger(activeStart) &&
    Number.isInteger(activeEnd)
  ) {
    boundaries.add(
      Math.max(0, Math.min(text.length, activeStart))
    );
    boundaries.add(
      Math.max(0, Math.min(text.length, activeEnd))
    );
  }

  const points =
    Array.from(boundaries).sort((a, b) => a - b);

  return (
    <span className="whitespace-pre-wrap">
      {points.slice(0, -1).map((start, index) => {
        const end = points[index + 1];

        if (end <= start) return null;

        const value = text.slice(start, end);

        const insidePaste =
          Number.isInteger(pasteStart) &&
          Number.isInteger(pasteEnd) &&
          start >= pasteStart &&
          end <= pasteEnd;

        const insideActive =
          Number.isInteger(activeStart) &&
          Number.isInteger(activeEnd) &&
          start >= activeStart &&
          end <= activeEnd;

        let className = "";

        if (insidePaste) {
          className =
            "rounded bg-violet-200 px-0.5 text-violet-950 ring-1 ring-violet-300";
        }

        if (insideActive && action === "edit") {
          className =
            "rounded bg-amber-200 px-0.5 text-amber-950 ring-1 ring-amber-300";
        }

        if (insideActive && action === "delete") {
          className =
            "rounded bg-rose-100 px-0.5 text-rose-900";
        }

        if (insideActive && action === "paste") {
          className =
            "rounded bg-violet-300 px-0.5 text-violet-950 ring-2 ring-violet-400";
        }

        return (
          <span
            key={`${start}-${end}`}
            className={className}
          >
            {value}
          </span>
        );
      })}
    </span>
  );
}

function WritingReplayDemo() {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const currentFrame =
    REPLAY_FRAMES[index] || REPLAY_FRAMES[0];

  useEffect(() => {
    if (!playing) return undefined;

    if (index >= REPLAY_FRAMES.length - 1) {
      setPlaying(false);
      return undefined;
    }

    const delays = {
      ready: 450,
      typing: 38,
      delete: 85,
      edit: 90,
      paste: 1100,
      complete: 800,
    };

    const timer = window.setTimeout(
      () => setIndex((value) => value + 1),
      delays[currentFrame.action] || 60
    );

    return () => window.clearTimeout(timer);
  }, [
    currentFrame.action,
    index,
    playing,
  ]);

  const actionStyles = {
    ready:
      "border-slate-200 bg-slate-50 text-slate-600",
    typing:
      "border-blue-200 bg-blue-50 text-blue-700",
    delete:
      "border-rose-200 bg-rose-50 text-rose-700",
    edit:
      "border-amber-200 bg-amber-50 text-amber-700",
    paste:
      "border-violet-200 bg-violet-50 text-violet-700",
    complete:
      "border-emerald-200 bg-emerald-50 text-emerald-700",
  };

  function resetReplay() {
    setIndex(0);
    setPlaying(false);
  }

  function toggleReplay() {
    if (
      !playing &&
      index >= REPLAY_FRAMES.length - 1
    ) {
      setIndex(0);
      setPlaying(true);
      return;
    }

    setPlaying((value) => !value);
  }

  return (
    <DemoCard title="Character-by-character replay">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={resetReplay}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-amber-300 hover:text-amber-700"
          aria-label="Reset replay"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleReplay}
          className="inline-flex h-9 items-center gap-2 rounded-xl bg-amber-600 px-4 text-xs font-bold text-white transition hover:bg-amber-700"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}

          {playing ? "Pause" : "Play"}
        </button>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            actionStyles[currentFrame.action] ||
            actionStyles.ready
          }`}
        >
          {currentFrame.label}
        </span>

        <span className="ml-auto font-mono text-[10px] text-slate-400">
          Event {index + 1} / {REPLAY_FRAMES.length}
        </span>
      </div>

      <input
        type="range"
        min="0"
        max={REPLAY_FRAMES.length - 1}
        value={index}
        onChange={(event) => {
          setIndex(Number(event.target.value));
          setPlaying(false);
        }}
        className="w-full accent-amber-600"
      />

      <div
        className={`rounded-xl border px-3 py-2 text-[10px] font-semibold ${
          actionStyles[currentFrame.action] ||
          actionStyles.ready
        }`}
      >
        {currentFrame.detail}
      </div>

      <div className="relative min-h-[250px] rounded-2xl border border-slate-200 bg-white p-5 font-mono text-sm leading-7 text-slate-700">
        <ReplayText frame={currentFrame} />

        {playing &&
          currentFrame.action === "typing" && (
            <span className="ml-0.5 inline-block h-[1.15em] w-[2px] animate-pulse bg-blue-500 align-middle" />
          )}

        {Number.isInteger(currentFrame.pasteStart) && (
          <div className="absolute bottom-3 right-3 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-wider text-violet-700 shadow-sm">
            Pasted text remains highlighted
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [
            "Typing",
            "text-blue-700 bg-blue-50 border-blue-100",
          ],
          [
            "Delete",
            "text-rose-700 bg-rose-50 border-rose-100",
          ],
          [
            "Edit",
            "text-amber-700 bg-amber-50 border-amber-100",
          ],
          [
            "Paste",
            "text-violet-700 bg-violet-50 border-violet-100",
          ],
        ].map(([label, classes]) => (
          <div
            key={label}
            className={`rounded-xl border px-2 py-2 text-center text-[9px] font-bold ${classes}`}
          >
            {label}
          </div>
        ))}
      </div>
    </DemoCard>
  );
}

function ReturnedWorkDemo({
  submittedGrade,
  instructorPreview = false,
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <DemoCard title="Returned result">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
            Grade
          </p>

          {submittedGrade === null ? (
            <>
              <p className="mt-2 text-2xl font-black text-slate-400">
                Not submitted
              </p>

              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                Try the instructor rubric demo and submit a
                grade. The result here will update.
              </p>
            </>
          ) : (
            <>
              <p className="mt-2 text-4xl font-black text-slate-950">
                {submittedGrade}
                <span className="text-lg text-slate-400">
                  /15
                </span>
              </p>

              <p className="mt-2 text-[11px] text-emerald-700">
                Instructor grade submitted
              </p>
            </>
          )}
        </div>

        {instructorPreview && (
          <p className="text-[10px] text-slate-400">
            This is the same result the student receives.
          </p>
        )}
      </DemoCard>

      <DemoCard title="Teacher feedback">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[10px] font-bold text-amber-700">
            CS · Sentence clarity
          </p>

          <p className="mt-2 text-xs leading-6 text-slate-700">
            “First you should prepare everything because that
            makes stuff better.”
          </p>

          <p className="mt-2 text-[11px] leading-5 text-slate-500">
            Be more specific about what preparation the reader
            should complete.
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-[10px] font-bold text-emerald-700">
            ✓ Good
          </p>

          <p className="mt-2 text-xs leading-5 text-slate-600">
            Clear sequence and useful transitions between the
            main stages.
          </p>
        </div>
      </DemoCard>
    </div>
  );
}

function DemoCard({
  title,
  children,
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-xs font-bold text-slate-900">
        {title}
      </h3>

      {children}
    </div>
  );
}
