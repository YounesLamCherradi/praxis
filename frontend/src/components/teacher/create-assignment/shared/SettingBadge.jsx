import React from "react";

export default function SettingBadge({ active, label }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-lg border text-[10px] font-mono font-bold ${
        active
          ? "bg-blue-50 text-blue-700 border-blue-100"
          : "bg-slate-100 text-slate-500 border-slate-200"
      }`}
    >
      {label}
    </span>
  );
}