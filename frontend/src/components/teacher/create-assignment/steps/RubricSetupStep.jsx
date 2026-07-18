import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Link2,
  Loader2,
  Pencil,
  Upload,
  Wand2,
} from "lucide-react";

import RubricWorkspace from "../rubric/RubricWorkspace";

export default function RubricSetupStep({
  creationMode,
  setCreationMode,
  startManualRubric,
  savedRubricOptions,
  reusableRubrics,
  rubricMode,
  setRubricMode,
  selectedRubricId,
  handleSavedRubricSelection,
  rubricTitle,
  setRubricTitle,
  uploadedRubricName,
  handleFileUpload,
  isParsingRubric,
  rubricParseError,
  rubricParseSuccess,
  isGeneratingRubric,
  rubricGenerationError,
  rubricGenerationSuccess,
  handleGenerateRubric,
  parsedRubricSchema,
  parsedRubricMatrix,
  criteria,
  rubricTotal,
  rubricView,
  setRubricView,
  expandedCriterionId,
  setExpandedCriterionId,
  updateCriterion,
  addCriterion,
  removeCriterion,
  resetBandsForCriterion,
  updateBand,
  addBand,
  removeBand,
}) {
  const canShowRubricDetails =
    (rubricMode === "manual" && criteria.length > 0) ||
    (rubricMode === "uploaded" &&
      criteria.length > 0 &&
      !isParsingRubric &&
      !rubricParseError) ||
    (rubricMode === "generated" &&
      criteria.length > 0 &&
      !isGeneratingRubric &&
      !rubricGenerationError) ||
    (rubricMode === "saved" &&
      Boolean(selectedRubricId) &&
      criteria.length > 0);

  const modeButtonClass = (active) =>
    `inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
      active
        ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
        : "bg-white text-slate-600 border border-slate-200 hover:border-blue-200 hover:bg-blue-50"
    }`;

  const sourceButtonClass = (active) =>
    `w-full text-left rounded-xl border px-3 py-3 transition-all ${
      active
        ? "bg-blue-50 border-blue-300 ring-4 ring-blue-500/10"
        : "bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30"
    }`;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-950">
              Step 1: Rubric Setup
            </h3>

            <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
              Choose the assignment creation mode and rubric source. The main panel
              updates only after you select or create a rubric.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-[#F8FAFC] p-1">
            <button
              type="button"
              onClick={() => setCreationMode("ai")}
              className={modeButtonClass(creationMode === "ai")}
            >
              <Wand2 className="w-3.5 h-3.5" />
              AI-assisted
            </button>

            <button
              type="button"
              onClick={() => setCreationMode("manual")}
              className={modeButtonClass(creationMode === "manual")}
            >
              <Pencil className="w-3.5 h-3.5" />
              Manual
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[270px_minmax(0,1fr)] gap-4">
        <aside className="space-y-4 xl:sticky xl:top-0 self-start">
          <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-4">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h4 className="font-serif text-sm font-bold text-slate-950">
                  Rubric source
                </h4>

                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  Select how this assignment should use a rubric.
                </p>
              </div>

              {rubricMode && criteria.length > 0 && (
                <span className="shrink-0 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
                  {rubricTotal} pts
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label
                className={`${sourceButtonClass(
                  rubricMode === "uploaded"
                )} block cursor-pointer ${
                  isParsingRubric ? "pointer-events-none opacity-80" : ""
                }`}
                onClick={() => setRubricMode("uploaded")}
              >
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(event) =>
                    handleFileUpload(event.target.files?.[0])
                  }
                />

                <div className="flex items-center gap-2">
                  {isParsingRubric ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Upload className="h-4 w-4 text-blue-600" />
                  )}

                  <p className="text-xs font-bold text-slate-900">
                    {isParsingRubric ? "Parsing rubric..." : "Upload rubric"}
                  </p>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Upload PDF, Word, or text. Text-based files work best.
                </p>

                {uploadedRubricName && (
                  <p className="mt-2 inline-block max-w-full truncate rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[10px] text-blue-700">
                    {uploadedRubricName}
                  </p>
                )}
              </label>

              <button
                type="button"
                onClick={() => setRubricMode("saved")}
                className={sourceButtonClass(rubricMode === "saved")}
              >
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-600" />

                  <p className="text-xs font-bold text-slate-900">
                    Reuse previous
                  </p>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Use a saved rubric or one from a previous assignment.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setRubricMode("generated")}
                className={sourceButtonClass(rubricMode === "generated")}
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-violet-600" />

                  <p className="text-xs font-bold text-slate-900">
                    Auto-generate rubric
                  </p>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Claude will create the rubric later from the assignment details.
                </p>
              </button>

              <button
                type="button"
                onClick={startManualRubric}
                className={sourceButtonClass(rubricMode === "manual")}
              >
                <div className="flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-blue-600" />

                  <p className="text-xs font-bold text-slate-900">
                    Create manually
                  </p>
                </div>

                <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                  Build criteria, points, and score bands yourself.
                </p>
              </button>
            </div>
          </div>



        </aside>

        <section className="space-y-4 min-w-0">
          {rubricMode === "saved" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Choose a saved rubric
                  </label>

                  <select
                    value={selectedRubricId}
                    onChange={(event) =>
                      handleSavedRubricSelection(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Select a saved or previous rubric</option>

                    {savedRubricOptions.map((rubric) => (
                      <option key={rubric.id} value={rubric.id}>
                        {rubric.title}
                        {rubric.sourceAssignmentTitle
                          ? ` — from ${rubric.sourceAssignmentTitle}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {reusableRubrics.length > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                    {reusableRubrics.length} previous rubric
                    {reusableRubrics.length === 1 ? "" : "s"} available
                  </div>
                )}
              </div>

              {savedRubricOptions.length === 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

                  <p className="text-xs leading-relaxed text-amber-800">
                    No saved or previous rubrics are available yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {rubricMode === "generated" && !criteria.length && (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-8 text-center">
              <div className="max-w-lg">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-200 bg-white text-violet-600 shadow-sm">
                  <Wand2 className="h-5 w-5" />
                </div>

                <h4 className="mt-4 font-serif text-base font-bold text-slate-950">
                  Claude will generate the rubric for you
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Continue with the assignment details and settings first.
                  Claude will use the topic, assignment type, English level,
                  word range, instructions, and teacher brief to generate the
                  rubric when you enter the Review step.
                </p>

                <p className="mt-3 rounded-xl border border-violet-200 bg-white px-4 py-3 text-[11px] font-semibold leading-relaxed text-violet-800">
                  The completed rubric will be available for review before the
                  assignment is saved.
                </p>
              </div>
            </div>
          )}

          {(rubricParseSuccess || rubricParseError) &&
            rubricMode === "uploaded" && (
              <div
                className={`flex items-start gap-2 rounded-xl border p-3 ${
                  rubricParseError
                    ? "border-amber-200 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                {rubricParseError ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                )}

                <p
                  className={`text-xs leading-relaxed ${
                    rubricParseError ? "text-amber-800" : "text-emerald-800"
                  }`}
                >
                  {rubricParseError || rubricParseSuccess}
                </p>
              </div>
            )}

          {canShowRubricDetails && (
            <>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      Rubric Title
                    </label>

                    <input
                      value={rubricTitle}
                      onChange={(e) => setRubricTitle(e.target.value)}
                      className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Example: Definition Paragraph Rubric"
                      required
                    />
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
                    <Link2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />

                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Saved with the assignment and used to guide the AI feedback and grading tools.
                    </p>
                  </div>
                </div>
              </div>

              <RubricWorkspace
                rubricMode={rubricMode}
                title={rubricTitle}
                criteria={criteria}
                rubricTotal={rubricTotal}
                parsedRubricSchema={parsedRubricSchema}
                parsedRubricMatrix={parsedRubricMatrix}
                rubricView={rubricView}
                setRubricView={setRubricView}
                expandedCriterionId={expandedCriterionId}
                setExpandedCriterionId={setExpandedCriterionId}
                updateCriterion={updateCriterion}
                addCriterion={addCriterion}
                removeCriterion={removeCriterion}
                resetBandsForCriterion={resetBandsForCriterion}
                updateBand={updateBand}
                addBand={addBand}
                removeBand={removeBand}
              />
            </>
          )}

          {!rubricMode && (
            <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] p-8 text-center">
              <div className="max-w-md">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-600 shadow-sm">
                  <ClipboardList className="h-5 w-5" />
                </div>

                <h4 className="mt-4 font-serif text-base font-bold text-slate-950">
                  Choose a rubric source
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Select Upload rubric, Reuse previous, Auto-generate rubric,
                  or Create manually. The rubric setup and preview will appear
                  here only after you make a selection.
                </p>
              </div>
            </div>
          )}

          {rubricMode === "uploaded" &&
            !uploadedRubricName &&
            !isParsingRubric &&
            !criteria.length && (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
                <div className="max-w-md">
                  <Upload className="mx-auto h-7 w-7 text-blue-600" />

                  <h4 className="mt-3 font-serif text-base font-bold text-slate-950">
                    Upload a rubric file
                  </h4>

                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Click the Upload rubric option again to choose a PDF, Word,
                    or text file. The parsed rubric will appear here afterward.
                  </p>
                </div>
              </div>
            )}

          {rubricMode === "saved" &&
            !selectedRubricId && (
              <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-[#F8FAFC] p-8 text-center">
                <div className="max-w-md">
                  <ClipboardList className="mx-auto h-7 w-7 text-blue-600" />

                  <h4 className="mt-3 font-serif text-base font-bold text-slate-950">
                    Select a saved rubric
                  </h4>

                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Choose a rubric from the saved-rubric list on the left. Its
                    preview and editable criteria will then appear here.
                  </p>
                </div>
              </div>
            )}

          {rubricMode === "uploaded" &&
            isParsingRubric &&
            !criteria.length && (
              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 flex items-start gap-3">
                <Loader2 className="w-5 h-5 text-blue-700 animate-spin mt-0.5 shrink-0" />

                <div>
                  <h4 className="font-serif text-sm font-bold text-slate-950">
                    Reading your rubric...
                  </h4>

                  
                </div>
              </div>
            )}
        </section>
      </div>
    </div>
  );
}