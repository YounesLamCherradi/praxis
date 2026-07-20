import React from "react";
import {
  Calendar,
  FileText,
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Bookmark,
} from "lucide-react";

export default function SubmissionCard({ submission, onReview }) {
  const isGraded = submission.status?.toLowerCase() === "graded";

  function handleReviewClick() {
    if (typeof onReview === "function") {
      onReview(submission);
    }
  }

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/70 group cursor-default flex flex-col justify-between space-y-4">
      {/* Top header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold tracking-widest text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-block">
              Writing Portfolio
            </span>

            <span className="font-mono text-[10px] text-slate-400 font-semibold">
              #{submission.classCode || "000000"}
            </span>
          </div>

          <h4 className="font-serif text-lg font-bold text-slate-900 truncate">
            {submission.studentName}
          </h4>

          <p className="text-xs text-slate-400 font-medium flex items-center gap-1.5 truncate">
            <Bookmark className="w-3.5 h-3.5 text-slate-300 shrink-0" />
            {submission.assignmentTitle}
          </p>
        </div>

        {/* Status badge */}
        <span
          className={`text-[9px] font-mono border px-2 py-1 rounded font-bold uppercase shrink-0 tracking-wider ${
            isGraded
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-indigo-50 text-indigo-700 border-indigo-200 status-pulse"
          }`}
        >
          {isGraded ? "Reviewed" : "Awaiting Review"}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 bg-[#F8FAFC] border border-slate-200/60 p-3 rounded-xl text-[11px] font-mono text-slate-500">
        <div className="flex items-center gap-2 px-1">
          <Calendar className="w-3.5 h-3.5 text-blue-500 shrink-0" />

          <div className="min-w-0">
            <span className="text-slate-400 text-[9px] block uppercase font-bold">
              Submitted At
            </span>

            <span className="font-semibold text-slate-700 block truncate">
              {submission.submittedAt || "-"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-l border-slate-200/60 pl-3">
          <FileText className="w-3.5 h-3.5 text-blue-500 shrink-0" />

          <div className="min-w-0">
            <span className="text-slate-400 text-[9px] block uppercase font-bold">
              Word Count
            </span>

            <span className="font-semibold text-slate-700 block truncate">
              {submission.wordCount || 0} words
            </span>
          </div>
        </div>
      </div>

      {/* AI / integrity banner */}
      <div
        className={`flex items-center gap-2 p-2 rounded-xl text-[10px] font-mono border transition-all ${
          submission.aiFlags > 0
            ? "bg-red-50 border-red-200 text-red-700"
            : "bg-blue-50 border-blue-100 text-blue-700"
        }`}
      >
        {submission.aiFlags > 0 ? (
          <>
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />

            <span>
              Review signal: <strong>{submission.aiFlags}</strong> AI-related
              flag(s) detected
            </span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />

            <span>Process signal clear and ready for instructor review</span>
          </>
        )}
      </div>

      {/* Action layer */}
      <div className="pt-3 border-t border-slate-200/50 flex justify-between items-center text-[11px] font-mono">
        <div>
          <span className="text-slate-400 text-[9px] block uppercase font-bold">
            Evaluation Score
          </span>

          <span className="text-xs font-black text-slate-900">
            {submission.score ?? "Pending Review"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleReviewClick}
          className="bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold px-3.5 py-1.5 rounded-xl transition-all tracking-wide flex items-center gap-1 shadow-sm shadow-blue-600/20 cursor-pointer hover:scale-[1.01]"
        >
          <span>Review</span>

          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}