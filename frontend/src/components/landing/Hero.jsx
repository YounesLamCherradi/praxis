import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  Highlighter,
  MessageSquare,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

export default function Hero() {
  const navigate = useNavigate();

  const handleScrollToSection = (id) => {
    const targetElement = document.getElementById(id);

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header className="relative pt-36 pb-12 lg:pt-40 lg:pb-14 overflow-hidden bg-[#F8FAFC]">
      <style>{`
        @keyframes heroReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }

        @keyframes heroPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        @keyframes heroLine {
          0% { width: 0%; opacity: 0.5; }
          50% { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0.55; }
        }

        .hero-grid {
          background-image:
            linear-gradient(to right, rgba(37, 99, 235, 0.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        .hero-reveal {
          animation: heroReveal 0.55s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .hero-float {
          animation: heroFloat 5.5s ease-in-out infinite;
        }

        .hero-pulse {
          animation: heroPulse 2.4s ease-in-out infinite;
        }

        .hero-line {
          animation: heroLine 2.4s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 hero-grid opacity-80" />
      <div className="absolute -top-40 left-1/4 w-[560px] h-[560px] rounded-full bg-blue-500/15 blur-[130px] pointer-events-none" />
      <div className="absolute top-28 -right-24 w-[480px] h-[480px] rounded-full bg-indigo-500/15 blur-[120px] pointer-events-none" />

      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-10 relative z-10">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-6 space-y-6 text-left hero-reveal">
            <div className="inline-flex items-center gap-3 bg-white/85 backdrop-blur border border-blue-100 px-4 py-2 rounded-2xl shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src="/praxis-logo.png"
                  alt="Praxis logo"
                  className="w-6 h-6 object-contain"
                />
              </div>

              <span className="text-lg font-bold tracking-tight leading-none">
                <span className="text-blue-600">p</span>
                <span className="text-slate-900">raxis</span>
              </span>

              <span className="hidden sm:inline-flex text-[10px] font-mono font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-2.5 py-1 rounded-lg">
                AUI Writing Platform
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="font-serif text-slate-950 text-4xl sm:text-5xl lg:text-[4.25rem] leading-[0.98] tracking-tight font-black">
                Responsible AI writing support for the{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
                  academic process
                </span>
                .
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl font-sans">
                Praxis helps students plan, draft, revise, and submit their
                assignments through a guided writing workflow. Instructors get
                course management, submissions, rubrics, annotations, feedback,
                and process visibility.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm px-7 py-3.5 rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 transition-all hover:translate-y-[-1px] active:translate-y-0 cursor-pointer"
              >
                Get Started
                <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => handleScrollToSection("platform-view")}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 font-bold text-sm px-7 py-3.5 rounded-2xl shadow-sm hover:border-blue-200 hover:text-blue-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                Explore Platform
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <HeroFeature
                icon={PenLine}
                title="Writing"
                text="Drafting steps"
              />

              <HeroFeature
                icon={GraduationCap}
                title="Review"
                text="Instructor feedback"
              />

              <HeroFeature
                icon={ShieldCheck}
                title="AI Use"
                text="Responsible support"
              />
            </div>
          </div>

          <div className="lg:col-span-6 hero-reveal [animation-delay:120ms]">
            <div className="relative">
              <div className="absolute -top-5 -right-5 w-28 h-28 rounded-3xl bg-blue-500/15 blur-2xl" />
              <div className="absolute -bottom-5 -left-5 w-28 h-28 rounded-3xl bg-indigo-500/15 blur-2xl" />

              <div className="relative bg-white border border-slate-200 rounded-[1.8rem] shadow-2xl overflow-hidden hero-float">
                <div className="bg-slate-950 text-slate-400 px-5 py-3 flex items-center justify-between border-b border-slate-800 select-none">
                  <div className="flex items-center gap-2">
  <span className="w-2.5 h-2.5 rounded-full bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.45)]" />
  <span className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.45)]" />
  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.45)]" />

  <span className="text-[10px] font-mono text-blue-100/45 ml-2">
    praxis_live_workspace
  </span>
</div>

                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400 hero-pulse" />
                    <span className="text-[10px] font-mono text-blue-300 font-bold tracking-wider">
                      LIVE
                    </span>
                  </div>
                </div>

                <div className="bg-white border-b border-slate-100 px-5 py-3 flex flex-wrap gap-3 items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
                      <img
                        src="/praxis-logo.png"
                        alt="Praxis logo"
                        className="w-7 h-7 object-contain"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Praxis Workspace
                      </p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        Student + Instructor workflow
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-full font-bold">
                      AI Coach
                    </span>

                    <span className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full font-bold">
                      Autosave
                    </span>
                  </div>
                </div>

                <div className="p-5 bg-[#F8FAFC]">
                  <div className="grid sm:grid-cols-3 gap-3 mb-3">
                    <DashboardStat
                      icon={BookOpen}
                      label="Courses"
                      value="04"
                      tone="blue"
                    />

                    <DashboardStat
                      icon={ClipboardCheck}
                      label="Assignments"
                      value="12"
                      tone="indigo"
                    />

                    <DashboardStat
                      icon={Users}
                      label="Students"
                      value="86"
                      tone="sky"
                    />
                  </div>

                  <div className="grid lg:grid-cols-[1fr_1.15fr] gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">
                          Student Workflow
                        </h3>

                        <Sparkles className="w-4 h-4 text-blue-500" />
                      </div>

                      <ProcessRow
                        icon={MessageSquare}
                        title="Ideas Chat"
                        status="Ready"
                      />

                      <ProcessRow
                        icon={PenLine}
                        title="Drafting Canvas"
                        status="Active"
                        active
                      />

                      <ProcessRow
                        icon={FileText}
                        title="Final Submit"
                        status="Next"
                      />
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-slate-950 text-white p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold">
                          Instructor Review
                        </h3>

                        <span className="text-[10px] font-mono text-blue-300 font-bold">
                          READY
                        </span>
                      </div>

                      <ReviewSignal
                        icon={Highlighter}
                        title="Annotations"
                        text="Text comments and correction codes."
                      />

                      <ReviewSignal
                        icon={ClipboardCheck}
                        title="Rubric Score"
                        text="Criteria-based grading workflow."
                      />

                      <ReviewSignal
                        icon={ShieldCheck}
                        title="Process Evidence"
                        text="Supports fair review conversations."
                      />
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50/80 p-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-xs font-bold text-slate-900">
                            Process timeline syncing
                          </h4>

                          <span className="text-[10px] font-mono font-bold text-blue-700">
                            100%
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          Writing, AI guidance, instructor feedback, and review
                          evidence stay connected.
                        </p>

                        <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full hero-line" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <FloatingBadge
                position="right"
                label="Autosave"
                value="Enabled"
              />

              <FloatingBadge
                position="left"
                label="Review"
                value="Ready"
              />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroFeature({ icon: Icon, title, text }) {
  return (
    <div className="bg-white/85 backdrop-blur border border-slate-200 rounded-2xl p-3.5 hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all">
      <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-2">
        <Icon className="w-4 h-4" />
      </div>

      <h3 className="text-xs font-bold text-slate-900">{title}</h3>

      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
        {text}
      </p>
    </div>
  );
}

function DashboardStat({ icon: Icon, label, value, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    sky: "bg-sky-50 text-sky-600 border-sky-100",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div
        className={`w-8 h-8 rounded-xl border flex items-center justify-center mb-2 ${
          tones[tone] || tones.blue
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>

      <p className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="text-xl font-serif font-black text-slate-900 mt-0.5">
        {value}
      </p>
    </div>
  );
}

function ProcessRow({ icon: Icon, title, status, active }) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${
        active
          ? "bg-blue-50/70 border-blue-200 shadow-sm"
          : "bg-slate-50 border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
            active
              ? "bg-white text-blue-600 border border-blue-100"
              : "bg-white text-slate-500 border border-slate-200"
          }`}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>

        <span className="text-xs font-bold text-slate-800 truncate">
          {title}
        </span>
      </div>

      <span
        className={`text-[8px] font-mono font-bold uppercase px-2 py-1 rounded ${
          active
            ? "bg-blue-600 text-white"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {status}
      </span>
    </div>
  );
}

function ReviewSignal({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5">
      <div className="flex gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-400/20 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5" />
        </div>

        <div>
          <h4 className="text-xs font-bold text-white">{title}</h4>

          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function FloatingBadge({ position, label, value }) {
  const positionClass =
    position === "right"
      ? "-right-3 top-20"
      : "-left-3 bottom-20";

  return (
    <div
      className={`absolute ${positionClass} hidden xl:block bg-white border border-slate-200 shadow-xl rounded-2xl px-3.5 py-2.5`}
    >
      <p className="text-[9px] font-mono font-bold uppercase text-slate-400">
        {label}
      </p>

      <p className="text-xs font-bold text-blue-600">{value}</p>
    </div>
  );
}