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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h4 className="font-serif text-sm font-black text-slate-950">
            Edit rubric
          </h4>

          <p className="text-[11px] text-slate-500 mt-1">
            Use this only if the parser made a mistake or the teacher wants to
            customize the rubric.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold px-2 py-1 rounded-lg">
            {rubricTotal} pts
          </span>

          <button
            type="button"
            onClick={addCriterion}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-[11px] font-bold"
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
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedCriterionId(
                  isExpanded ? "" : criterion.id
                )
              }
              className={`flex w-full flex-col gap-2 p-4 text-left transition-all sm:flex-row sm:items-center sm:justify-between ${
                isExpanded
                  ? "border-b border-slate-100 bg-blue-50/60"
                  : "bg-[#F8FAFC] hover:bg-blue-50/40"
              }`}
              aria-expanded={isExpanded}
            >
              <div>
                <p className="text-xs font-black text-slate-950">
                  {criterion.name || `Criterion ${index + 1}`}
                </p>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  {bands.length} levels · {criterion.points || 0} pts
                </p>
              </div>

              <span className="inline-flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
                {isExpanded ? "Collapse" : "Expand / edit"}
                {isExpanded ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                <label className="lg:col-span-2 space-y-1.5">
                  <span className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    Criterion name
                  </span>

                  <input
                    value={criterion.name}
                    onChange={(e) =>
                      updateCriterion(criterion.id, "name", e.target.value)
                    }
                    className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
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
                    className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 font-mono font-bold"
                  />
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => resetBandsForCriterion(criterion.id)}
                    className="inline-flex items-center justify-center gap-2 w-full border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl px-3 py-3 text-[11px] font-bold"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset levels
                  </button>

                  <button
                    type="button"
                    onClick={() => removeCriterion(criterion.id)}
                    disabled={criteria.length === 1}
                    className={`inline-flex items-center justify-center border rounded-xl px-3 py-3 text-[11px] font-bold ${
                      criteria.length === 1
                        ? "border-slate-100 text-slate-300 cursor-not-allowed"
                        : "border-red-100 text-red-600 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <label className="space-y-1.5 block">
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
                  className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none leading-relaxed"
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
                    className="inline-flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-2 rounded-xl text-[11px] font-bold"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add level
                  </button>
                </div>

                {bands.map((band) => (
                  <div
                    key={band.id}
                    className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3 grid grid-cols-1 lg:grid-cols-12 gap-3"
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