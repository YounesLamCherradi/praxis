import useScrollReveal from "../common/useScrollReveal";
import {
  Brain,
  CheckCircle2,
  MessageSquare,
  PenLine,
  ShieldCheck,
} from "lucide-react";

export default function Philosophy() {
  const { ref, revealed } = useScrollReveal();

  return (
    <section
      id="why"
      ref={ref}
      className={`relative overflow-hidden py-16 lg:py-20 bg-slate-950 text-white reveal-3d ${
        revealed ? "revealed-active" : ""
      }`}
    >
      <style>{`
        @keyframes philosophyFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }

        @keyframes philosophyPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        .philosophy-grid {
          background-image:
            linear-gradient(to right, rgba(59, 130, 246, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.12) 1px, transparent 1px);
          background-size: 4rem 4rem;
        }

        .philosophy-float {
          animation: philosophyFloat 5s ease-in-out infinite;
        }

        .philosophy-pulse {
          animation: philosophyPulse 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950 to-blue-950" />
      <div className="absolute inset-0 philosophy-grid opacity-20 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,#000_60%,transparent_100%)]" />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[760px] h-[420px] bg-blue-500/15 rounded-full blur-[140px] pointer-events-none philosophy-pulse" />
      <div className="absolute bottom-0 right-0 w-[520px] h-[320px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              The Praxis writing philosophy
            </span>

            <blockquote className="text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
              “A perfect text with no visible process is harder to trust than
              an honest draft that shows thinking, revision, and growth.”
            </blockquote>

            <div className="w-16 h-0.5 bg-blue-400 mx-auto lg:mx-0" />

            <div className="space-y-2">
              <p className="text-base font-semibold text-blue-50 sm:text-lg">
                Praxis values the writing process, not only the final answer.
              </p>

              <p className="text-sm text-slate-400 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Students can use AI as support, but they still need to make
                choices, explain their reasoning, revise their work, and own
                the final submission. Instructors use process visibility to guide
                fair conversations, not automatic verdicts.
              </p>
            </div>
          </div>

          <div className="philosophy-float">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4">
              <PhilosophyPoint
                icon={PenLine}
                title="Messy drafting is normal"
                text="Thinking, deleting, rewriting, and changing direction are part of real writing."
              />

              <PhilosophyPoint
                icon={Brain}
                title="AI is support, not replacement"
                text="Students can receive guidance, but their ideas and decisions must remain visible."
              />

              <PhilosophyPoint
                icon={MessageSquare}
                title="Reflection matters"
                text="Explaining why you accepted, rejected, or changed AI suggestions is part of learning."
              />

              <PhilosophyPoint
                icon={CheckCircle2}
                title="Instructor judgment stays central"
                text="Process signals support review conversations, but the instructor remains the decision-maker."
              />
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5 grid md:grid-cols-3 gap-4">
          <MiniPrinciple
            title="Your voice counts"
            text="The student’s reasoning and choices remain part of the grade."
          />

          <MiniPrinciple
            title="Process protects effort"
            text="A visible timeline helps show real engagement with the task."
          />

          <MiniPrinciple
            title="AI use becomes teachable"
            text="The goal is better academic writing, not hidden shortcuts."
          />
        </div>
      </div>
    </section>
  );
}

function PhilosophyPoint({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 flex gap-3 hover:border-blue-400/30 hover:bg-slate-900 transition-all">
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-400/20 text-blue-300 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <h4 className="text-sm font-bold text-white">{title}</h4>

        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}

function MiniPrinciple({ title, text }) {
  return (
    <div className="rounded-2xl border border-blue-400/20 bg-slate-950/40 p-4">
      <h4 className="text-sm font-bold text-blue-100">{title}</h4>

      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
        {text}
      </p>
    </div>
  );
}
