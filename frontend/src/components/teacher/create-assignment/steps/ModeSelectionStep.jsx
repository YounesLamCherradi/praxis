import { Check, Pencil, Wand2 } from "lucide-react";

export default function ModeSelectionStep({ creationMode, setCreationMode }) {
  const cardClass = (active) =>
    `group flex h-full w-full flex-col rounded-3xl border p-6 text-left transition-all sm:p-7 ${
      active
        ? "border-blue-500 bg-blue-50/70 ring-4 ring-blue-500/10 shadow-sm"
        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
    }`;

  return (
    <section className="mx-auto w-full max-w-6xl py-1 sm:py-3" aria-labelledby="creation-mode-heading">
      <div className="mb-6 max-w-4xl sm:mb-8">
        <p className="text-sm font-bold text-slate-700 sm:text-base">Create assignment</p>
        <h3 id="creation-mode-heading" className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          How would you like to start?
        </h3>
        <p className="mt-2 text-base leading-relaxed text-slate-600 sm:text-lg">
          Choose one option. We will show only the fields needed for that workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <button
          type="button"
          onClick={() => setCreationMode("ai")}
          className={cardClass(creationMode === "ai")}
          aria-pressed={creationMode === "ai"}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-700 shadow-sm">
              <Wand2 className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-black text-slate-950 sm:text-2xl">Create with AI support</p>
                {creationMode === "ai" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                    <Check className="h-4 w-4" /> Selected
                  </span>
                )}
              </div>
              <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
                Start with a short brief, then review and edit the student-ready assignment before saving.
              </p>
            </div>
          </div>

          <span className={`mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-base font-bold transition-colors sm:text-lg ${creationMode === "ai" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 group-hover:bg-blue-100"}`}>
            Use AI-assisted setup
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCreationMode("manual")}
          className={cardClass(creationMode === "manual")}
          aria-pressed={creationMode === "manual"}
        >
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-700 shadow-sm">
              <Pencil className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xl font-black text-slate-950 sm:text-2xl">Set up manually</p>
                {creationMode === "manual" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700">
                    <Check className="h-4 w-4" /> Selected
                  </span>
                )}
              </div>
              <p className="mt-3 text-base leading-7 text-slate-600 sm:text-lg">
                Write the student title and instructions yourself, with full control over every field.
              </p>
            </div>
          </div>

          <span className={`mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-base font-bold transition-colors sm:text-lg ${creationMode === "manual" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 group-hover:bg-blue-100"}`}>
            Use manual setup
          </span>
        </button>
      </div>
    </section>
  );
}
