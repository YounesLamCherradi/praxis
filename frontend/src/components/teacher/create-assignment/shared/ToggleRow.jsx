import React from "react";

export default function ToggleRow({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-blue-600 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4" />
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-slate-900">
            {label}
          </p>

          {description && (
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-10 h-5 rounded-full p-0.5 transition-all shrink-0 ${
          checked ? "bg-blue-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}