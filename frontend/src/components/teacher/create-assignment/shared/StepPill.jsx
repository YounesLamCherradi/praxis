import React from "react";
import { CheckCircle2 } from "lucide-react";

export default function StepPill({ step, active = false, completed = false }) {
  const Icon = completed ? CheckCircle2 : step.icon;

  return (
    <div
      className={`rounded-2xl border p-3 transition-all ${
        active
          ? "bg-blue-50 border-blue-200 ring-4 ring-blue-500/10"
          : completed
          ? "bg-emerald-50 border-emerald-200"
          : "bg-[#F8FAFC] border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
            active
              ? "bg-white text-blue-700 border-blue-100"
              : completed
              ? "bg-white text-emerald-700 border-emerald-100"
              : "bg-white text-slate-400 border-slate-200"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>

        <div>
          <p
            className={`text-[10px] font-mono font-black uppercase tracking-wider ${
              active
                ? "text-blue-700"
                : completed
                ? "text-emerald-700"
                : "text-slate-400"
            }`}
          >
            Step {step.id}
          </p>

          <p className="text-xs font-bold text-slate-900">
            {step.label}
          </p>
        </div>
      </div>
    </div>
  );
}