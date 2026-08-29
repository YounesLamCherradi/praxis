import {
  ArrowRight,
  MessageSquare,
  PenLine,
  Sparkles,
} from "lucide-react";

const PRINCIPLES = [
  {
    number: "01",
    title: "Ask questions",
    text: "The Coach helps students develop and organize their thinking by asking focused questions.",
    icon: MessageSquare,
  },
  {
    number: "02",
    title: "Point to revision opportunities",
    text: "AI feedback identifies specific places the student should reconsider, clarify, or develop.",
    icon: Sparkles,
  },
  {
    number: "03",
    title: "Leave the writing to the student",
    text: "Praxis supports the writing process without producing the student's assignment for them.",
    icon: PenLine,
  },
];

export default function AIApproach() {
  return (
    <section
      id="ai-approach"
      className="relative overflow-hidden border-y border-slate-200 bg-white py-10 sm:py-20"
    >
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(37,99,235,.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(37,99,235,.04) 1px, transparent 1px)",
          backgroundSize: "3rem 3rem",
        }}
      />

      <div className="relative z-10 mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
            <Sparkles className="h-3.5 w-3.5" />
            AI approach
          </span>

          <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:mt-4 sm:text-5xl">
            AI supports the process.
            <span className="block bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 bg-clip-text text-transparent">
              The student does the writing.
            </span>
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
            Praxis uses AI to help students think, notice opportunities
            for improvement, and make their own revision decisions.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:mt-12 sm:gap-5 md:grid-cols-3">
          {PRINCIPLES.map((item, index) => {
            const Icon = item.icon;

            return (
              <div
                key={item.number}
                className="group relative rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:border-blue-200 sm:rounded-[28px] sm:p-6 sm:hover:-translate-y-1 sm:hover:shadow-xl sm:hover:shadow-blue-100/50"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-black tracking-widest text-blue-600">
                    {item.number}
                  </span>

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600 transition-all group-hover:bg-blue-600 group-hover:text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <h3 className="mt-6 text-xl font-bold text-slate-900">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {item.text}
                </p>

                {index < PRINCIPLES.length - 1 && (
                  <div className="absolute -right-3 top-1/2 z-10 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600 shadow-sm md:flex">
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mx-auto mt-8 max-w-3xl rounded-2xl border border-blue-100 bg-blue-50/70 px-5 py-4 text-center">
          <p className="text-sm font-bold text-blue-700">
            Ask → Guide → Revise → Student writes
          </p>
        </div>
      </div>
    </section>
  );
}
