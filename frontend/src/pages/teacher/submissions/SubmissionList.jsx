import React from "react";
import {
  ArchiveX,
  Bookmark,
  ClipboardList,
  SlidersHorizontal,
} from "lucide-react";
import SubmissionCard from "./SubmissionCard";

export default function SubmissionList({
  submissions = [],
  filterAssignment = null,
  onClearFilter,
  onOpenSubmission,
}) {
  function handleReview(submission) {
    if (typeof onOpenSubmission === "function") {
      onOpenSubmission(submission);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60 transition-all">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold tracking-widest text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              <ClipboardList className="w-3 h-3" />
              Review Workspace
            </span>
          </div>

          <h2 className="text-2xl font-serif font-black text-slate-950">
            Student Submissions
          </h2>

          <p className="text-xs text-slate-500 font-medium max-w-xl leading-relaxed">
            Review student submissions, word counts, feedback status, AI review
            signals, and grading progress from one organized workspace.
          </p>

          {filterAssignment && (
            <div className="pt-2 flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider">
                <Bookmark className="w-3 h-3" />
                Assignment Filter: {filterAssignment.title}
              </span>
            </div>
          )}
        </div>

        {filterAssignment && (
          <button
            type="button"
            onClick={onClearFilter}
            className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-slate-700 text-xs font-mono font-bold hover:bg-white hover:border-blue-200 hover:text-blue-700 transition-all flex items-center gap-1.5 self-start shadow-sm cursor-pointer hover:scale-[1.01]"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-500" />
            <span>Clear Filter</span>
          </button>
        )}
      </div>

      {/* Submission feed */}
      {submissions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/80 p-12 text-center bg-[#F8FAFC]/70 font-mono text-xs max-w-2xl mx-auto my-6">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
            <ArchiveX className="w-6 h-6 text-blue-500 stroke-[1.5]" />
          </div>

          <h3 className="font-bold text-slate-800 uppercase tracking-wider">
            No Submissions Found
          </h3>

          <p className="text-slate-400 font-sans text-[11px] mt-1 max-w-sm mx-auto leading-relaxed">
            No student submissions are available for this course or assignment
            filter yet. New submissions will appear here once students submit
            their work.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <SubmissionCard
              key={submission.id}
              submission={submission}
              onReview={handleReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}