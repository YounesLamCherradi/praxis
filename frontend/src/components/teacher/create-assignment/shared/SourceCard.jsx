import React from "react";

export default function SourceCard({
  active = false,
  icon: Icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all ${
        active
          ? "bg-white border-blue-300 ring-4 ring-blue-500/10"
          : "bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30"
      }`}
    >
      <div className="flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-blue-600" />}

        <p className="text-xs font-bold text-slate-900">
          {title}
        </p>
      </div>

      {description && (
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          {description}
        </p>
      )}
    </button>
  );
}