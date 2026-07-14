import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Sparkles,
  Wand2,
} from "lucide-react";

const ASSIGNMENT_TYPES = [
  "Response",
  "Definition",
  "Argument",
  "Narrative",
  "Compare and Contrast",
  "Process Paragraph",
  "Reflection",
  "Summary",
  "Analysis",
  "Other",
];

const STUDENT_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "Mixed level",
];

function getClassValue(cls) {
  return String(cls?.id || cls?.code || cls?.name || "");
}

function getClassLabel(cls) {
  if (!cls) return "Unnamed course";

  if (cls.code && cls.name) {
    return `${cls.code} — ${cls.name}`;
  }

  return cls.code || cls.name || "Unnamed course";
}

export default function AssignmentDetailsStep({
  creationMode,
  classes = [],

  title,
  setTitle,

  description,
  setDescription,

  course,
  setCourse,

  dueDate,
  setDueDate,

  minWords,
  setMinWords,

  maxWords,
  setMaxWords,

  assignmentType,
  setAssignmentType,

  studentLevel,
  setStudentLevel,

  feedbackChecks,
  setFeedbackChecks,

  aiTopic,
  setAiTopic,

  aiBrief,
  setAiBrief,

  allowAI,
  aiFeedback,
  writingPlayback,

  includeRubricInPrompt,
  setIncludeRubricInPrompt,

  includeStudentAiSupportInPrompt,
  setIncludeStudentAiSupportInPrompt,

  includeIntegritySettingsInPrompt,
  setIncludeIntegritySettingsInPrompt,

  isGenerating,
  generationError,
  generationSuccess,
  generatedDraft,
  handleGenerateAssignmentDraft,
}) {
  const isAiMode = creationMode === "ai";
  const shouldShowStudentDraft = !isAiMode || Boolean(generatedDraft);
  const [isAiSetupExpanded, setIsAiSetupExpanded] = useState(true);

  useEffect(() => {
    if (generatedDraft) {
      setIsAiSetupExpanded(false);
    }
  }, [generatedDraft]);

  const selectedClass =
    classes.find(
      (cls) =>
        String(cls.id) === String(course) ||
        String(cls.code) === String(course) ||
        String(cls.name) === String(course)
    ) || null;

  function handleCourseChange(event) {
    const selectedValue = event.target.value;

    const matchedClass =
      classes.find(
        (cls) =>
          String(cls.id) === String(selectedValue) ||
          String(cls.code) === String(selectedValue) ||
          String(cls.name) === String(selectedValue)
      ) || null;

    setCourse(
      matchedClass?.code ||
        matchedClass?.name ||
        matchedClass?.id ||
        selectedValue
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700">
            <FileText className="h-4 w-4" />
          </div>

          <div>
            <h3 className="font-serif text-lg font-bold text-slate-950">
              Step 2: Assignment Details
            </h3>

            <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
              {isAiMode
                ? "Complete the AI-assisted setup, then generate the student-facing assignment draft."
                : "Select the course, then write the assignment title, instructions, due date, and requirements."}
            </p>
          </div>
        </div>
      </div>

      {isAiMode ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/50">
          <div className="flex items-start justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700">
                <Wand2 className="h-4 w-4" />
              </div>

              <div>
                <h4 className="font-serif text-sm font-bold text-slate-950">
                  AI-assisted setup
                </h4>

                <p className="mt-1 text-xs leading-relaxed text-violet-800">
                  {generatedDraft
                    ? "The assignment draft has been generated. Reopen this setup to adjust the inputs or regenerate it."
                    : "Add a topic, level, word range, course, due date, and optional settings. Claude will generate an editable assignment draft that the teacher must review before continuing."}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAiSetupExpanded((current) => !current)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[11px] font-bold text-violet-700 transition-all hover:bg-violet-50"
            >
              {isAiSetupExpanded ? (
                <>
                  Hide AI setup
                  <ChevronUp className="h-3.5 w-3.5" />
                </>
              ) : (
                <>
                  Show AI setup
                  <ChevronDown className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>

          {isAiSetupExpanded && (
            <div className="space-y-5 border-t border-violet-200 p-5">

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <label className="space-y-1.5 lg:col-span-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Topic / Prompt Idea
                <span className="ml-1 text-red-600">*</span>
              </span>

              <input
                type="text"
                value={aiTopic}
                onChange={(event) => setAiTopic(event.target.value)}
                placeholder="Example: Healthy living, friendship, happiness, cheese or butter..."
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-900 outline-none transition-all focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Assignment Type
              </span>

              <select
                value={assignmentType}
                onChange={(event) => setAssignmentType(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
              >
                {ASSIGNMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <label className="space-y-1.5 lg:col-span-2">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Teacher Brief
              </span>

              <textarea
                value={aiBrief}
                onChange={(event) => setAiBrief(event.target.value)}
                rows={4}
                placeholder="Example: Create a B1 definition paragraph assignment. Students should define healthy living and support the definition with examples, facts, or details."
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-900 outline-none transition-all focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <label className="space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  English Level
                </span>

                <select
                  value={studentLevel}
                  onChange={(event) => setStudentLevel(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
                >
                  {STUDENT_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Feedback Checks
                </span>

                <input
                  type="number"
                  min="0"
                  max="10"
                  value={feedbackChecks}
                  onChange={(event) =>
                    setFeedbackChecks(Number(event.target.value || 0))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1.5 xl:col-span-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <GraduationCap className="h-3.5 w-3.5" />
                Course
                <span className="text-red-600">*</span>
              </span>

              <select
                value={selectedClass ? getClassValue(selectedClass) : course || ""}
                onChange={handleCourseChange}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
              >
                <option value="">Select a course</option>

                {classes.map((cls) => (
                  <option key={getClassValue(cls)} value={getClassValue(cls)}>
                    {getClassLabel(cls)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Min Words
              </span>

              <input
                type="number"
                min="1"
                value={minWords}
                onChange={(event) =>
                  setMinWords(Number(event.target.value || 0))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Max Words
              </span>

              <input
                type="number"
                min={Math.max(1, Number(minWords || 1))}
                value={maxWords}
                onChange={(event) =>
                  setMaxWords(Number(event.target.value || 0))
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-violet-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <CalendarDays className="h-3.5 w-3.5" />
                Due Date
                <span className="text-red-600">*</span>
              </span>

              <input
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-slate-900 outline-none focus:border-violet-500"
              />
            </label>
          </div>

          {classes.length === 0 && (
            <MessageBox
              tone="error"
              message="No courses are available. Confirm that the teacher workspace passes the classes array to the assignment modal."
            />
          )}

          {Number(maxWords || 0) < Number(minWords || 0) && (
            <MessageBox
              tone="error"
              message="Maximum words must be greater than or equal to minimum words."
            />
          )}

          <div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              What should Claude consider?
            </p>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <PromptOption
                checked={includeRubricInPrompt}
                onChange={setIncludeRubricInPrompt}
                title="Use rubric"
                description="Include the selected or uploaded rubric in generation."
              />

              <PromptOption
                checked={includeStudentAiSupportInPrompt}
                onChange={setIncludeStudentAiSupportInPrompt}
                title="Use AI support settings"
                description={`Ideas coach: ${allowAI ? "on" : "off"} · Feedback: ${
                  aiFeedback ? "on" : "off"
                } · Playback: ${writingPlayback ? "on" : "off"}`}
              />

              <PromptOption
                checked={includeIntegritySettingsInPrompt}
                onChange={setIncludeIntegritySettingsInPrompt}
                title="Use integrity settings"
                description="Include paste, focus, honor, and submission rules."
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-violet-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-slate-500">
              The student-facing fields remain hidden until Claude successfully
              generates the assignment.
            </p>

            <button
              type="button"
              onClick={handleGenerateAssignmentDraft}
              disabled={
                isGenerating ||
                !course ||
                !dueDate ||
                !aiTopic?.trim() ||
                Number(maxWords || 0) < Number(minWords || 0)
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-bold text-white shadow-sm shadow-violet-600/20 transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}

              {isGenerating
                ? "Generating assignment..."
                : generatedDraft
                ? "Regenerate Assignment Draft"
                : "Generate Assignment Draft"}
            </button>
          </div>

          {generationError && (
            <MessageBox tone="error" message={generationError} />
          )}

          {generationSuccess && generatedDraft && (
            <MessageBox tone="success" message={generationSuccess} />
          )}
            </div>
          )}
        </div>
      ) : (
        <ManualAssignmentSetup
          classes={classes}
          selectedClass={selectedClass}
          course={course}
          handleCourseChange={handleCourseChange}
          title={title}
          setTitle={setTitle}
          description={description}
          setDescription={setDescription}
          dueDate={dueDate}
          setDueDate={setDueDate}
          minWords={minWords}
          setMinWords={setMinWords}
          maxWords={maxWords}
          setMaxWords={setMaxWords}
          assignmentType={assignmentType}
          setAssignmentType={setAssignmentType}
          studentLevel={studentLevel}
          setStudentLevel={setStudentLevel}
          feedbackChecks={feedbackChecks}
          setFeedbackChecks={setFeedbackChecks}
        />
      )}

      {shouldShowStudentDraft && isAiMode && (
        <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Bot className="h-4 w-4" />
              </div>

              <div>
                <h4 className="font-serif text-base font-bold text-slate-950">
                  Student-facing assignment draft
                </h4>

                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Claude generated this content. Review and edit every field
                  before continuing.
                </p>
              </div>
            </div>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Draft generated
            </span>
          </div>

          <label className="block space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Assignment Title
              <span className="ml-1 text-red-600">*</span>
            </span>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder="Example: Definition Paragraph — Healthy Living"
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Student Instructions
              <span className="ml-1 text-red-600">*</span>
            </span>

            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
              rows={8}
              placeholder="The generated student instructions will appear here..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReadOnlySummary
              label="Course"
              value={selectedClass ? getClassLabel(selectedClass) : course}
            />

            <ReadOnlySummary label="Assignment Type" value={assignmentType} />

            <ReadOnlySummary label="English Level" value={studentLevel} />

            <ReadOnlySummary
              label="Word Range"
              value={`${minWords || 0}–${maxWords || 0} words`}
            />

            <ReadOnlySummary
              label="Due Date"
              value={dueDate || "Not selected"}
            />

            <ReadOnlySummary
              label="Feedback Checks"
              value={String(feedbackChecks ?? 0)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ManualAssignmentSetup({
  classes,
  selectedClass,
  course,
  handleCourseChange,
  title,
  setTitle,
  description,
  setDescription,
  dueDate,
  setDueDate,
  minWords,
  setMinWords,
  maxWords,
  setMaxWords,
  assignmentType,
  setAssignmentType,
  studentLevel,
  setStudentLevel,
  feedbackChecks,
  setFeedbackChecks,
}) {
  return (
    <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
      <div>
        <h4 className="font-serif text-base font-bold text-slate-950">
          Manual assignment setup
        </h4>

        <p className="mt-1 text-xs text-slate-500">
          Write the final assignment content and requirements yourself.
        </p>
      </div>

      <label className="block space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Assignment Title
          <span className="ml-1 text-red-600">*</span>
        </span>

        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          placeholder="Example: Definition Paragraph — Healthy Living"
          className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs font-bold text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Student Instructions
          <span className="ml-1 text-red-600">*</span>
        </span>

        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          required
          rows={8}
          placeholder="Write clear instructions for the student..."
          className="w-full resize-y rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />
      </label>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <GraduationCap className="h-3.5 w-3.5" />
            Course
            <span className="text-red-600">*</span>
          </span>

          <select
            value={selectedClass ? getClassValue(selectedClass) : course || ""}
            onChange={handleCourseChange}
            required
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
          >
            <option value="">Select a course</option>

            {classes.map((cls) => (
              <option key={getClassValue(cls)} value={getClassValue(cls)}>
                {getClassLabel(cls)}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <CalendarDays className="h-3.5 w-3.5" />
            Due Date
            <span className="text-red-600">*</span>
          </span>

          <input
            type="datetime-local"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            required
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs text-slate-900 outline-none focus:border-blue-500"
          />
        </label>

        <label className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Minimum Words
          </span>

          <input
            type="number"
            min="1"
            value={minWords}
            onChange={(event) =>
              setMinWords(Number(event.target.value || 0))
            }
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
          />
        </label>

        <label className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Maximum Words
          </span>

          <input
            type="number"
            min={Math.max(1, Number(minWords || 1))}
            value={maxWords}
            onChange={(event) =>
              setMaxWords(Number(event.target.value || 0))
            }
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
          />
        </label>

        <label className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <Layers className="h-3.5 w-3.5" />
            Assignment Type
          </span>

          <select
            value={assignmentType}
            onChange={(event) => setAssignmentType(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
          >
            {ASSIGNMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            English Level
          </span>

          <select
            value={studentLevel}
            onChange={(event) => setStudentLevel(event.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
          >
            {STUDENT_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Feedback Checks
          </span>

          <input
            type="number"
            min="0"
            max="10"
            value={feedbackChecks}
            onChange={(event) =>
              setFeedbackChecks(Number(event.target.value || 0))
            }
            className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
          />
        </label>
      </div>

      {Number(maxWords || 0) < Number(minWords || 0) && (
        <MessageBox
          tone="error"
          message="Maximum words must be greater than or equal to minimum words."
        />
      )}
    </div>
  );
}

function ReadOnlySummary({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3">
      <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-xs font-bold text-slate-900">
        {value || "Not set"}
      </p>
    </div>
  );
}

function PromptOption({ checked, onChange, title, description }) {
  return (
    <label
      className={`cursor-pointer rounded-xl border p-3 transition-all ${
        checked
          ? "border-violet-300 bg-white ring-4 ring-violet-500/10"
          : "border-slate-200 bg-white/70 hover:border-violet-200"
      }`}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={Boolean(checked)}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />

        <div>
          <p className="text-[11px] font-bold text-slate-900">{title}</p>

          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            {description}
          </p>
        </div>
      </div>
    </label>
  );
}

function MessageBox({ tone, message }) {
  const isError = tone === "error";

  return (
    <div
      className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
        isError
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      )}

      <p className="text-[11px] font-semibold leading-relaxed">{message}</p>
    </div>
  );
}