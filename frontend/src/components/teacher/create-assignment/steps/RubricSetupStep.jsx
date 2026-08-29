import { useEffect, useState } from "react";
import {
  AlertCircle,
  Link2,
  Loader2,
  Pencil,
  Upload,
  Wand2,
} from "lucide-react";

import RubricWorkspace from "../rubric/RubricWorkspace";

export default function RubricSetupStep({
  startManualRubric,
  savedRubricOptions,
  reusableRubrics,
  rubricMode,
  setRubricMode,
  startGeneratedRubric,
  selectedRubricId,
  handleSavedRubricSelection,
  rubricTitle,
  setRubricTitle,
  uploadedRubricName,
  handleFileUpload,
  isParsingRubric,
  rubricParseError,
  isGeneratingRubric,
  rubricGenerationError,
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
  const [sourceExpanded, setSourceExpanded] = useState(!rubricMode);
  const [isDraggingRubric, setIsDraggingRubric] = useState(false);
  const [rubricReadingStage, setRubricReadingStage] = useState(0);

  const rubricReadingMessages = [
    "Opening the rubric document",
    "Reading the rubric content",
    "Identifying criteria and point values",
    "Analyzing performance levels and descriptors",
    "Checking the scoring structure",
    "Organizing the rubric for review",
    "Finalizing the rubric preview",
  ];

  useEffect(() => {
    if (!isParsingRubric) {
      setRubricReadingStage(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRubricReadingStage((current) =>
        Math.min(
          current + 1,
          rubricReadingMessages.length - 1
        )
      );
    }, 2800);

    return () => window.clearInterval(intervalId);
  }, [isParsingRubric]);
  const selectedSavedRubric = savedRubricOptions.find(
    (rubric) => String(rubric.id) === String(selectedRubricId)
  );
  const sourceSummary =
    rubricMode === "uploaded"
      ? uploadedRubricName || "Uploaded rubric"
      : rubricMode === "saved"
      ? selectedSavedRubric?.title || "Previous rubric"
      : rubricMode === "generated"
      ? "AI-created rubric"
      : rubricMode === "manual"
      ? "Manual rubric"
      : "Choose a rubric source";

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

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {sourceExpanded || !rubricMode ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 sm:rounded-3xl sm:p-7">
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2 sm:mb-5 sm:gap-3">
            <div>
              <h3 className="text-[17px] font-black leading-tight text-slate-950 sm:text-2xl">
                Rubric <span className="font-semibold text-slate-500">(optional)</span>
              </h3>

              <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:mt-2 sm:text-lg sm:leading-relaxed sm:text-slate-600">
                Upload or reuse a rubric. The AI will shape its output to match.
              </p>
            </div>

            {rubricMode && criteria.length > 0 && (
              <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                {rubricTotal} points
              </span>
            )}
          </div>

          <label className="block text-[11px] font-black text-slate-700 sm:text-lg">
            <span className="sm:hidden">Rubric upload</span>
            <span className="hidden sm:inline">
              Rubric upload
              <span className="font-semibold text-slate-500"> — drag and drop or click to browse</span>
            </span>
          </label>

          <label
            className={`mt-2 flex min-h-[108px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-3 py-3 text-center transition-all sm:mt-3 sm:min-h-48 sm:rounded-3xl sm:px-6 sm:py-8 ${
              isDraggingRubric
                ? "scale-[1.01] border-blue-500 bg-blue-100/70 ring-4 ring-blue-500/15"
                : rubricMode === "uploaded"
                ? "border-blue-400 bg-blue-50 ring-4 ring-blue-500/10"
                : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/30"
            } ${isParsingRubric ? "pointer-events-none opacity-80" : ""}`}
            onClick={() => setRubricMode("uploaded")}
            onDragEnter={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDraggingRubric(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.stopPropagation();
              event.dataTransfer.dropEffect = "copy";
              setIsDraggingRubric(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setIsDraggingRubric(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setIsDraggingRubric(false);

              const file = event.dataTransfer.files?.[0];
              if (!file) return;

              setRubricMode("uploaded");
              handleFileUpload(file);
              setSourceExpanded(false);
            }}
          >
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                handleFileUpload(file);
                setSourceExpanded(false);
              }}
            />

            {isParsingRubric ? (
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 sm:h-9 sm:w-9" />
            ) : (
              <Upload className="h-6 w-6 text-blue-600 sm:h-9 sm:w-9" />
            )}

            <p className="mt-2 max-w-[240px] text-[12px] font-bold leading-4 text-slate-800 sm:mt-4 sm:max-w-none sm:text-xl sm:leading-normal">
              {isParsingRubric ? (
                "Reading your rubric..."
              ) : isDraggingRubric ? (
                "Drop the rubric to upload it"
              ) : (
                <>
                  <span className="sm:hidden">Tap to upload a rubric</span>
                  <span className="hidden sm:inline">
                    Drop your rubric PDF or Word document here, or click to browse
                  </span>
                </>
              )}
            </p>

            <p className="mt-1 text-[9px] text-slate-500 sm:mt-2 sm:text-base">
              PDF, DOC, DOCX, or TXT
            </p>

            {uploadedRubricName && (
              <span className="mt-2 max-w-full truncate rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[9px] font-bold text-blue-700 sm:mt-4 sm:px-4 sm:py-2 sm:text-sm">
                {uploadedRubricName}
              </span>
            )}
          </label>

          <div className="mt-3 sm:mt-6">
            <label htmlFor="saved-rubric-source" className="block text-[11px] font-bold text-slate-700 sm:text-base">
              Use a previous rubric
            </label>

            <select
              id="saved-rubric-source"
              value={rubricMode === "saved" ? selectedRubricId : ""}
              onChange={(event) => {
                const rubricId = event.target.value;
                setRubricMode("saved");
                handleSavedRubricSelection(rubricId);
                if (rubricId) setSourceExpanded(false);
              }}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-[16px] text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 sm:mt-2 sm:h-auto sm:rounded-2xl sm:px-4 sm:py-3.5 sm:text-base sm:focus:ring-4"
            >
              <option value="">Select a saved rubric</option>
              {savedRubricOptions.map((rubric) => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.title}
                  {rubric.sourceAssignmentTitle ? ` — from ${rubric.sourceAssignmentTitle}` : ""}
                </option>
              ))}
            </select>

            {savedRubricOptions.length === 0 && (
              <p className="mt-1 text-[10px] text-slate-500 sm:mt-2 sm:text-sm">No previous rubrics are available yet.</p>
            )}
          </div>

          <div className="mt-3 border-t border-slate-200 pt-2.5 text-center sm:mt-5 sm:pt-4">
            <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  startGeneratedRubric();
                  setSourceExpanded(false);
                }}
                className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold transition-colors sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-base ${
                  rubricMode === "generated"
                    ? "bg-violet-50 text-violet-800"
                    : "text-slate-600 hover:bg-violet-50 hover:text-violet-800"
                }`}
              >
                <Wand2 className="h-4 w-4" />
                <span className="sm:hidden">AI rubric</span>
                <span className="hidden sm:inline">Let AI create the rubric</span>
              </button>

              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">•</span>

              <button
                type="button"
                onClick={() => {
                  startManualRubric();
                  setSourceExpanded(false);
                }}
                className={`inline-flex h-9 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold transition-colors sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-base ${
                  rubricMode === "manual"
                    ? "bg-blue-100 text-blue-800"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-800"
                }`}
              >
                <Pencil className="h-4 w-4" />
                <span className="sm:hidden">Manual rubric</span>
                <span className="hidden sm:inline">Create rubric manually</span>
              </button>
            </div>

            <p className="mt-1 hidden text-xs text-slate-500 sm:block sm:text-sm">
              Choose either option to build a rubric and review it before saving.
            </p>
          </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/60 p-3 sm:rounded-2xl sm:p-4 sm:items-center">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-700 sm:text-xs">
                Rubric source selected
              </p>
              <p className="mt-0.5 max-w-[210px] truncate text-[13px] font-black leading-tight text-slate-950 sm:mt-1 sm:max-w-none sm:text-lg">
                {sourceSummary}
              </p>
              {criteria.length > 0 && (
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:mt-1 sm:text-sm sm:text-slate-600">
                  {criteria.length} {criteria.length === 1 ? "criterion" : "criteria"} · {rubricTotal} points
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSourceExpanded(true)}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-white px-2.5 text-[10px] font-bold text-blue-700 transition hover:bg-blue-50 sm:h-auto sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm"
            >
              <span className="sm:hidden">Change</span>
              <span className="hidden sm:inline">Change rubric source</span>
            </button>
          </div>
        )}

        {!sourceExpanded && rubricMode && (
          <section className="space-y-4 min-w-0">
          {rubricMode === "saved" && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4">
              <div className="grid grid-cols-1 gap-2 sm:gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-[10px]">
                    Rubric title
                  </label>

                  <input
                    value={rubricTitle}
                    onChange={(e) => setRubricTitle(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 text-[16px] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 sm:mt-2 sm:h-auto sm:rounded-xl sm:p-3 sm:text-xs sm:focus:ring-4"
                    placeholder="Example: Definition Paragraph Rubric"
                    required
                  />
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 text-[10px] leading-4 text-blue-800 sm:rounded-xl sm:px-3 sm:py-3 sm:text-[11px] sm:leading-relaxed">
                  <span className="sm:hidden">
                    Used by Praxis for AI feedback and grading.
                  </span>
                  <span className="hidden sm:inline">
                    Saved with the assignment and used to guide the AI feedback and grading tools.
                  </span>
                  {reusableRubrics.length > 0 ? (
                    <span className="block mt-1 text-blue-700 font-semibold">
                      {reusableRubrics.length} previous rubric
                      {reusableRubrics.length === 1 ? "" : "s"} available.
                    </span>
                  ) : null}
                </div>
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
                  AI will generate the rubric for you
                </h4>

                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Continue with the assignment details and settings first.
                  AI will use the topic, assignment type, English level,
                  word range, instructions, and instructor brief to generate the
                  rubric when you enter the Review step.
                </p>

                <p className="mt-3 rounded-xl border border-violet-200 bg-white px-4 py-3 text-[11px] font-semibold leading-relaxed text-violet-800">
                  The completed rubric will be available for review before the
                  assignment is saved.
                </p>
              </div>
            </div>
          )}

          {rubricParseError && rubricMode === "uploaded" && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                <p className="text-xs leading-relaxed text-amber-800">
                  {rubricParseError}
                </p>
              </div>
          )}

          {canShowRubricDetails && (
            <>
              {rubricMode !== "saved" ? (
                <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:rounded-2xl sm:p-3">
                  <div className="grid grid-cols-1 items-center gap-2 sm:gap-3 lg:grid-cols-[110px_minmax(0,1fr)_250px]">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-[10px]">
                      Rubric title
                    </label>

                    <input
                      value={rubricTitle}
                      onChange={(e) => setRubricTitle(e.target.value)}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 text-[16px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 sm:h-auto sm:rounded-xl sm:p-3 sm:text-xs sm:focus:ring-4"
                      placeholder="Example: Definition Paragraph Rubric"
                      required
                    />

                    <div className="flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2 sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2.5">
                      <Link2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />

                      <p className="text-[10px] leading-4 text-blue-800 sm:text-[11px] sm:leading-relaxed">
                        <span className="sm:hidden">
                          Used for AI feedback and grading.
                        </span>
                        <span className="hidden sm:inline">
                          Saved with the assignment and used to guide the AI feedback and grading tools.
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

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

          {rubricMode === "uploaded" &&
            isParsingRubric &&
            !criteria.length && (
              <div
                role="status"
                aria-live="polite"
                className="overflow-hidden rounded-2xl border border-blue-200 bg-blue-50/80 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm ring-1 ring-blue-100">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-950">
                        Reading your rubric
                      </h4>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                        In progress
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-blue-800">
                      {rubricReadingMessages[rubricReadingStage]}…
                    </p>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-blue-100">
                      <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-blue-300 via-blue-600 to-blue-300" />
                    </div>

                    <p className="mt-2 text-[10px] text-slate-500">
                      Keep this window open. Praxis is still working on your file.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
