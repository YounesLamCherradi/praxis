import {
  BookOpen,
  GraduationCap,
  MessageSquare,
  PenLine,
  Sparkles,
} from "lucide-react";

const STEPS = [
  {
    number: "01",
    title: "Instructor sets the task",
    text: "Create the assignment, instructions, rubric, and writing expectations.",
    icon: BookOpen,
  },
  {
    number: "02",
    title: "Student plans",
    text: "Develop ideas through the Coach and organize them into an outline.",
    icon: MessageSquare,
  },
  {
    number: "03",
    title: "Student drafts and revises",
    text: "Write the draft, request feedback, and make decisions about revision.",
    icon: PenLine,
  },
  {
    number: "04",
    title: "Student reflects",
    text: "Explain choices, changes, and what was learned during the writing process.",
    icon: Sparkles,
  },
  {
    number: "05",
    title: "Instructor reads and replies",
    text: "Annotate exact wording, grade with the rubric, and return useful feedback.",
    icon: GraduationCap,
  },
];

export default function AssignmentFlow() {
  return (
    <section
      id="assignment-flow"
      className="relative overflow-hidden border-y border-slate-200 bg-[#F8FAFC] py-10 sm:py-20"
    >
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(37,99,235,.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,.045) 1px, transparent 1px)",
          backgroundSize: "3rem 3rem",
        }}
      />

      <div className="pointer-events-none absolute -top-32 left-1/3 h-[520px] w-[520px] rounded-full bg-blue-500/10 blur-[130px]" />

      <div className="relative mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex rounded-full border border-blue-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
            One connected workflow
          </span>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:mt-4 sm:text-5xl">
            How an assignment moves.
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Praxis connects the work students do before,
            during, and after drafting with the feedback
            instructors give at the end.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-12 sm:gap-5 md:grid-cols-5 md:gap-4">
          {STEPS.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.number}
                className="relative mb-1 rounded-[18px] border border-slate-200 bg-white p-3.5 shadow-sm transition-all hover:border-blue-200 sm:mb-2 sm:rounded-3xl sm:p-5 sm:hover:-translate-y-1 sm:hover:shadow-lg md:mb-0"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-black text-blue-600">
                    {item.number}
                  </span>

                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="mt-5 text-sm font-bold text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-2 text-xs leading-6 text-slate-500">
                  {item.text}
                </p>

                {index < STEPS.length - 1 && (
                  <>
                    <span className="absolute -bottom-4 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-600 shadow-sm md:hidden">
                      ↓
                    </span>

                    <span className="absolute -right-3 top-1/2 z-10 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-xs font-bold text-blue-600 md:flex">
                      →
                    </span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
