import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  FileText,
  Highlighter,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export default function WhatWeOffer() {
  const containerRef = useRef(null);

  const [scrollEffect, setScrollEffect] = useState({
    rotateX: 0,
    translateY: 0,
    scale: 1,
    opacity: 1,
  });

  useEffect(() => {
    const handleScroll3D = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const elementCenter = rect.top + rect.height / 2;
      const viewportCenter = windowHeight / 2;

      const distance = elementCenter - viewportCenter;
      const maxDistance = windowHeight * 0.9;
      const factor = Math.max(-1, Math.min(1, distance / maxDistance));

      setScrollEffect({
        rotateX: factor * 8,
        translateY: Math.abs(factor) * 14,
        scale: 1 - Math.abs(factor) * 0.025,
        opacity: Math.max(0.82, 1 - Math.abs(factor) * 0.18),
      });
    };

    window.addEventListener("scroll", handleScroll3D);
    handleScroll3D();

    return () => window.removeEventListener("scroll", handleScroll3D);
  }, []);

  const offers = [
    {
      badge: "Student Workspace",
      title: "Guided Writing Flow",
      desc: "Students move through ideas, drafting, feedback, and final submission while keeping ownership of their work.",
      gradient: "from-blue-500 to-sky-500",
      icon: PenLine,
      points: ["Ideas and planning", "Drafting and revision", "Saved writing progress"],
    },
    {
      badge: "Instructor Workspace",
      title: "Review & Feedback Tools",
      desc: "Instructors manage courses, assignments, submissions, rubrics, annotations, grading, and resubmission paths.",
      gradient: "from-indigo-500 to-blue-600",
      icon: ClipboardCheck,
      points: ["Rubric scoring", "Text annotations", "Drafts and submissions"],
    },
    {
      badge: "Responsible AI",
      title: "Process View",
      desc: "Praxis supports fair review conversations by showing drafts, submissions, revision activity, and writing progress without replacing instructor judgment.",
      gradient: "from-sky-500 to-indigo-600",
      icon: ShieldCheck,
      points: ["Writing process view", "Responsible AI boundaries", "Instructor judgment"],
    },
  ];

  return (
    <section
      ref={containerRef}
      id="toolkit"
      className="relative overflow-hidden bg-slate-950 py-12 sm:py-16 lg:py-20"
      style={{ perspective: "1200px" }}
    >
      <style>{`
        @keyframes offerGlow {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        @keyframes offerSlide {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .offer-slide {
          animation: offerSlide 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .offer-grid {
          background-image:
            linear-gradient(to right, rgba(59, 130, 246, 0.12) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.12) 1px, transparent 1px);
          background-size: 4rem 4rem;
        }

        .offer-glow {
          animation: offerGlow 3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 offer-grid opacity-20 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_45%,#000_60%,transparent_100%)]" />

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[420px] bg-blue-500/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[520px] h-[360px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="offer-slide mx-auto mb-8 max-w-3xl text-center sm:mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-blue-300">
            <Sparkles className="w-3.5 h-3.5" />
            Key features
          </span>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:mt-4 sm:text-5xl">
            What Praxis offers
          </h2>

          <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
            Praxis brings the full academic writing workflow into one platform:
            guided student writing, instructor review tools, and a clear view of
            the writing process.
          </p>
        </div>

        <div
          className="transition-all duration-300 ease-out will-change-transform"
          style={{
            transform: `rotateX(${scrollEffect.rotateX}deg) translateY(${scrollEffect.translateY}px) scale(${scrollEffect.scale})`,
            opacity: scrollEffect.opacity,
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-3 lg:gap-6">
            {offers.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="group relative overflow-hidden rounded-[18px] border border-slate-800 bg-slate-900/70 p-4 shadow-md backdrop-blur-md transition-all duration-300 hover:border-blue-400/40 sm:rounded-[28px] sm:p-6 sm:shadow-xl sm:hover:-translate-y-1 sm:hover:shadow-[0_24px_70px_rgba(37,99,235,0.12)]"
                >
                  <div
                    className={`absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl ${item.gradient} opacity-0 group-hover:opacity-[0.14] blur-3xl transition-opacity duration-500 pointer-events-none`}
                  />

                  <div className="relative z-10 flex items-center justify-between mb-5">
                    <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-blue-300 bg-blue-500/10 border border-blue-400/20 px-2.5 py-1 rounded-lg">
                      {item.badge}
                    </span>

                    <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-blue-300 group-hover:bg-white group-hover:text-blue-600 group-hover:border-white transition-all duration-300 offer-glow">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-blue-300 transition-colors duration-200">
                      {item.title}
                    </h3>

                    <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>

                    <div className="mt-5 space-y-2.5">
                      {item.points.map((point) => (
                        <div
                          key={point}
                          className="flex items-center gap-2 text-xs text-slate-300"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <span>{point}</span>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-end text-xs font-mono">
                      <div className="flex items-center gap-1.5 text-blue-300 font-bold opacity-75 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                        Explore
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
          <MiniCapability
            icon={BookOpen}
            title="Course-to-assignment flow"
            text="Instructors organize courses, assignments, and student access codes."
          />

          <MiniCapability
            icon={Highlighter}
            title="Annotated feedback"
            text="Students receive comments, correction codes, grades, and next steps."
          />

          <MiniCapability
            icon={FileText}
            title="Clear submission history"
            text="Drafts, submissions, and review progress remain visible throughout the writing workflow."
          />
        </div>
      </div>
    </section>
  );
}

function MiniCapability({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 flex gap-3">
      <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-400/20 text-blue-300 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5" />
      </div>

      <div>
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
