import React from "react";
import {
  CheckCircle2,
  ClipboardList,
  FileText,
  Settings,
} from "lucide-react";

import SummaryRow from "../shared/SummaryRow";
import SettingBadge from "../shared/SettingBadge";
import { safeArray } from "../rubricUtils";

export default function ReviewStep({
  creationMode,
  title,
  description,
  course,
  classes,
  dueDate,
  minWords,
  maxWords,
  assignmentType,
  studentLevel,
  feedbackChecks,
  allowAI,
  aiFeedback,
  writingPlayback,
  integritySettings,
  rubricMode,
  rubricTitle,
  selectedSavedRubric,
  uploadedRubricName,
  parsedRubricSchema,
  parsedRubricMatrix,
  criteria,
  rubricTotal,
  generatedDraft,
}) {
  const selectedClass =
    classes.find((cls) => cls.code === course || cls.name === course) || null;

  const rubricLabel =
    rubricMode === "skip"
      ? "No rubric attached"
      : rubricMode === "saved"
      ? selectedSavedRubric?.title || rubricTitle || "Saved rubric"
      : rubricMode === "uploaded"
      ? uploadedRubricName || rubricTitle || "Uploaded rubric"
      : rubricTitle || "Manual rubric";

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5">
        <h3 className="font-serif text-lg font-bold text-slate-950">
          Step 4: Review Assignment
        </h3>

        <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
          Review the assignment, rubric, student support, and integrity rules
          before saving.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-600" />

            <h4 className="font-serif text-sm font-bold text-slate-950">
              Assignment summary
            </h4>
          </div>

          <div className="space-y-3">
            <SummaryRow
              label="Mode"
              value={creationMode === "ai" ? "AI-assisted" : "Manual"}
            />

            <SummaryRow
              label="Title"
              value={title || "No title yet"}
            />

            <SummaryRow
              label="Course"
              value={
                selectedClass
                  ? `${selectedClass.code} — ${selectedClass.name}`
                  : course || "No course selected"
              }
            />

            <SummaryRow
              label="Due Date"
              value={dueDate || "No due date"}
            />

            <SummaryRow
              label="Type"
              value={assignmentType || "Not specified"}
            />

            <SummaryRow
              label="Level"
              value={studentLevel || "Not specified"}
            />

            <SummaryRow
              label="Word Count"
              value={`${minWords || 0}–${maxWords || 0} words`}
            />

            <SummaryRow
              label="Feedback Checks"
              value={`${feedbackChecks || 0}`}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-blue-600" />

            <h4 className="font-serif text-sm font-bold text-slate-950">
              Rubric summary
            </h4>
          </div>

          <div className="space-y-3">
            <SummaryRow label="Rubric" value={rubricLabel} />

            <SummaryRow
              label="Source"
              value={
                rubricMode === "skip"
                  ? "Skipped"
                  : rubricMode === "saved"
                  ? "Saved / previous rubric"
                  : rubricMode === "uploaded"
                  ? "Uploaded file"
                  : "Manual"
              }
            />

            <SummaryRow
              label="Criteria"
              value={`${safeArray(criteria).length} criteria`}
            />

            <SummaryRow
              label="Total Points"
              value={`${rubricTotal || parsedRubricSchema?.totalPoints || 0} pts`}
            />

            {parsedRubricMatrix?.notes?.length > 0 && (
              <SummaryRow
                label="Notes"
                value={`${parsedRubricMatrix.notes.length} parser notes`}
              />
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-600" />

          <h4 className="font-serif text-sm font-bold text-slate-950">
            Student support and integrity
          </h4>
        </div>

        <div className="flex flex-wrap gap-2">
          <SettingBadge active={allowAI} label="AI ideas coach" />
          <SettingBadge active={aiFeedback} label="AI draft feedback" />
          <SettingBadge active={writingPlayback} label="Writing playback" />
          <SettingBadge
            active={integritySettings.logPasteAttempts}
            label="Paste logging"
          />
          <SettingBadge
            active={integritySettings.detectLargeInsertions}
            label="Large insertion detection"
          />
          <SettingBadge
            active={integritySettings.trackFocusLoss}
            label="Focus tracking"
          />
          <SettingBadge
            active={integritySettings.requireHonorConfirmation}
            label="Honor confirmation"
          />
          <SettingBadge
            active={integritySettings.enforceWordCount}
            label="Word count enforced"
          />
          <SettingBadge
            active={integritySettings.lockAfterSubmission}
            label="Lock after submission"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <SummaryRow
            label="Paste Policy"
            value={integritySettings.pastePolicy || "warn"}
          />

          <SummaryRow
            label="Large Insertions"
            value={`${integritySettings.largeInsertionThreshold || 80} words`}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />

          <h4 className="font-serif text-sm font-bold text-slate-950">
            Student instructions preview
          </h4>
        </div>

        <div className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
            {description || "No student instructions written yet."}
          </p>
        </div>

        {generatedDraft && (
          <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            This assignment includes a generated draft that the teacher reviewed
            before saving.
          </p>
        )}
      </div>
    </div>
  );
}