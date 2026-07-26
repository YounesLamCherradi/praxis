import React, { useEffect } from "react";
import { AlertCircle, ClipboardList, Pencil } from "lucide-react";

import {
  calculateTotal,
  normalizeCriterion,
  safeArray,
} from "../rubricUtils";

import CompactRubricPreview from "./CompactRubricPreview";
import CriteriaEditor from "./CriteriaEditor";

export default function RubricWorkspace({
  title,
  criteria = [],
  rubricTotal = 0,
  parsedRubricSchema = null,
  parsedRubricMatrix = null,
  rubricMode,
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
  const normalizedCriteria = safeArray(criteria).map(normalizeCriterion);

  const totalPoints =
    rubricTotal ||
    parsedRubricSchema?.totalPoints ||
    parsedRubricMatrix?.totalPoints ||
    calculateTotal(normalizedCriteria);

  const isSavedRubric = rubricMode === "saved";
  const isManualRubric = rubricMode === "manual";
  const canSwitchView =
    rubricMode === "uploaded" || rubricMode === "generated";

  useEffect(() => {
    if (isSavedRubric && rubricView !== "preview") {
      setRubricView("preview");
    }

    if (isManualRubric && rubricView !== "edit") {
      setRubricView("edit");
    }
  }, [
    isSavedRubric,
    isManualRubric,
    rubricView,
    setRubricView,
  ]);

  const effectiveView = isSavedRubric
    ? "preview"
    : isManualRubric
    ? "edit"
    : rubricView;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-[#F8FAFC] p-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {!isSavedRubric ? (
            <>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" />

                <h4 className="font-serif text-sm font-black text-slate-950">
                  {title || parsedRubricSchema?.title || "Rubric"}
                </h4>
              </div>

              <p className="mt-1 text-[11px] text-slate-500">
                {normalizedCriteria.length} criteria · {totalPoints} pts.
                {isManualRubric
                  ? " Edit one criterion at a time to reduce scrolling."
                  : " Preview first; edit only if adjustment is needed."}
              </p>
            </>
          ) : (
            <p className="text-[10px] text-slate-500">
              {normalizedCriteria.length} criteria · {totalPoints} pts. Reused rubrics are preview-only.
            </p>
          )}
        </div>

        {canSwitchView && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRubricView("preview")}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
                effectiveView === "preview"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200"
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Preview
            </button>

            <button
              type="button"
              onClick={() => setRubricView("edit")}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-bold transition-all ${
                effectiveView === "edit"
                  ? "bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-blue-200"
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit rubric
            </button>
          </div>
        )}
      </div>

      {effectiveView === "preview" ? (
        <CompactRubricPreview
          criteria={normalizedCriteria}
          rubricTotal={totalPoints}
          parsedRubricMatrix={parsedRubricMatrix}
          expandedCriterionId={expandedCriterionId}
          setExpandedCriterionId={setExpandedCriterionId}
        />
      ) : (
        <div className="bg-[#F8FAFC] p-4">
          {!isManualRubric && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />

              <p className="text-[11px] leading-relaxed text-blue-800">
                Editing is available when the uploaded or generated rubric
                needs adjustment.
              </p>
            </div>
          )}

          <CriteriaEditor
            criteria={criteria}
            rubricTotal={rubricTotal}
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
        </div>
      )}
    </div>
  );
}