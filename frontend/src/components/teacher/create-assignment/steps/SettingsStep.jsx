import React from "react";
import {
  Bot,
  CircleHelp,
  Clock3,
  ShieldCheck,
} from "lucide-react";

import ToggleRow from "../shared/ToggleRow";

function HelpTip({ text }) {
  return (
    <span
      className="group relative inline-flex shrink-0 cursor-help items-center"
      tabIndex="0"
      aria-label={text}
    >
      <CircleHelp className="h-3.5 w-3.5 text-slate-400 transition-colors group-hover:text-blue-600 group-focus:text-blue-600" />
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-64 rounded-xl border border-blue-400 bg-blue-600 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-white shadow-xl shadow-blue-900/20 group-hover:block group-focus:block"
      >
        {text}
      </span>
    </span>
  );
}

function NumberSetting({
  icon: Icon,
  label,
  description,
  value,
  onChange,
  disabled = false,
  maximum = 120,
}) {
  function clampInteger(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    const normalized = Number.isFinite(parsed) ? parsed : 0;

    return Math.max(
      0,
      Math.min(maximum, normalized)
    );
  }

  return (
    <label
      className={`space-y-2 rounded-xl border p-4 transition-colors ${
        disabled
          ? "border-slate-100 bg-slate-50 opacity-60"
          : "border-slate-200 bg-[#F8FAFC]"
      }`}
    >
      <span className="flex items-center gap-2 text-xs font-bold text-slate-900">
        <Icon className="h-4 w-4 text-blue-600" />
        {label}
      </span>

      <input
        type="number"
        min="0"
        max={maximum}
        step="1"
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(clampInteger(event.target.value))
        }
        className={`w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${
          disabled ? "cursor-not-allowed" : ""
        }`}
      />

      {description && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {description}
        </p>
      )}
    </label>
  );
}

export default function SettingsStep({
  allowAI,
  setAllowAI,

  coachTimeLimitMinutes,
  setCoachTimeLimitMinutes,

  autoBuildOutlineFromCoach,
  setAutoBuildOutlineFromCoach,

  feedbackChecks,
  setFeedbackChecks,
}) {
  const outlineEnabled = Boolean(
    allowAI && autoBuildOutlineFromCoach
  );

  function handleCoachToggle(value) {
    setAllowAI(value);

    if (!value) {
      setAutoBuildOutlineFromCoach(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ToggleRow
            icon={Bot}
            label={(
              <span className="flex items-center gap-1.5">
                Coach
                <HelpTip text="Coach asks helpful questions so students can think, choose ideas, and make a plan before writing their draft." />
              </span>
            )}
            description="Help students plan before they write."
            checked={allowAI}
            onChange={handleCoachToggle}
          />

          <NumberSetting
            icon={Clock3}
            label={(
              <span className="flex items-center gap-1.5">
                Coach active-time limit
                <HelpTip text="Choose how many active minutes each student can spend with Coach. Enter 0 if you do not want a time limit." />
              </span>
            )}
            description="Enter 0 for unlimited Coach time."
            value={coachTimeLimitMinutes}
            onChange={setCoachTimeLimitMinutes}
            disabled={!allowAI}
          />

          <div
            className={`flex h-full items-start justify-between gap-4 rounded-xl border p-4 ${
              allowAI
                ? "border-slate-200 bg-[#F8FAFC]"
                : "border-slate-100 bg-slate-50 opacity-60"
            }`}
          >
            <div>
              <p className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                Auto-build outline from Coach chat
                <HelpTip text="Praxis uses the student's Coach conversation to create short, editable planning notes. The student sees these notes beside the draft." />
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Create editable notes from the Coach chat.
              </p>
            </div>

            <button
              type="button"
              disabled={!allowAI}
              aria-pressed={outlineEnabled}
              onClick={() =>
                setAutoBuildOutlineFromCoach(
                  !autoBuildOutlineFromCoach
                )
              }
              className={`h-5 w-10 shrink-0 rounded-full p-0.5 transition-all ${
                outlineEnabled ? "bg-blue-600" : "bg-slate-300"
              } ${!allowAI ? "cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`block h-4 w-4 rounded-full bg-white transition-transform ${
                  outlineEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        {!allowAI && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
            Coach chat and its related options are disabled. AI draft feedback remains controlled separately below.
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <label className="grid grid-cols-1 items-center gap-3 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4 sm:grid-cols-[minmax(0,1fr)_120px]">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
                AI feedback requests
                <HelpTip text="Choose how many times each student can ask Praxis to review a draft and give helpful feedback. Enter 0 to turn this off." />
              </span>
              <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">
                Enter 0 to turn AI feedback requests off.
              </span>
            </span>

            <input
              type="number"
              min="0"
              max="20"
              step="1"
              value={feedbackChecks}
              onChange={(event) => {
                const parsed = Number.parseInt(event.target.value, 10);
                setFeedbackChecks(
                  Math.max(0, Math.min(20, Number.isFinite(parsed) ? parsed : 0))
                );
              }}
              aria-label="AI feedback requests per student"
              className="w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
        </div>
      </section>
    </div>
  );
}
