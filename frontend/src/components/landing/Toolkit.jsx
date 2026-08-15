import { useState } from "react";
import {
  BarChart3,
  Search,
  Sparkles,
  Layers,
  ShieldCheck,
  CheckCircle2,
  PenLine,
  ClipboardCheck,
} from "lucide-react";
import useScrollReveal from "../common/useScrollReveal";

const TABS = [
  {
    key: "timeline",
    icon: BarChart3,
    title: "Process Timeline",
    description:
      "Shows how student writing develops through drafting, revision, pauses, edits, and submission attempts.",
  },
  {
    key: "evidence",
    icon: Search,
    title: "Review Evidence",
    description:
      "Helps instructors understand the writing process through visible activity signals while keeping instructor judgment central.",
  },
  {
    key: "coach",
    icon: Sparkles,
    title: "AI Coach Guidance",
    description:
      "Supports brainstorming, organization, and revision while keeping the student responsible for the final writing.",
  },
];

function TimelineDemo() {
  return (
    <div className="space-y-5">
      <div className="bg-white/8 p-5 rounded-2xl border border-blue-400/20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-blue-100/70 font-mono">
            Student Writing Timeline
          </span>

          <span className="text-[10px] font-mono font-bold text-blue-100 bg-blue-400/15 border border-blue-300/20 px-2 py-1 rounded-lg">
            LIVE
          </span>
        </div>

        <svg
          className="w-full h-20 stroke-current text-blue-300 fill-none"
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
        >
          <path
            className="rhythm-wave-path"
            strokeWidth="3"
            strokeLinecap="round"
            d="M 0,55 Q 25,20 50,52 T 100,50 T 150,28 T 200,76 T 250,48 T 300,84 T 350,18 T 400,50"
          />
        </svg>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs font-mono">
        <div className="bg-white/8 p-3 rounded-xl border border-blue-400/15">
          <span className="text-blue-100/50 block">Current Step</span>
          <span className="font-bold text-white">
            Step 2 · Drafting Canvas
          </span>
        </div>

        <div className="bg-white/8 p-3 rounded-xl border border-blue-400/15">
          <span className="text-blue-100/50 block">Activity Signal</span>
          <span className="font-bold text-blue-200">
            Real Writing Progress
          </span>
        </div>
      </div>
    </div>
  );
}

function EvidenceDemo() {
  return (
    <div className="space-y-5">
      <div className="font-serif text-blue-50 text-base leading-relaxed bg-white/8 p-5 rounded-2xl border border-blue-400/20">
        “Praxis does not judge the student automatically. It helps instructors see
        the process behind the final submission.”

        <span className="bg-blue-400/15 text-blue-100 border border-blue-300/20 px-2 py-1 rounded-lg font-mono text-xs block mt-3 w-fit">
          Process evidence available for review
        </span>
      </div>

      <div className="bg-white/8 p-4 rounded-2xl border border-blue-400/15 text-xs font-mono flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-200" />

          <span className="text-blue-50">
            Drafting profile synced successfully
          </span>
        </div>

        <span className="text-blue-100/50">Autosave Active</span>
      </div>
    </div>
  );
}

function CoachDemo() {
  return (
    <div className="space-y-4">
      <div className="bg-white/8 p-5 rounded-2xl border border-blue-400/20 space-y-3">
        <div className="text-xs text-blue-100/60 font-mono border-b border-blue-400/15 pb-2">
          Step 1 · Ideas Chat
        </div>

        <p className="font-serif text-sm sm:text-base text-blue-50 leading-relaxed italic">
          “I need help organizing my ideas before starting the essay.”
        </p>
      </div>

      <div className="bg-blue-400/10 border border-blue-300/20 p-4 rounded-2xl flex gap-3">
        <Sparkles className="w-5 h-5 text-blue-200 shrink-0 mt-0.5" />

        <div>
          <div className="text-xs font-mono text-blue-200 font-bold">
            AI Coach Response
          </div>

          <p className="text-xs sm:text-sm text-blue-50/85 mt-1 leading-relaxed">
            Start by reading the assignment brief. What main point do you want
            your instructor to understand from your final draft?
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Toolkit() {
  const [activeTab, setActiveTab] = useState("timeline");
  const { ref, revealed } = useScrollReveal();

  return (
    <section
      id="toolkit"
      ref={ref}
      className={`relative overflow-hidden py-14 lg:py-16 bg-[#F8FAFC] border-y border-slate-200 reveal-3d ${
        revealed ? "revealed-active" : ""
      }`}
    >
      <style>{`
        .toolkit-grid {
          background-image:
            linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        .toolkit-blue-dot {
          background-color: #3b82f6;
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.45);
        }
      `}</style>

      <div className="absolute inset-0 toolkit-grid opacity-80 pointer-events-none" />
      <div className="absolute -top-32 left-1/3 w-[520px] h-[520px] rounded-full bg-blue-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 right-0 w-[420px] h-[420px] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="max-w-3xl mx-auto text-center mb-9">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            <Layers className="w-3.5 h-3.5" />
            Platform toolkit
          </span>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Responsible AI-supported writing tools.
          </h2>

          <p className="text-sm sm:text-base text-slate-600 mt-3 leading-relaxed max-w-2xl mx-auto">
            Explore the core tools that connect student writing, AI guidance,
            process visibility, and instructor review inside Praxis.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col gap-3">
            {TABS.map(({ key, icon: Icon, title, description }) => {
              const isActive = activeTab === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveTab(key)}
                  className={`group p-4 rounded-2xl text-left border transition-all w-full ${
                    isActive
                      ? "bg-white border-blue-200 shadow-lg shadow-blue-100/60"
                      : "bg-white/80 border-slate-200 hover:border-blue-200 hover:bg-white hover:shadow-md"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white shadow-md shadow-blue-600/20"
                          : "bg-blue-50 text-blue-700 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-black text-slate-950 text-lg">
                          {title}
                        </span>

                        {isActive && (
                          <span className="text-[9px] font-mono font-bold uppercase text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="text-xs sm:text-sm text-slate-600 mt-1.5 leading-relaxed font-sans">
                        {description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-7 bg-gradient-to-br from-blue-950 via-slate-950 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 flex flex-col justify-between border border-blue-900/50 relative overflow-hidden shadow-2xl min-h-[330px]">
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-400/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex items-center justify-between border-b border-blue-400/15 pb-4 mb-5 select-none">
              <span className="text-xs font-mono text-blue-100/70 uppercase tracking-widest flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-200" />
                {activeTab === "timeline" && "Process Timeline"}
                {activeTab === "evidence" && "Review Evidence"}
                {activeTab === "coach" && "AI Coach Guidance"}
              </span>

              <span className="hidden sm:inline-flex text-[10px] font-mono bg-blue-400/10 text-blue-100 border border-blue-300/20 px-2.5 py-1 rounded font-bold">
                Instructor Judgment Stays Central
              </span>
            </div>

            <div className="relative z-10 flex-grow flex flex-col justify-center">
              {activeTab === "timeline" && <TimelineDemo />}
              {activeTab === "evidence" && <EvidenceDemo />}
              {activeTab === "coach" && <CoachDemo />}
            </div>

            <div className="relative z-10 border-t border-blue-400/15 pt-4 mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] font-mono text-blue-100/55 select-none">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                Responsible review workflow
              </span>

              <span>Praxis · AUI Writing Platform</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <ToolkitMiniCard
            icon={PenLine}
            title="Student drafting"
            text="Students write inside the platform through structured steps."
          />

          <ToolkitMiniCard
            icon={ClipboardCheck}
            title="Instructors review"
            text="Instructors grade, annotate, and manage resubmissions."
          />

          <ToolkitMiniCard
            icon={ShieldCheck}
            title="Process visibility"
            text="Signals support conversations, not automatic verdicts."
          />
        </div>

        <div className="mt-5 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-950 to-indigo-950 border border-blue-900/50 px-5 py-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-serif italic text-blue-100/70">
          <FooterSignal text="Reflect on evolution" />
          <FooterSignal text="AI coach as support" />
          <FooterSignal text="Instructor judgment central" />
        </div>
      </div>
    </section>
  );
}

function ToolkitMiniCard({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-4 flex gap-3 hover:border-blue-200 hover:bg-white hover:shadow-md transition-all">
      <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <h4 className="text-sm font-bold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function FooterSignal({ text }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-2 h-2 rounded-full toolkit-blue-dot" />
      <span>{text}</span>
    </div>
  );
}
