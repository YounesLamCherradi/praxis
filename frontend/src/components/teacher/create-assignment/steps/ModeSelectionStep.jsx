import { Check, Pencil, Wand2 } from "lucide-react";

export default function ModeSelectionStep({ creationMode, setCreationMode }) {
  const cardClass = (active) =>
    `group flex h-full w-full flex-col rounded-xl border p-3 text-left transition-all sm:rounded-3xl sm:p-7 ${
      active
        ? "border-blue-500 bg-blue-50/70 ring-4 ring-blue-500/10 shadow-sm"
        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/30 hover:shadow-sm"
    }`;

  return (
    <section className="mx-auto w-full max-w-6xl py-0 sm:py-3" aria-labelledby="creation-mode-heading">
      <div className="mb-2.5 max-w-4xl sm:mb-8">
        <p className="hidden text-sm font-bold text-slate-700 sm:block sm:text-base">Create assignment</p>
        <h3 id="creation-mode-heading" className="mt-0 text-[17px] font-black leading-tight tracking-tight text-slate-950 sm:mt-1 sm:text-3xl">
          How would you like to start?
        </h3>
        <p className="mt-1 text-[11px] leading-4 text-slate-500 sm:mt-2 sm:text-lg sm:leading-relaxed">
          Choose one option. We will show only the fields needed for that workflow.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:gap-4 lg:grid-cols-2 lg:gap-5">
        <button
          type="button"
          onClick={() => setCreationMode("ai")}
          className={cardClass(creationMode === "ai")}
          aria-pressed={creationMode === "ai"}
        >
          <div className="flex items-start gap-2.5 sm:gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl">
              <Wand2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-black leading-tight text-slate-950 sm:text-2xl">Create with AI support</p>
                {creationMode === "ai" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[9px] font-bold text-blue-700 sm:px-3 sm:text-sm">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Selected</span>
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-500 sm:mt-3 sm:text-lg sm:leading-7 sm:text-slate-600">
                Start with a short brief, then review and edit the student-ready assignment before saving.
              </p>
            </div>
          </div>

          <span className={`mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-lg px-3 text-[10px] font-bold transition-colors sm:mt-6 sm:min-h-12 sm:h-auto sm:rounded-2xl sm:px-5 sm:text-lg ${creationMode === "ai" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 group-hover:bg-blue-100"}`}>
            <span className="sm:hidden">Continue with AI</span>
            <span className="hidden sm:inline">Use AI-assisted setup</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setCreationMode("manual")}
          className={cardClass(creationMode === "manual")}
          aria-pressed={creationMode === "manual"}
        >
          <div className="flex items-start gap-2.5 sm:gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm sm:h-12 sm:w-12 sm:rounded-2xl">
              <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-black leading-tight text-slate-950 sm:text-2xl">Set up manually</p>
                {creationMode === "manual" && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-[9px] font-bold text-blue-700 sm:px-3 sm:text-sm">
                    <Check className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Selected</span>
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-[11px] leading-4 text-slate-500 sm:mt-3 sm:text-lg sm:leading-7 sm:text-slate-600">
                Write the student title and instructions yourself, with full control over every field.
              </p>
            </div>
          </div>

          <span className={`mt-2.5 inline-flex h-9 w-full items-center justify-center rounded-lg px-3 text-[10px] font-bold transition-colors sm:mt-6 sm:min-h-12 sm:h-auto sm:rounded-2xl sm:px-5 sm:text-lg ${creationMode === "manual" ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-700 group-hover:bg-blue-100"}`}>
            <span className="sm:hidden">Continue manually</span>
            <span className="hidden sm:inline">Use manual setup</span>
          </span>
        </button>
      </div>
    </section>
  );
}
