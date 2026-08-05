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
    <header className="relative overflow-hidden bg-[#F8FAFC] pb-12 pt-36 lg:pb-14 lg:pt-40">
      <style>{`
        @keyframes heroReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
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
      `}</style>

      <div className="hero-grid absolute inset-0 opacity-80" />
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[560px] w-[560px] rounded-full bg-blue-500/15 blur-[130px]" />
      <div className="pointer-events-none absolute -right-24 top-28 h-[480px] w-[480px] rounded-full bg-indigo-500/15 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="hero-reveal space-y-6 text-left lg:col-span-6">
            <div className="inline-flex items-center gap-3 rounded-2xl border border-blue-100 bg-white/85 px-4 py-2 shadow-sm backdrop-blur">
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <img
                  src="/praxis-logo.png"
                  alt="Praxis logo"
                  width="256"
                  height="256"
                  className="h-6 w-6 object-contain"
                />
              </div>

              <span className="text-lg font-bold leading-none tracking-tight">
                <span className="text-slate-900">pr</span>
                <span className="text-blue-600">a</span>
                <span className="text-slate-900">x</span>
                <span className="text-blue-600">i</span>
                <span className="text-slate-900">s</span>
              </span>

              <span className="hidden rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-blue-700 sm:inline-flex">
                AUI Writing Platform
              </span>
            </div>

            <div className="space-y-4">
              <h1 className="font-serif text-4xl font-black leading-[0.98] tracking-tight text-slate-950 sm:text-5xl lg:text-[4.25rem]">
                Responsible AI writing support for the{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
                  academic process
                </span>
                .
              </h1>

              <p className="max-w-2xl font-sans text-base leading-relaxed text-slate-600 sm:text-lg">
                Praxis helps students plan, draft, revise, and submit their
                assignments through a guided writing workflow. Instructors get
                course management, submissions, rubrics, annotations, feedback,
                and a clear process view.
              </p>
            </div>

            <div className="flex flex-col items-stretch gap-3 pt-1 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => navigate("/signup")}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-px hover:bg-blue-700 active:translate-y-0"
              >
                Get Started
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </button>

              <button
                type="button"
                onClick={() => handleScrollToSection("platform-view")}
                className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-7 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-slate-50 hover:text-blue-700"
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

          <div className="hero-reveal [animation-delay:120ms] lg:col-span-6">
            <div className="relative">
              <div className="absolute -right-5 -top-5 h-28 w-28 rounded-3xl bg-blue-500/15 blur-2xl" />
              <div className="absolute -bottom-5 -left-5 h-28 w-28 rounded-3xl bg-indigo-500/15 blur-2xl" />

              <div className="hero-float relative overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                  <div className="flex items-center gap-3 text-slate-700">
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <img
                        src="/praxis-logo.png"
                        alt="Praxis logo"
                        width="256"
                        height="256"
                        className="h-7 w-7 object-contain"
                      />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Praxis Writing Workspace
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Student writing and instructor review
                      </p>
                    </div>
                  </div>

                  <span className="hidden rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 sm:inline-flex">
                    Guided writing
                  </span>
                </div>

                <div className="bg-[#F8FAFC] p-5">
                  <div className="mb-3 grid gap-3 sm:grid-cols-3">
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

                  <div className="grid gap-3 lg:grid-cols-[1fr_1.15fr]">
                    <div className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">
                          Student Writing
                        </h3>

                        <Sparkles className="h-4 w-4 text-blue-500" />
                      </div>

                      <ProcessRow
                        icon={MessageSquare}
                        title="Ideas and Planning"
                      />

                      <ProcessRow
                        icon={PenLine}
                        title="Drafting and Revision"
                        emphasized
                      />

                      <ProcessRow
                        icon={FileText}
                        title="Final Submission"
                      />
                    </div>

                    <div className="space-y-2.5 rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white">
                      <h3 className="text-sm font-bold">Instructor Review</h3>

                      <ReviewSignal
                        icon={Highlighter}
                        title="Annotations"
                        text="Text comments and correction codes."
                      />

                      <ReviewSignal
                        icon={ClipboardCheck}
                        title="Rubric Grading"
                        text="Criteria-based grading and feedback."
                      />

                      <ReviewSignal
                        icon={ShieldCheck}
                        title="Process View"
                        text="Drafts, submissions, and revision activity support fair review conversations."
                      />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:grid-cols-3">
                    <WorkspacePrinciple
                      title="Plan"
                      text="Develop ideas before drafting."
                    />

                    <WorkspacePrinciple
                      title="Revise"
                      text="Use feedback to improve the work."
                    />

                    <WorkspacePrinciple
                      title="Review"
                      text="Receive clear instructor guidance."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroFeature({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-3.5 backdrop-blur transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </div>

      <h3 className="text-xs font-bold text-slate-900">{title}</h3>

      <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
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
        className={`mb-2 flex h-8 w-8 items-center justify-center rounded-xl border ${
          tones[tone] || tones.blue
        }`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-0.5 font-serif text-xl font-black text-slate-900">
        {value}
      </p>
    </div>
  );
}

function ProcessRow({ icon: Icon, title, emphasized = false }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
        emphasized
          ? "border-blue-200 bg-blue-50/70 shadow-sm"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border bg-white ${
          emphasized
            ? "border-blue-100 text-blue-600"
            : "border-slate-200 text-slate-500"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <span className="truncate text-xs font-bold text-slate-800">
        {title}
      </span>
    </div>
  );
}

function ReviewSignal({ icon: Icon, title, text }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-2.5">
      <div className="flex gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-blue-400/20 bg-blue-500/10 text-blue-300">
          <Icon className="h-3.5 w-3.5" />
        </div>

        <div>
          <h4 className="text-xs font-bold text-white">{title}</h4>

          <p className="mt-0.5 text-[10px] leading-relaxed text-slate-400">
            {text}
          </p>
        </div>
      </div>
    </div>
  );
}

function WorkspacePrinciple({ title, text }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
        {title}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
        {text}
      </p>
    </div>
  );
}
