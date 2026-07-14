import React from "react";

export default function MiniToggle({
  label,
  description,
  checked,
  onChange,
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-xl border p-3 text-left transition-all ${
        checked
          ? "bg-blue-50 border-blue-200"
          : "bg-white border-slate-200 hover:border-blue-200"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold text-slate-900">
          {label}
        </p>

        <span
          className={`w-8 h-4 rounded-full p-0.5 transition-all ${
            checked ? "bg-blue-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`block w-3 h-3 rounded-full bg-white transition-transform ${
              checked ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
      </div>

      {description && (
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          {description}
        </p>
      )}
    </button>
  );
}