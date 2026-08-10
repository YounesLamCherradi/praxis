import React from "react";
import { AlertCircle } from "lucide-react";

import {
  getRubricToneClasses,
  normalizeCriterion,
  normalizeRubricTone,
  safeArray,
} from "../rubricUtils";

export default function CompactRubricPreview({
  criteria = [],
  rubricTotal = 0,
  parsedRubricMatrix = null,
}) {
  const normalizedCriteria = safeArray(criteria).map(normalizeCriterion);

  if (!normalizedCriteria.length) {
    return (
      <div className="p-5 bg-[#F8FAFC]">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />

          <p className="text-xs text-amber-800 leading-relaxed">
            No rubric criteria are available yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#F8FAFC]">
      {safeArray(parsedRubricMatrix?.notes).length > 0 && (
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 space-y-1">
          {safeArray(parsedRubricMatrix.notes)
            .slice(0, 3)
            .map((note, index) => (
              <p
                key={`${note}-${index}`}
                className="text-[11px] text-blue-800 leading-relaxed"
              >
                {note}
              </p>
            ))}
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
          <span className="col-span-10">Criterion</span>
          <span className="col-span-2 text-center">Points</span>
        </div>

        {normalizedCriteria.map((criterion) => {
          const bands = safeArray(criterion.bands);

          return (
            <div
              key={criterion.id}
              className="rounded-2xl border border-blue-200 bg-white shadow-sm"
            >
              <div className="grid grid-cols-12 items-center gap-2 p-3">
                <div className="col-span-10 min-w-0">
                  <p className="text-xs font-black text-slate-950">
                    {criterion.name}
                  </p>

                  {criterion.description && (
                    <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                      {criterion.description}
                    </p>
                  )}
                </div>

                <div className="col-span-2 flex justify-center">
                  <span className="bg-slate-100 text-slate-700 border border-slate-200 font-mono text-[10px] font-bold px-2 py-1 rounded-lg">
                    {criterion.points || criterion.maxScore || 0} pts
                  </span>
                </div>
              </div>

              <div className="px-3 pb-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-2">
                    {bands.map((band) => {
                      const tone =
                        band.tone ||
                        normalizeRubricTone(
                          band.label,
                          band.points,
                          criterion.points || criterion.maxScore
                        );

                      const styles = getRubricToneClasses(tone);

                      return (
                        <div
                          key={`${criterion.id}-${band.id || band.label}`}
                          className={`rounded-xl border p-3 leading-relaxed ${styles.cell}`}
                        >
                          <div
                            className={`rounded-xl border px-2 py-1.5 mb-2 text-center font-mono font-black text-[10px] ${styles.badge}`}
                          >
                            {band.label} · {band.points ?? band.score} pts
                          </div>

                          <p className="text-[11px] leading-relaxed">
                            {band.description || "No descriptor provided."}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
            </div>
          );
        })}

        <div className="flex items-center justify-end pt-2 text-[11px] text-slate-500">
          <span className="font-mono font-bold">
            Total: {rubricTotal} pts
          </span>
        </div>
      </div>
    </div>
  );
}
