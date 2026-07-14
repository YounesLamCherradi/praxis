import React, { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  FileText,
  GraduationCap,
  Highlighter,
  Layers,
  Lock,
  MessageSquare,
  PenLine,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";

const workflowSteps = [
  {
    title: "Course Setup",
    text: "Courses, assignments, rubrics, and access codes.",
    icon: Layers,
  },
  {
    title: "Guided Writing",
    text: "Students move through ideas, draft, feedback, and final submission.",
    icon: PenLine,
  },
  {
    title: "Process Evidence",
    text: "Attempts, revisions, activity, and review signals stay visible.",
    icon: Activity,
  },
  {
    title: "Instructor Review",
    text: "Instructors annotate, grade, reopen, and send feedback.",
    icon: ClipboardCheck,
  },
];

const teacherFeatures = [
  {
    title: "Course Control",
    text: "Create, publish, edit, and manage course capacity.",
    icon: Layers,
  },
  {
    title: "Assignments",
    text: "Organize assignments by course, status, and submissions.",
    icon: BookOpen,
  },
  {
    title: "Review",
    text: "Review attempts, grade drafts, and reopen work.",
    icon: ClipboardCheck,
  },
  {
    title: "Rubrics",
    text: "Annotate text and score with clear criteria.",
    icon: Highlighter,
  },
];

const studentFeatures = [
  {
    title: "Join Course",
    text: "Students enter a course code to access their assignments.",
    icon: Users,
  },
  {
    title: "Writing Steps",
    text: "Ideas, drafting, feedback, and final submission.",
    icon: PenLine,
  },
  {
    title: "AI Support",
    text: "AI supports brainstorming and revision responsibly.",
    icon: Sparkles,
  },
  {
    title: "Feedback",
    text: "Students receive grades, comments, and annotations.",
    icon: MessageSquare,
  },
];

export default function PlatformDemo() {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % workflowSteps.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, []);

  const ActiveIcon = workflowSteps[activeStep].icon;

  return (
    <section
      id="platform-view"
      className="relative overflow-hidden py-10 lg:py-12 bg-[#F8FAFC] border-y border-slate-200"
    >
      <style>{`
        @keyframes praxisPulse {
          0%, 100% { opacity: 0.65; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }

        @keyframes praxisSlide {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes praxisLine {
          0% { width: 0%; opacity: 0.45; }
          50% { width: 100%; opacity: 1; }
          100% { width: 100%; opacity: 0.55; }
        }

        .praxis-grid {
          background-image:
            linear-gradient(to right, rgba(37, 99, 235, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.04) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        .praxis-pulse {
          animation: praxisPulse 2.3s ease-in-out infinite;
        }

        .praxis-slide {
          animation: praxisSlide 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .praxis-line {
          animation: praxisLine 2.3s ease-in-out infinite;
        }
      `}</style>

      <div className="absolute inset-0 praxis-grid opacity-80" />
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full bg-indigo-500/12 blur-3xl" />

      <div className="relative max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10">
        <div className="max-w-4xl mx-auto text-center mb-7 praxis-slide">
          <span className="inline-flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest text-blue-700 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            Platform Experience
          </span>

          <h2 className="font-serif text-3xl sm:text-4xl text-slate-950 font-black tracking-tight mt-3">
            Writing, review, and responsible AI in one workspace.
          </h2>

          <p className="text-slate-600 mt-3 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            Praxis connects student writing with instructor review: course setup,
            guided drafting, process visibility, annotations, grading, and
            feedback.
          </p>
        </div>

        <div className="grid lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-4 praxis-slide">
            <div className="h-full bg-slate-950 text-white rounded-3xl border border-slate-800 shadow-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-blue-300">
                    Live Platform Flow
                  </p>

                  <h3 className="font-serif text-xl font-black mt-1">
                    Praxis Workflow
                  </h3>
                </div>

                <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center text-blue-300 praxis-pulse">
                  <ActiveIcon className="w-5 h-5" />
                </div>
              </div>

              <div className="p-4 space-y-2.5">
                {workflowSteps.map((step, index) => {
                  const Icon = step.icon;
                  const isActive = index === activeStep;
                  const isDone = index < activeStep;

                  return (
                    <button
                      key={step.title}
                      type="button"
                      onClick={() => setActiveStep(index)}
                      className={`w-full text-left rounded-2xl border p-3 transition-all duration-300 ${
                        isActive
                          ? "bg-white text-slate-950 border-white shadow-lg"
                          : "bg-slate-900/60 text-slate-300 border-slate-800 hover:bg-slate-900"
                      }`}
                    >
                      <div className="flex gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${
                            isActive
                              ? "bg-blue-50 text-blue-700 border-blue-100"
                              : isDone
                                ? "bg-blue-500/10 text-blue-300 border-blue-400/20"
                                : "bg-slate-950 text-slate-500 border-slate-800"
                          }`}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4.5 h-4.5" />
                          ) : (
                            <Icon className="w-4.5 h-4.5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-xs font-bold">{step.title}</h4>

                            <span
                              className={`text-[8px] font-mono font-bold uppercase ${
                                isActive
                                  ? "text-blue-700"
                                  : "text-slate-500"
                              }`}
                            >
                              {index + 1}/4
                            </span>
                          </div>

                          <p
                            className={`text-[11px] mt-1 leading-relaxed ${
                              isActive ? "text-slate-600" : "text-slate-500"
                            }`}
                          >
                            {step.text}
                          </p>

                          {isActive && (
                            <div className="mt-2 h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-600 rounded-full praxis-line" />
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 praxis-slide [animation-delay:100ms]">
            <div className="h-full bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-400">
                    Role-Based Platform Features
                  </p>

                  <h3 className="font-serif text-xl font-black text-slate-950 mt-1">
                    Built for instructors and students
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-[9px] font-mono font-bold uppercase">
                  <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 border border-blue-100 px-3 py-1.5 rounded-full">
                    <GraduationCap className="w-3.5 h-3.5" />
                    Instructor
                  </span>

                  <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1.5 rounded-full">
                    <User className="w-3.5 h-3.5" />
                    Student
                  </span>
                </div>
              </div>

              <div className="p-4 grid md:grid-cols-2 gap-4">
                <FeatureColumn
                  title="Instructor Features"
                  subtitle="Control, review, grading, and feedback"
                  tone="instructor"
                  icon={GraduationCap}
                  items={teacherFeatures}
                />

                <FeatureColumn
                  title="Student Features"
                  subtitle="Guided writing and feedback experience"
                  tone="student"
                  icon={User}
                  items={studentFeatures}
                />
              </div>

              <div className="mx-4 mb-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3 grid sm:grid-cols-3 gap-3">
                <PlatformPrinciple
                  icon={Eye}
                  title="Process visibility"
                  text="Writing activity and attempts stay visible."
                />

                <PlatformPrinciple
                  icon={Lock}
                  title="Responsible AI"
                  text="AI supports thinking, not replacement."
                />

                <PlatformPrinciple
                  icon={FileText}
                  title="Feedback loop"
                  text="Grades and annotations return to students."
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FeatureColumn({ title, subtitle, icon: Icon, items, tone }) {
  const toneStyles =
    tone === "instructor"
      ? {
          header: "text-blue-700",
          icon: "bg-blue-50 text-blue-700 border-blue-100",
          cardIcon: "bg-blue-50 text-blue-700 border-blue-100",
          ring: "hover:border-blue-200",
        }
      : {
          header: "text-indigo-700",
          icon: "bg-indigo-50 text-indigo-700 border-indigo-100",
          cardIcon: "bg-indigo-50 text-indigo-700 border-indigo-100",
          ring: "hover:border-indigo-200",
        };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3 shadow-sm">
      <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
        <div
          className={`w-9 h-9 rounded-xl border flex items-center justify-center ${toneStyles.icon}`}
        >
          <Icon className="w-4.5 h-4.5" />
        </div>

        <div>
          <h4 className={`font-serif text-base font-black ${toneStyles.header}`}>
            {title}
          </h4>

          <p className="text-[11px] text-slate-400">{subtitle}</p>
        </div>
      </div>

      <div className="grid gap-2.5">
        {items.map((item) => {
          const ItemIcon = item.icon;

          return (
            <div
              key={item.title}
              className={`group rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 hover:bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${toneStyles.ring}`}
            >
              <div className="flex gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${toneStyles.cardIcon}`}
                >
                  <ItemIcon className="w-4 h-4" />
                </div>

                <div>
                  <h5 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    {item.title}
                    <ArrowRight className="w-3 h-3 text-slate-300 group-hover:text-blue-600 transition-colors" />
                  </h5>

                  <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlatformPrinciple({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-8 h-8 rounded-xl bg-white border border-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="w-4 h-4" />
      </div>

      <div>
        <h5 className="text-xs font-bold text-slate-900">{title}</h5>

        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
}