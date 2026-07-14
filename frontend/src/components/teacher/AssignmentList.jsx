import React from "react";
import { Plus, ArchiveX, Layers, SlidersHorizontal } from "lucide-react";
import AssignmentCard from "./AssignmentCard";

export default function AssignmentList({
  assignments = [],
  onCreateAssignment,
  onViewAssignment,
  onEditAssignment,
  onDeleteAssignment,
  onToggleStatus,
  onOpenSubmissions,
}) {
  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* ─── TERMINAL HEADER CONTROL BAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-6 glow-box-assignments">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono font-bold tracking-widest text-[#C2592A] uppercase bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/10 inline-block">
              Assignment Management
            </span>
          </div>

          <h2 className="text-2xl font-serif font-black text-[#0B1320]">
            Assignments
          </h2>

          <p className="text-xs text-slate-400 font-medium max-w-xl">
            Create, manage, publish, and review writing assignments for your courses.
          </p>
        </div>

        <button
          type="button"
          onClick={onCreateAssignment}
          className="bg-[#0B1320] hover:bg-slate-800 text-white font-sans text-xs font-bold px-4 py-2.5 rounded-xl transition-all tracking-wide flex items-center gap-1.5 shadow-sm cursor-pointer hover:scale-[1.01] self-start"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Assignment</span>
        </button>
      </div>

      {/* ─── BLUEPRINT CONFIGURATION FEED ─── */}
      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200/80 p-12 text-center bg-[#FBF9F6]/50 font-mono text-xs max-w-2xl mx-auto my-6">
          <ArchiveX className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5] mb-3" />
          <h3 className="font-bold text-slate-800 uppercase tracking-wider">
            No Blueprints Deployed
          </h3>
          <p className="text-slate-400 font-sans text-[11px] mt-1 max-w-sm mx-auto leading-relaxed">
            No baseline parameter records have been logged in this registry workspace. Click <strong className="text-slate-700 font-semibold">Initialize Blueprint Schema</strong> to commit your first workspace task configuration.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => (
            <AssignmentCard
              key={assignment.id}
              assignment={assignment}
              onView={() => onViewAssignment(assignment)}
              onEdit={() => onEditAssignment(assignment)}
              onDelete={() => onDeleteAssignment(assignment.id)}
              onToggleStatus={() => onToggleStatus(assignment.id)}
              onOpenSubmissions={() => onOpenSubmissions(assignment)}
            />
          ))}
        </div>
      )}

    </div>
  );
}