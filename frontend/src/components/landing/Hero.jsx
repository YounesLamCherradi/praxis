import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  MessageSquare,
  PenLine,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";

const COACH_MESSAGES = [
  {
    role: "student",
    text: "I know my topic, but I am not sure how to organize the essay.",
  },
  {
    role: "coach",
    text: "What is the main idea you want your reader to understand first?",
  },
  {
    role: "student",
    text: "That planning first makes the process easier and clearer.",
  },
  {
    role: "coach",
    text: "Good. What two or three stages could help you explain that idea in order?",
  },
];

export default function Hero() {
  const [visibleMessages, setVisibleMessages] = useState(
    COACH_MESSAGES.length
  );
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;

    if (visibleMessages >= COACH_MESSAGES.length) {
      setPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleMessages((value) =>
        Math.min(COACH_MESSAGES.length, value + 1)
      );
    }, 850);

    return () => window.clearTimeout(timer);
  }, [playing, visibleMessages]);

  function openRole(role) {
    window.dispatchEvent(
      new CustomEvent("praxis-landing-role", {
        detail: role,
      })
    );

    document
      .getElementById("role-journey")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function replayCoach() {
    setVisibleMessages(1);
    setPlaying(true);
  }

  return (
    <header className="relative overflow-hidden bg-[#F8FAFC] pb-10 pt-24 sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-40">
      <style>{`
        @keyframes heroReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes heroFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        .hero-grid {
          background-image:
            linear-gradient(to right, rgba(37,99,235,.045) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37,99,235,.045) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        .hero-reveal {
          animation: heroReveal .55s cubic-bezier(.16,1,.3,1) both;
        }

        .hero-float {
          animation: heroFloat 5.5s ease-in-out infinite;
        }
      `}</style>

      <div className="hero-grid absolute inset-0 opacity-80" />

      <div className="pointer-events-none absolute -top-40 left-1/4 h-[560px] w-[560px] rounded-full bg-blue-500/15 blur-[130px]" />

      <div className="pointer-events-none absolute -right-24 top-28 h-[480px] w-[480px] rounded-full bg-indigo-500/15 blur-[120px]" />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="grid items-center gap-8 sm:gap-10 lg:grid-cols-12 lg:gap-14">

          <div className="hero-reveal space-y-5 sm:space-y-6 text-left lg:col-span-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-blue-700 shadow-sm backdrop-blur sm:gap-2 sm:px-3.5 sm:py-2 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Guided writing for language classes
            </div>

            <div className="space-y-5">
              <h1 className="text-[2.2rem] font-extrabold leading-[1.06] tracking-tight text-slate-950 sm:text-5xl sm:leading-[1.04] lg:text-[4.25rem]">
                A writing space for{" "}
                <span className="text-blue-600">
                  language classes
                </span>
                .
              </h1>

              <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-lg sm:leading-relaxed">
                Praxis guides students from planning to reflection while
                giving instructors a clear space to respond. AI asks
                questions, points to revision opportunities, and leaves
                the writing to the student.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <button
                type="button"
                onClick={() => openRole("student")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-blue-600/20 transition-all hover:bg-blue-700 sm:w-auto sm:rounded-2xl sm:px-6 sm:py-3.5 sm:shadow-lg"
              >
                <User className="h-4 w-4" />
                I'm a student
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => openRole("instructor")}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 sm:w-auto sm:rounded-2xl sm:px-6 sm:py-3.5"
              >
                <GraduationCap className="h-4 w-4" />
                I'm an instructor
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 sm:gap-3">
              <HeroFeature
                title="Plan"
                text="Develop ideas first"
                icon={MessageSquare}
              />

              <HeroFeature
                title="Revise"
                text="Act on feedback"
                icon={PenLine}
              />

              <HeroFeature
                title="Reflect"
                text="Explain your choices"
                icon={CheckCircle2}
              />
            </div>
          </div>

          <div className="hero-reveal [animation-delay:120ms] lg:col-span-6">
            <div className="relative">
              <div className="absolute -right-5 -top-5 h-28 w-28 rounded-3xl bg-blue-500/15 blur-2xl" />
              <div className="absolute -bottom-5 -left-5 h-28 w-28 rounded-3xl bg-indigo-500/15 blur-2xl" />

              <div className="hero-float relative overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-lg sm:rounded-[1.8rem] sm:shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
                      <Sparkles className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Praxis Coach
                      </p>

                      <p className="text-[11px] text-slate-400">
                        Recorded planning example
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={replayCoach}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        playing ? "animate-spin" : ""
                      }`}
                    />
                    Replay
                  </button>
                </div>

                <div className="min-h-0 bg-[#F8FAFC] p-4 sm:min-h-[420px] sm:p-5">
                  <div className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      The idea
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      AI helps the student think through the assignment.
                      It does not produce the paper.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {COACH_MESSAGES.slice(
                      0,
                      visibleMessages
                    ).map((message, index) => {
                      const isCoach =
                        message.role === "coach";

                      return (
                        <div
                          key={index}
                          className={`flex ${
                            isCoach
                              ? "justify-start"
                              : "justify-end"
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                              isCoach
                                ? "rounded-tl-md border border-slate-200 bg-white text-slate-700"
                                : "rounded-tr-md bg-blue-600 text-white"
                            }`}
                          >
                            {isCoach && (
                              <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-blue-600">
                                <Sparkles className="h-3 w-3" />
                                Coach
                              </div>
                            )}

                            {message.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[11px] text-slate-500">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                    The student remains responsible for the ideas and final writing.
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

function HeroFeature({
  icon: Icon,
  title,
  text,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/85 p-2.5 backdrop-blur transition hover:-translate-y-0.5 hover:shadow-md sm:p-3.5">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </div>

      <h3 className="text-xs font-bold text-slate-900">
        {title}
      </h3>

      <p className="mt-0.5 text-[11px] text-slate-500">
        {text}
      </p>
    </div>
  );
}
