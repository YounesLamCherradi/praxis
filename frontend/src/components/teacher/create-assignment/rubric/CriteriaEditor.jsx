import React from "react";
import { ChevronDown, ChevronUp, PlusCircle, RotateCcw, Trash2 } from "lucide-react";

import { safeArray } from "../rubricUtils";

export default function CriteriaEditor({
  criteria = [],
  rubricTotal = 0,
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
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-start justify-between gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div>
          <h4 className="font-serif text-[13px] font-black leading-tight text-slate-950 sm:text-sm">
            Edit rubric
          </h4>

          <p className="mt-0.5 max-w-[190px] text-[10px] leading-4 text-slate-500 sm:mt-1 sm:max-w-none sm:text-[11px]">
            Use this only if the parser made a mistake or the instructor wants to
            customize the rubric.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <span className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold px-2 py-1 rounded-lg">
            {rubricTotal} pts
          </span>

          <button
            type="button"
            onClick={addCriterion}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-blue-600 px-2.5 text-[10px] font-bold text-white hover:bg-blue-700 sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-[11px]"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Add criterion
          </button>
        </div>
      </div>

      {safeArray(criteria).map((criterion, index) => {
        const bands = safeArray(criterion.bands);

        const isExpanded =
          String(expandedCriterionId) === String(criterion.id);

        return (
          <div
            key={criterion.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white sm:rounded-2xl"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedCriterionId(
                  isExpanded ? "" : criterion.id
                )
              }
              className={`flex w-full items-center justify-between gap-2 p-3 text-left transition-all sm:p-4 ${
                isExpanded
                  ? "border-b border-slate-100 bg-blue-50/60"
                  : "bg-[#F8FAFC] hover:bg-blue-50/40"
              }`}
              aria-expanded={isExpanded}
            >
              <div>
                <p className="text-[12px] font-black leading-tight text-slate-950 sm:text-xs">
                  {criterion.name || `Criterion ${index + 1}`}
                </p>

                <p className="mt-0.5 text-[10px] text-slate-500 sm:text-[11px]">
                  {bands.length} levels · {criterion.points || 0} pts
                </p>
              </div>

              <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[9px] font-bold text-blue-700 sm:gap-2 sm:rounded-lg sm:text-[10px]">
                <span className="sm:hidden">{isExpanded ? "Close" : "Edit"}</span>
                <span className="hidden sm:inline">{isExpanded ? "Collapse" : "Expand / edit"}</span>
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="space-y-3 p-3 sm:space-y-4 sm:p-4">
              <div className="grid grid-cols-1 gap-2 sm:gap-3 lg:grid-cols-4">
                <label className="lg:col-span-2 space-y-1.5">
                  <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    Criterion name
                  </span>

                  <input
                    value={criterion.name}
                    onChange={(e) =>
                      updateCriterion(criterion.id, "name", e.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 text-[16px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 sm:h-auto sm:rounded-xl sm:p-3 sm:text-xs sm:focus:ring-4"
                    placeholder="Example: Task Response"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    Points
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={criterion.points}
                    onChange={(e) =>
                      updateCriterion(criterion.id, "points", e.target.value)
                    }
                    className="h-10 w-full rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 font-mono text-[16px] font-bold text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 sm:h-auto sm:rounded-xl sm:p-3 sm:text-xs sm:focus:ring-4"
                  />
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => resetBandsForCriterion(criterion.id)}
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-3 sm:text-[11px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset levels
                  </button>

                  <button
                    type="button"
                    onClick={() => removeCriterion(criterion.id)}
                    disabled={criteria.length === 1}
                    className={`inline-flex h-9 items-center justify-center rounded-lg border px-2.5 text-[10px] font-bold sm:h-auto sm:rounded-xl sm:px-3 sm:py-3 sm:text-[11px] ${
                      criteria.length === 1
                        ? "border-slate-100 text-slate-300 cursor-not-allowed"
                        : "border-red-100 text-red-600 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <label className="block space-y-1 sm:space-y-1.5">
                <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  Criterion description
                </span>

                <textarea
                  rows={2}
                  value={criterion.description}
                  onChange={(e) =>
                    updateCriterion(
                      criterion.id,
                      "description",
                      e.target.value
                    )
                  }
                  className="min-h-[72px] w-full resize-none rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[16px] leading-5 text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 sm:min-h-0 sm:rounded-xl sm:p-3 sm:text-xs sm:leading-relaxed sm:focus:ring-4"
                  placeholder="Describe what this criterion measures."
                />
              </label>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
                    Performance levels
                  </p>

                  <button
                    type="button"
                    onClick={() => addBand(criterion.id)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2.5 text-[10px] font-bold text-blue-700 hover:bg-blue-100 sm:h-auto sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2 sm:text-[11px]"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add level
                  </button>
                </div>

                {bands.map((band) => (
                  <div
                    key={band.id}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 bg-[#F8FAFC] p-2.5 sm:gap-3 sm:rounded-xl sm:p-3 lg:grid-cols-12"
                  >
                    <label className="lg:col-span-3 space-y-1.5">
                      <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        Label
                      </span>

                      <input
                        value={band.label}
                        onChange={(e) =>
                          updateBand(
                            criterion.id,
                            band.id,
                            "label",
                            e.target.value
                          )
                        }
                        className="w-full bg-white text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500"
                      />
                    </label>

                    <label className="lg:col-span-2 space-y-1.5">
                      <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        Points
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={band.points}
                        onChange={(e) =>
                          updateBand(
                            criterion.id,
                            band.id,
                            "points",
                            e.target.value
                          )
                        }
                        className="w-full bg-white text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 font-mono font-bold"
                      />
                    </label>

                    <label className="lg:col-span-6 space-y-1.5">
                      <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        Description
                      </span>

                      <textarea
                        rows={2}
                        value={band.description}
                        onChange={(e) =>
                          updateBand(
                            criterion.id,
                            band.id,
                            "description",
                            e.target.value
                          )
                        }
                        className="w-full bg-white text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                      />
                    </label>

                    <div className="lg:col-span-1 flex lg:items-end">
                      <button
                        type="button"
                        onClick={() => removeBand(criterion.id, band.id)}
                        disabled={bands.length === 1}
                        className={`w-full inline-flex items-center justify-center border rounded-xl px-3 py-3 text-[11px] font-bold ${
                          bands.length === 1
                            ? "border-slate-100 text-slate-300 cursor-not-allowed"
                            : "border-red-100 text-red-600 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}