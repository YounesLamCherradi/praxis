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
    "Opening the document",
    "Finding criteria and score levels",
    "Organizing the rubric for review",
  ];

  useEffect(() => {
    if (!isParsingRubric) {
      setRubricReadingStage(0);
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setRubricReadingStage(
        (current) => (current + 1) % rubricReadingMessages.length
      );
    }, 2400);

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
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-slate-950 sm:text-2xl">
                Rubric <span className="font-semibold text-slate-500">(optional)</span>
              </h3>

              <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
                Upload or reuse a rubric. The AI will shape its output to match.
              </p>
            </div>

            {rubricMode && criteria.length > 0 && (
              <span className="shrink-0 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-700">
                {rubricTotal} points
              </span>
            )}
          </div>

          <label className="block text-base font-black text-slate-800 sm:text-lg">
            Rubric upload
            <span className="font-semibold text-slate-500"> — drag and drop or click to browse</span>
          </label>

          <label
            className={`mt-3 flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed px-6 py-8 text-center transition-all sm:min-h-48 ${
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
              <Loader2 className="h-9 w-9 animate-spin text-blue-600" />
            ) : (
              <Upload className="h-9 w-9 text-blue-600" />
            )}

            <p className="mt-4 text-lg font-bold text-slate-800 sm:text-xl">
              {isParsingRubric
                ? "Reading your rubric..."
                : isDraggingRubric
                ? "Drop the rubric to upload it"
                : "Drop your rubric PDF or Word document here, or click to browse"}
            </p>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              PDF, DOC, DOCX, or TXT
            </p>

            {uploadedRubricName && (
              <span className="mt-4 max-w-full truncate rounded-full border border-blue-200 bg-white px-4 py-2 text-sm font-bold text-blue-700">
                {uploadedRubricName}
              </span>
            )}
          </label>

          <div className="mt-6">
            <label htmlFor="saved-rubric-source" className="block text-base font-bold text-slate-700">
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
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
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
              <p className="mt-2 text-sm text-slate-500">No previous rubrics are available yet.</p>
            )}
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  startGeneratedRubric();
                  setSourceExpanded(false);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors sm:text-base ${
                  rubricMode === "generated"
                    ? "bg-violet-50 text-violet-800"
                    : "text-slate-600 hover:bg-violet-50 hover:text-violet-800"
                }`}
              >
                <Wand2 className="h-4 w-4" />
                Let AI create the rubric
              </button>

              <span className="hidden text-slate-300 sm:inline" aria-hidden="true">•</span>

              <button
                type="button"
                onClick={() => {
                  startManualRubric();
                  setSourceExpanded(false);
                }}
                className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition-colors sm:text-base ${
                  rubricMode === "manual"
                    ? "bg-blue-100 text-blue-800"
                    : "text-slate-600 hover:bg-blue-50 hover:text-blue-800"
                }`}
              >
                <Pencil className="h-4 w-4" />
                Create rubric manually
              </button>
            </div>

            <p className="mt-1 text-xs text-slate-500 sm:text-sm">
              Choose either option to build a rubric and review it before saving.
            </p>
          </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Rubric source selected
              </p>
              <p className="mt-1 truncate text-base font-black text-slate-950 sm:text-lg">
                {sourceSummary}
              </p>
              {criteria.length > 0 && (
                <p className="mt-1 text-sm text-slate-600">
                  {criteria.length} {criteria.length === 1 ? "criterion" : "criteria"} · {rubricTotal} points
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSourceExpanded(true)}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            >
              Change rubric source
            </button>
          </div>
        )}

        {!sourceExpanded && rubricMode && (
          <section className="space-y-4 min-w-0">
          {rubricMode === "saved" && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-end">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Rubric title
                  </label>

                  <input
                    value={rubricTitle}
                    onChange={(e) => setRubricTitle(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    placeholder="Example: Definition Paragraph Rubric"
                    required
                  />
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-[11px] text-blue-800 leading-relaxed">
                  Saved with the assignment and used to guide the AI feedback and grading tools.
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
                <div className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="grid grid-cols-1 items-center gap-3 lg:grid-cols-[110px_minmax(0,1fr)_250px]">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Rubric title
                    </label>

                    <input
                      value={rubricTitle}
                      onChange={(e) => setRubricTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 text-xs text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Example: Definition Paragraph Rubric"
                      required
                    />

                    <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
                      <Link2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />

                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        Saved with the assignment and used to guide the AI feedback and grading tools.
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
