import React from "react";
import {
  ArrowRight,
  BookOpen,
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

const teacherFeatures = [
  {
    title: "Course Control",
    text: "Create, publish, edit, and manage course access.",
    icon: Layers,
  },
  {
    title: "Assignments",
    text: "Organize assignments by course, status, and submissions.",
    icon: BookOpen,
  },
  {
    title: "Review",
    text: "Review drafts and submissions, grade work, and reopen assignments.",
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
  return (
    <section
      id="platform-view"
      className="relative overflow-hidden border-y border-slate-200 bg-[#F8FAFC] py-10 lg:py-12"
    >
      <style>{`
        @keyframes praxisSlide {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .praxis-grid {
          background-image:
            linear-gradient(to right, rgba(37, 99, 235, 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37, 99, 235, 0.04) 1px, transparent 1px);
          background-size: 3rem 3rem;
        }

        .praxis-slide {
          animation: praxisSlide 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
      `}</style>

      <div className="absolute inset-0 praxis-grid opacity-80" />
      <div className="absolute -left-32 -top-32 h-80 w-80 rounded-full bg-blue-500/12 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-indigo-500/12 blur-3xl" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="praxis-slide mx-auto mb-7 max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            Platform experience
          </span>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            Writing, review, and responsible AI in one workspace.
          </h2>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Praxis connects student writing with instructor review through
            course setup, guided drafting, a clear process view, annotations,
            grading, and feedback.
          </p>
        </div>

        <div className="praxis-slide [animation-delay:100ms]">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">
                  Role-based platform features
                </p>

                <h3 className="mt-1 text-xl font-bold text-slate-950">
                  Built for instructors and students
                </h3>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-blue-700">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Instructor
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-indigo-700">
                  <User className="h-3.5 w-3.5" />
                  Student
                </span>
              </div>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <FeatureColumn
                title="Instructor Features"
                subtitle="Course management, review, grading, and feedback"
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

            <div className="mx-5 mb-5 grid gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 sm:grid-cols-3">
              <PlatformPrinciple
                icon={Eye}
                title="Process view"
                text="Writing activity, drafts, and submissions remain visible."
              />

              <PlatformPrinciple
                icon={Lock}
                title="Responsible AI"
                text="AI supports thinking and revision rather than replacing student work."
              />

              <PlatformPrinciple
                icon={FileText}
                title="Feedback loop"
                text="Grades, comments, and annotations return to students."
              />
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
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 pb-2.5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl border ${toneStyles.icon}`}
        >
          <Icon className="h-4.5 w-4.5" />
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
              className={`group rounded-2xl border border-slate-200 bg-[#F8FAFC] p-3 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${toneStyles.ring}`}
            >
              <div className="flex gap-2.5">
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${toneStyles.cardIcon}`}
                >
                  <ItemIcon className="h-4 w-4" />
                </div>

                <div>
                  <h5 className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    {item.title}
                    <ArrowRight className="h-3 w-3 text-slate-300 transition-colors group-hover:text-blue-600" />
                  </h5>

                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
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
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-white text-blue-700 shadow-sm">
        <Icon className="h-4 w-4" />
      </div>

      <div>
        <h5 className="text-xs font-bold text-slate-900">{title}</h5>

        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
          {text}
        </p>
      </div>
    </div>
  );
}
