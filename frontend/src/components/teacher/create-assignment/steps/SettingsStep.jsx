import React from "react";
import {
  Bot,
  Lock,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";

import ToggleRow from "../shared/ToggleRow";
import IntegrityToggleRow from "../shared/IntegrityToggleRow";

export default function SettingsStep({
  allowAI,
  setAllowAI,

  coachTimeLimitMinutes,
  setCoachTimeLimitMinutes,

  autoBuildOutlineFromCoach,
  setAutoBuildOutlineFromCoach,

  aiFeedback,
  setAiFeedback,

  writingPlayback,
  setWritingPlayback,

  integritySettings,
  updateIntegritySetting,
}) {
  const outlineEnabled = Boolean(allowAI && autoBuildOutlineFromCoach);

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
          Step 3: Student Support & Integrity
        </h3>

        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-500">
          Configure student AI support, coach limits, outline generation, and
          core academic integrity rules before saving the assignment.
        </p>
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <h4 className="font-serif text-sm font-bold text-slate-950">
            Student AI support
          </h4>

          <p className="mt-1 text-xs text-slate-500">
            These settings control what support students can access during the
            writing process.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <ToggleRow
            icon={Bot}
            label="AI ideas coach"
            description="Students can ask the coach for brainstorming and planning support before drafting."
            checked={allowAI}
            onChange={handleCoachToggle}
          />

          <ToggleRow
            icon={ShieldCheck}
            label="AI draft feedback"
            description="Students can request feedback on drafts without receiving a full answer."
            checked={aiFeedback}
            onChange={setAiFeedback}
          />

          <ToggleRow
            icon={PlayCircle}
            label="Writing playback"
            description="Save writing process events for teacher review."
            checked={writingPlayback}
            onChange={setWritingPlayback}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <label className="space-y-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Coach chat time limit
            </span>

            <input
              type="number"
              min="1"
              max="120"
              value={coachTimeLimitMinutes}
              disabled={!allowAI}
              onChange={(event) =>
                setCoachTimeLimitMinutes(Number(event.target.value || 15))
              }
              className={`w-full rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${
                !allowAI ? "cursor-not-allowed opacity-50" : ""
              }`}
            />

            <p className="text-[11px] leading-relaxed text-slate-500">
              Limit how long students can talk to the ideas coach. Example: 15
              minutes.
            </p>
          </label>

          <div
            className={`flex items-start justify-between gap-4 rounded-xl border p-4 ${
              allowAI
                ? "border-slate-200 bg-[#F8FAFC]"
                : "border-slate-100 bg-slate-50 opacity-70"
            }`}
          >
            <div>
              <p className="text-xs font-bold text-slate-900">
                Auto-build outline from coach chat
              </p>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                When the student reaches the draft page, convert the coach chat
                into an editable idea-outline with notes only. No full
                sentences. Requires AI ideas coach.
              </p>
            </div>

            <button
              type="button"
              disabled={!allowAI}
              onClick={() =>
                setAutoBuildOutlineFromCoach(!autoBuildOutlineFromCoach)
              }
              className={`h-5 w-10 shrink-0 rounded-full p-0.5 transition-all ${
                outlineEnabled ? "bg-blue-600" : "bg-slate-300"
              } ${!allowAI ? "cursor-not-allowed" : ""}`}
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
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs leading-relaxed text-amber-800">
              Auto-build outline is disabled because the AI ideas coach is
              disabled.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
            <Lock className="h-4 w-4" />
          </div>

          <div>
            <h4 className="font-serif text-sm font-bold text-slate-950">
              Academic integrity settings
            </h4>

            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              These rules control paste behavior, academic honor confirmation,
              word-count requirements, and submission locking.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <label className="space-y-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Paste policy
            </span>

            <select
              value={integritySettings.pastePolicy}
              onChange={(event) =>
                updateIntegritySetting("pastePolicy", event.target.value)
              }
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            >
              <option value="allow">Allow paste</option>
              <option value="warn">Warn students</option>
              <option value="block">Block paste</option>
            </select>

            <p className="text-[11px] leading-relaxed text-slate-500">
              Decide whether students can paste text into the writing editor.
            </p>
          </label>

          <IntegrityToggleRow
            label="Log paste attempts"
            description="Record paste events for teacher review."
            checked={integritySettings.logPasteAttempts}
            onChange={(value) =>
              updateIntegritySetting("logPasteAttempts", value)
            }
          />

          <IntegrityToggleRow
            label="Require honor confirmation"
            description="Ask students to confirm academic honesty before submission."
            checked={integritySettings.requireHonorConfirmation}
            onChange={(value) =>
              updateIntegritySetting("requireHonorConfirmation", value)
            }
          />

          <IntegrityToggleRow
            label="Enforce word count"
            description="Require submissions to respect the configured word range."
            checked={integritySettings.enforceWordCount}
            onChange={(value) =>
              updateIntegritySetting("enforceWordCount", value)
            }
          />

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-bold text-emerald-900">
              Lock editing after submission
            </p>

            <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
              Always enabled by default. Students cannot edit after submitting.
            </p>

            <span className="mt-3 inline-flex rounded-lg border border-emerald-200 bg-emerald-100 px-2 py-1 font-mono text-[10px] font-bold text-emerald-800">
              Always ON
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}