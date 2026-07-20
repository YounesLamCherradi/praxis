import React from "react";
import {
  Bot,
  Clock3,
  ShieldCheck,
} from "lucide-react";

import ToggleRow from "../shared/ToggleRow";

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

      <p className="text-[11px] leading-relaxed text-slate-500">
        {description}
      </p>
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
      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
        <h3 className="font-serif text-lg font-bold text-slate-950">
          Step 3: Student Support
        </h3>

        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
          Configure Coach chat, notes-only outline, and AI feedback request limits.
        </p>
      </div>

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h4 className="font-serif text-sm font-bold text-slate-950">
            Original student-support controls
          </h4>

          <p className="mt-1 text-xs text-slate-500">
            A value of 0 keeps the special meaning shown below.
          </p>
        </div>

        <ToggleRow
          icon={Bot}
          label="Coach"
          description="Students can brainstorm and plan before drafting. Turning this off stores disableChatbot=true and chatTimeLimit=-1."
          checked={allowAI}
          onChange={handleCoachToggle}
        />

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <NumberSetting
            icon={Clock3}
            label="Coach active-time limit"
            description="0 = unlimited active Coach time. A positive value limits active Coach time in minutes."
            value={coachTimeLimitMinutes}
            onChange={setCoachTimeLimitMinutes}
            disabled={!allowAI}
          />

          <div
            className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
              allowAI
                ? "border-slate-200 bg-[#F8FAFC]"
                : "border-slate-100 bg-slate-50 opacity-60"
            }`}
          >
            <div>
              <p className="text-xs font-bold text-slate-900">
                Auto-build outline from Coach chat
              </p>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Convert planning chat into editable notes when the student reaches the drafting step. Requires Coach.
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

          <NumberSetting
            icon={ShieldCheck}
            label="AI feedback requests"
            description="0 disables AI draft feedback. A positive value is the maximum number of feedback checks available to the student."
            value={feedbackChecks}
            onChange={setFeedbackChecks}
            maximum={20}
          />
        </div>

        {!allowAI && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
            Coach chat, its timer, and automatic Coach outline are disabled. AI draft feedback remains available according to its request limit.
          </div>
        )}
      </section>


    </div>
  );
}