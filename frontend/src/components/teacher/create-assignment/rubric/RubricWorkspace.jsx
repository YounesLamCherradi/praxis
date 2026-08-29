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
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl">
      <div className="flex flex-col gap-1.5 border-b border-slate-100 bg-[#F8FAFC] p-2.5 sm:gap-2 sm:p-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          {!isSavedRubric ? (
            <>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" />

                <h4 className="truncate font-serif text-[13px] font-black leading-tight text-slate-950 sm:text-sm">
                  {title || parsedRubricSchema?.title || "Rubric"}
                </h4>
              </div>

              <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:mt-1 sm:text-[11px]">
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
          <div className="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2">
            <button
              type="button"
              onClick={() => setRubricView("preview")}
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition-all sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-[11px] ${
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
              className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold transition-all sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-[11px] ${
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
        <div className="bg-[#F8FAFC] p-2.5 sm:p-4">
          {!isManualRubric && (
            <div className="mb-2.5 flex items-start gap-1.5 rounded-lg border border-blue-100 bg-blue-50 p-2.5 sm:mb-4 sm:gap-2 sm:rounded-xl sm:p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />

              <p className="text-[10px] leading-4 text-blue-800 sm:text-[11px] sm:leading-relaxed">
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