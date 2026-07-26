import React, { useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
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
    return `${cls.code}  -  ${cls.name}`;
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
  assignmentTypeCustom,
  setAssignmentTypeCustom,

  studentLevel,
  setStudentLevel,

  gradeScale,
  setGradeScale,
  rubricMode,

  feedbackChecks,
  setFeedbackChecks,

  aiBrief,
  setAiBrief,

  isGenerating,
  generationError,
  generationSuccess,
  generatedDraft,
  handleGenerateAssignmentDraft,
}) {
  const isAiMode = creationMode === "ai";
  const shouldShowGeneratedAssignment =
    isAiMode && Boolean(generatedDraft);

  const [isDescriptionExpanded, setIsDescriptionExpanded] =
    useState(!generatedDraft);

  useEffect(() => {
    if (generatedDraft) {
      setIsDescriptionExpanded(false);
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
      {isAiMode ? (
        <div className="space-y-3">
          {generatedDraft && !isDescriptionExpanded && (
            <div className="flex flex-col gap-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  <p className="text-xs font-bold text-slate-900">
                    Assignment generated from your description
                  </p>
                </div>

                <p className="mt-1 truncate text-[11px] text-slate-500">
                  {aiBrief}
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDescriptionExpanded(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[10px] font-bold text-violet-700 hover:bg-violet-50"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                  Show description
                </button>

                <button
                  type="button"
                  onClick={handleGenerateAssignmentDraft}
                  disabled={isGenerating || !aiBrief.trim() || classes.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-[10px] font-bold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isGenerating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Regenerate
                </button>
              </div>
            </div>
          )}

          <div
            className={`${
              isDescriptionExpanded || !generatedDraft ? "block" : "hidden"
            } space-y-5 rounded-2xl border border-violet-200 bg-violet-50/50 p-5`}
          >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700">
              <Wand2 className="h-4 w-4" />
            </div>

            <div>
              <h4 className="font-serif text-sm font-bold text-slate-950">
                Describe the assignment
              </h4>

              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-violet-800">
                Use one plain-English description. Include only details that matter
                to you. Praxis will choose sensible defaults for anything you omit.
              </p>
              </div>
            </div>

            {generatedDraft && (
              <button
                type="button"
                onClick={() => setIsDescriptionExpanded(false)}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-[10px] font-bold text-violet-700 hover:bg-violet-50"
              >
                <ChevronUp className="h-3.5 w-3.5" />
                Hide description
              </button>
            )}
          </div>

          <label className="block space-y-2">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              What assignment do you want to create?
              <span className="ml-1 text-red-600">*</span>
            </span>

            <textarea
              value={aiBrief}
              onChange={(event) => setAiBrief(event.target.value)}
              rows={9}
              placeholder={`Example:

Create a B1 process paragraph for CSC4301 about how students prepare for an important exam. It should be 250–400 words and due next Friday at 11:59 PM. Give students two AI feedback checks and enable the planning coach with automatic outline.`}
              className="w-full resize-y rounded-2xl border border-violet-200 bg-white px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
            />
          </label>

          {classes.length === 0 && (
            <MessageBox
              tone="error"
              message="No active courses are available. Create or restore a course before generating the assignment."
            />
          )}

          <div className="flex flex-col gap-2 border-t border-violet-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[11px] leading-relaxed text-slate-500">
              You may mention the course, level, due date, word count, assignment type, Coach support, or feedback limits in the same description.
            </p>

            <button
              type="button"
              onClick={handleGenerateAssignmentDraft}
              disabled={
                isGenerating ||
                !aiBrief.trim() ||
                classes.length === 0
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-xs font-bold text-white shadow-sm shadow-violet-600/20 transition-all hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}

              {isGenerating
                ? "Building the assignment..."
                : generatedDraft
                ? "Regenerate from Description"
                : "Generate Complete Assignment"}
            </button>
          </div>

          {generationError && (
            <MessageBox tone="error" message={generationError} />
          )}

          {generationSuccess && generatedDraft && (
            <MessageBox tone="success" message={generationSuccess} />
          )}
          </div>
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
          assignmentTypeCustom={assignmentTypeCustom}
          setAssignmentTypeCustom={setAssignmentTypeCustom}
          studentLevel={studentLevel}
          setStudentLevel={setStudentLevel}
          feedbackChecks={feedbackChecks}
          setFeedbackChecks={setFeedbackChecks}
        />
      )}

      {shouldShowGeneratedAssignment && (
        <div className="space-y-5 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Bot className="h-4 w-4" />
              </div>

              <div>
                <h4 className="font-serif text-base font-bold text-slate-950">
                  Generated assignment
                </h4>

                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Praxis filled the assignment from your description. Review and
                  edit every value before continuing.
                </p>
              </div>
            </div>

            <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Ready for review
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
              className="w-full resize-y rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs leading-relaxed text-slate-900 outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <GraduationCap className="h-3.5 w-3.5" />
                Course
              </span>

              <select
                value={selectedClass ? getClassValue(selectedClass) : course || ""}
                onChange={handleCourseChange}
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
              </span>

              <input
                type="datetime-local"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs text-slate-900 outline-none focus:border-blue-500"
              />
            </label>

            <label className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Layers className="h-3.5 w-3.5" />
                Assignment Type
              </span>

              <select
                value={assignmentType}
                onChange={(event) => {
                  const nextType = event.target.value;
                  setAssignmentType(nextType);
                  if (nextType !== "Other") {
                    setAssignmentTypeCustom("");
                  }
                }}
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

            {rubricMode === "generated" && (
              <label className="space-y-1.5">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Grade Scale (Max Score)
                </span>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={gradeScale}
                  onChange={(event) =>
                    setGradeScale(Number(event.target.value || 0))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
            )}

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

            {assignmentType === "Other" && (
              <label className="space-y-1.5 md:col-span-2 xl:col-span-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Custom Assignment Type
                </span>

                <input
                  type="text"
                  value={assignmentTypeCustom}
                  onChange={(event) =>
                    setAssignmentTypeCustom(event.target.value)
                  }
                  placeholder="Write custom assignment type"
                  className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </label>
            )}
          </div>

          {Number(maxWords || 0) < Number(minWords || 0) && (
            <MessageBox
              tone="error"
              message="Maximum words must be greater than or equal to minimum words."
            />
          )}
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
  assignmentTypeCustom,
  setAssignmentTypeCustom,
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
            onChange={(event) => {
              const nextType = event.target.value;
              setAssignmentType(nextType);
              if (nextType !== "Other") {
                setAssignmentTypeCustom("");
              }
            }}
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

        {assignmentType === "Other" && (
          <label className="space-y-1.5 md:col-span-2 xl:col-span-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Custom Assignment Type
            </span>

            <input
              type="text"
              value={assignmentTypeCustom}
              onChange={(event) => setAssignmentTypeCustom(event.target.value)}
              placeholder="Write custom assignment type"
              className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-xs font-bold text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
        )}
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
