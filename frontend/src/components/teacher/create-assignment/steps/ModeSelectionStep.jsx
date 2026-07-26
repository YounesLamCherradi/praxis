import React from "react";
import { Pencil, Wand2 } from "lucide-react";

export default function ModeSelectionStep({ creationMode, setCreationMode }) {
  const cardClass = (active) =>
    `w-full rounded-2xl border p-4 text-left transition-all ${
      active
        ? "border-blue-300 bg-blue-50 ring-4 ring-blue-500/10"
        : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/30"
    }`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <button
          type="button"
          onClick={() => setCreationMode("ai")}
          className={cardClass(creationMode === "ai")}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700">
              <Wand2 className="h-4 w-4" />
            </span>

            <div>
              <p className="text-sm font-bold text-slate-950">AI-assisted</p>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Use AI to draft assignment content quickly, then review and edit.
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setCreationMode("manual")}
          className={cardClass(creationMode === "manual")}
        >
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700">
              <Pencil className="h-4 w-4" />
            </span>

            <div>
              <p className="text-sm font-bold text-slate-950">Manual</p>

              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Write the assignment yourself with full control over each field.
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
