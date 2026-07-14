import React from "react";

export default function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0">
      <p className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="text-xs font-bold text-slate-900 text-right max-w-[70%]">
        {value}
      </p>
    </div>
  );
}