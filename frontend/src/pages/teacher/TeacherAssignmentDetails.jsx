import { useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Hash,
  MessageSquareText,
  Pencil,
  Save,
  ShieldCheck,
  Timer,
  X,
} from "lucide-react";

import { useTeacherWorkspace } from "../../hooks/useTeacherWorkspace";

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "") ?? "";
}

function getStatus(assignment = {}) {
  const status = String(
    assignment.status || assignment.publicationStatus || assignment.state || ""
  ).toLowerCase();
  return status === "published" || status === "active" || assignment.isPublished === true
    ? "Published"
    : "Draft";
}

function dateParts(assignment = {}) {
  const raw = String(firstValue(assignment.dueDate, assignment.deadline, assignment.dueAt));
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s](\d{2}:\d{2}))?/);
  return {
    date: match?.[1] || "",
    time: String(firstValue(assignment.dueTime, assignment.deadlineTime, match?.[2], "23:59")),
  };
}

function createForm(assignment = {}) {
  const due = dateParts(assignment);
  const aiSettings = assignment.aiSupportSettings || {};
  return {
    title: String(assignment.title || ""),
    description: String(firstValue(assignment.description, assignment.instructions, assignment.prompt)),
    dueDate: due.date,
    dueTime: due.time,
    minWords: String(firstValue(assignment.minWords, assignment.wordCountMin, assignment.minimumWords, "")),
    maxWords: String(firstValue(assignment.maxWords, assignment.wordCountMax, assignment.maximumWords, "")),
    coachEnabled: Boolean(firstValue(aiSettings.aiIdeasCoach, assignment.aiIdeasCoach, assignment.allowAI, false)),
    coachMinutes: String(firstValue(aiSettings.chatTimeLimit, assignment.chatTimeLimit, assignment.coachTimeLimitMinutes, 0)),
    autoOutline: Boolean(firstValue(aiSettings.autoOutlineFromChat, assignment.autoOutlineFromChat, assignment.autoBuildOutlineFromCoach, false)),
    feedbackChecks: String(firstValue(aiSettings.feedbackRequestLimit, assignment.feedbackRequestLimit, assignment.feedbackChecks, 0)),
  };
}

function formatDeadline(assignment = {}) {
  const { date, time } = dateParts(assignment);
  if (!date) return "No due date";
  const parsed = new Date(`${date}T${time || "23:59"}`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

export default function TeacherAssignmentDetails({
  modalMode = false,
  onClose,
  assignment: assignmentProp = null,
}) {
  const {
    selectedAssignment,
    setSelectedAssignment,
    setView,
    updateAssignment,
    classes = [],
  } = useTeacherWorkspace();
  const assignment = assignmentProp || selectedAssignment;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(() => createForm(assignment));

  const courseName = useMemo(() => {
    const course = classes.find((item) =>
      [assignment?.classId, assignment?.courseId, assignment?.classCode, assignment?.courseCode]
        .filter(Boolean)
        .some((value) => [item.id, item.code].map(String).includes(String(value)))
    );
    return firstValue(assignment?.className, assignment?.courseName, course?.name, assignment?.classCode, assignment?.courseCode, "Course");
  }, [assignment, classes]);

  if (!assignment) return null;

  const minWords = firstValue(assignment.minWords, assignment.wordCountMin, assignment.minimumWords);
  const maxWords = firstValue(assignment.maxWords, assignment.wordCountMax, assignment.maximumWords);
  const wordCount = minWords && maxWords ? `${minWords}–${maxWords} words` : minWords ? `${minWords}+ words` : maxWords ? `Up to ${maxWords} words` : "No word limit";
  const instructions = firstValue(assignment.description, assignment.instructions, assignment.prompt, "No student instructions added yet.");
  const status = getStatus(assignment);
  const aiSettings = assignment.aiSupportSettings || {};
  const coachEnabled = Boolean(firstValue(aiSettings.aiIdeasCoach, assignment.aiIdeasCoach, assignment.allowAI, false));
  const coachMinutes = Number(firstValue(aiSettings.chatTimeLimit, assignment.chatTimeLimit, assignment.coachTimeLimitMinutes, 0));
  const feedbackChecks = Number(firstValue(aiSettings.feedbackRequestLimit, assignment.feedbackRequestLimit, assignment.feedbackChecks, 0));
  const autoOutline = Boolean(firstValue(aiSettings.autoOutlineFromChat, assignment.autoOutlineFromChat, assignment.autoBuildOutlineFromCoach, false));
  const rubricSchema = assignment.rubricSchema || null;
  const rubricCriteria = rubricSchema?.criteria || assignment.rubricCriteria || (Array.isArray(assignment.rubric) ? assignment.rubric : assignment.rubric?.criteria) || [];
  const rubricAttached = assignment.rubricSkipped !== true && assignment.rubricSource !== "skip" && Boolean(rubricSchema || rubricCriteria.length || assignment.rubricId);

  const close = () => {
    if (onClose) return onClose();
    setSelectedAssignment?.(null);
    setView?.("list");
  };

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const cancelEdit = () => {
    setForm(createForm(assignment));
    setEditing(false);
    setError("");
  };

  const save = async () => {
    if (!form.title.trim()) {
      setError("Add an assignment title before saving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const dueValue = form.dueDate
        ? `${form.dueDate}T${form.dueTime || "23:59"}`
        : "";
      const updated = await updateAssignment({
        ...assignment,
        title: form.title.trim(),
        description: form.description.trim(),
        instructions: form.description.trim(),
        dueDate: dueValue,
        deadline: dueValue,
        dueTime: form.dueTime,
        minWords: form.minWords === "" ? "" : Number(form.minWords),
        maxWords: form.maxWords === "" ? "" : Number(form.maxWords),
        wordCountMin: form.minWords === "" ? "" : Number(form.minWords),
        wordCountMax: form.maxWords === "" ? "" : Number(form.maxWords),
        aiSupportSettings: {
          ...(assignment.aiSupportSettings || {}),
          aiIdeasCoach: form.coachEnabled,
          chatTimeLimit: Number(form.coachMinutes || 0),
          autoOutlineFromChat: form.coachEnabled && form.autoOutline,
          feedbackRequestLimit: Number(form.feedbackChecks || 0),
        },
        aiIdeasCoach: form.coachEnabled,
        allowAI: form.coachEnabled,
        chatTimeLimit: Number(form.coachMinutes || 0),
        coachTimeLimitMinutes: Number(form.coachMinutes || 0),
        autoOutlineFromChat: form.coachEnabled && form.autoOutline,
        autoBuildOutlineFromCoach: form.coachEnabled && form.autoOutline,
        feedbackRequestLimit: Number(form.feedbackChecks || 0),
        feedbackChecks: Number(form.feedbackChecks || 0),
      });
      if (updated) setSelectedAssignment?.(updated);
      setEditing(false);
    } catch (saveError) {
      setError(saveError?.message || "We could not save these changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={modalMode ? "w-full" : "mx-auto w-full max-w-7xl p-4 sm:p-6"}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={close} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" />
          Close details
        </button>
        {editing ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={cancelEdit} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <X className="h-4 w-4" /> Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
              <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            <Pencil className="h-4 w-4" /> Edit details
          </button>
        )}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">Assignment details</p>
              {editing ? (
                <input value={form.title} onChange={(event) => update("title", event.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 px-4 py-3 font-serif text-2xl font-bold text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" aria-label="Assignment title" />
              ) : (
                <h1 className="mt-2 font-serif text-2xl font-black text-slate-950 sm:text-3xl">{assignment.title}</h1>
              )}
              <p className="mt-2 text-sm text-slate-500">The core information students see before they begin.</p>
            </div>
            <span className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wide ${status === "Published" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              {status}
            </span>
          </div>
        </header>

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/70 p-5 sm:grid-cols-3 sm:p-6">
          <Detail icon={BookOpen} label="Course" value={courseName} />
          {editing ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-1">
              <Label icon={Calendar}>Due date</Label>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
                <input type="date" value={form.dueDate} onChange={(event) => update("dueDate", event.target.value)} className="min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <input type="time" value={form.dueTime} onChange={(event) => update("dueTime", event.target.value)} className="rounded-lg border border-slate-300 px-2 py-2 text-sm" />
              </div>
            </div>
          ) : <Detail icon={Calendar} label="Due date" value={formatDeadline(assignment)} />}
          {editing ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <Label icon={Hash}>Word count</Label>
              <div className="mt-2 flex items-center gap-2">
                <input type="number" min="0" placeholder="Min" value={form.minWords} onChange={(event) => update("minWords", event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <span className="text-slate-400">–</span>
                <input type="number" min="0" placeholder="Max" value={form.maxWords} onChange={(event) => update("maxWords", event.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          ) : <Detail icon={Hash} label="Word count" value={wordCount} />}
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><FileText className="h-4 w-4" /></div>
            <div>
              <h2 className="font-serif text-lg font-bold text-slate-950">Student instructions</h2>
              <p className="text-xs text-slate-500">Exactly what students need to complete this assignment.</p>
            </div>
          </div>
          {editing ? (
            <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={10} className="mt-5 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" aria-label="Student instructions" />
          ) : (
            <div className="mt-5 whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm leading-7 text-slate-700">{instructions}</div>
          )}
          {error && <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p>}
        </div>

        <div className="grid gap-5 border-t border-slate-200 bg-slate-50/60 p-6 sm:p-8 lg:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <SectionTitle icon={Bot} title="Student support" description="Tools available while students write." />
              {editing ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SupportToggle icon={MessageSquareText} label="Outline coach" description="Let students brainstorm and plan with the coach." checked={form.coachEnabled} onChange={(checked) => update("coachEnabled", checked)} />
                  <SupportNumber icon={Timer} label="Coach time limit" description="Use 0 for unlimited active time." value={form.coachMinutes} suffix="minutes" disabled={!form.coachEnabled} onChange={(value) => update("coachMinutes", value)} />
                  <SupportToggle icon={BookOpen} label="Auto-build outline" description="Turn coach notes into an editable outline." checked={form.autoOutline} disabled={!form.coachEnabled} onChange={(checked) => update("autoOutline", checked)} />
                  <SupportNumber icon={ShieldCheck} label="Feedback checks" description="Use 0 to disable AI feedback requests." value={form.feedbackChecks} suffix="requests" onChange={(value) => update("feedbackChecks", value)} />
                </div>
              ) : (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <CompactSetting icon={MessageSquareText} label="Outline coach" value={coachEnabled ? "Available" : "Off"} active={coachEnabled} />
                  <CompactSetting icon={Timer} label="Coach time" value={!coachEnabled ? "Off" : coachMinutes === 0 ? "Unlimited" : `${coachMinutes} min`} active={coachEnabled} />
                  <CompactSetting icon={BookOpen} label="Auto-build outline" value={autoOutline ? "On" : "Off"} active={autoOutline} />
                  <CompactSetting icon={ShieldCheck} label="Feedback checks" value={feedbackChecks > 0 ? `${feedbackChecks} allowed` : "Off"} active={feedbackChecks > 0} />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <SectionTitle icon={ClipboardCheck} title="Rubric" description="The grading guide attached to this assignment." />
              {rubricAttached ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-blue-100 bg-blue-50">
                  <div className="px-4 py-3">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{assignment.rubricTitle || rubricSchema?.title || "Attached rubric"}</p>
                      <p className="mt-1 text-xs text-slate-500">{rubricCriteria.length} {rubricCriteria.length === 1 ? "criterion" : "criteria"}{firstValue(rubricSchema?.totalPoints, assignment.rubricTotal, assignment.rubricPoints) !== "" ? ` · ${firstValue(rubricSchema?.totalPoints, assignment.rubricTotal, assignment.rubricPoints)} points` : ""}</p>
                    </div>
                  </div>
                  <div className="space-y-3 border-t border-blue-100 bg-white p-3">
                    {rubricCriteria.map((criterion, index) => (
                      <div key={criterion.id || index} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex items-start justify-between gap-3 p-3">
                          <div>
                            <p className="text-xs font-bold text-slate-900">{criterion.name || `Criterion ${index + 1}`}</p>
                            {criterion.description && <p className="mt-1 text-[11px] leading-5 text-slate-500">{criterion.description}</p>}
                          </div>
                          <span className="shrink-0 rounded-md bg-white px-2 py-1 font-mono text-[10px] font-bold text-blue-700">{criterion.points ?? criterion.maxScore ?? 0} pts</span>
                        </div>
                        {Array.isArray(criterion.bands) && criterion.bands.length > 0 && (
                          <div className="grid gap-2 border-t border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                            {criterion.bands.map((band, bandIndex) => (
                              <div key={band.id || `${index}-${bandIndex}`} className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-[11px] font-bold text-slate-900">{band.label || band.name || `Band ${bandIndex + 1}`}</p>
                                  <span className="rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-700">{band.points ?? band.score ?? 0}</span>
                                </div>
                                {band.description && <p className="mt-1.5 text-[10px] leading-5 text-slate-500">{band.description}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No rubric is attached.</p>
              )}
            </section>
          </div>

        {editing && (
          <footer className="flex items-center gap-2 border-t border-emerald-100 bg-emerald-50 px-6 py-4 text-sm text-emerald-800 sm:px-8">
            <CheckCircle2 className="h-4 w-4" /> You are editing only the student-facing assignment details.
          </footer>
        )}
      </section>
    </div>
  );
}

function Label({ icon: Icon, children }) {
  return <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-wide text-slate-500"><Icon className="h-4 w-4 text-blue-600" />{children}</p>;
}

function Detail({ icon, label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <Label icon={icon}>{label}</Label>
      <p className="mt-2 text-sm font-bold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></div>
      <div><h2 className="font-serif text-base font-bold text-slate-950">{title}</h2><p className="mt-0.5 text-xs text-slate-500">{description}</p></div>
    </div>
  );
}

function CompactSetting({ icon: Icon, label, value, active }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-emerald-600" : "text-slate-400"}`} />
      <div className="min-w-0"><p className="text-xs font-bold text-slate-700">{label}</p><p className={`mt-0.5 text-[11px] font-semibold ${active ? "text-emerald-700" : "text-slate-500"}`}>{value}</p></div>
    </div>
  );
}

function SupportToggle({ icon: Icon, label, description, checked, disabled = false, onChange }) {
  return (
    <label className={`flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3 ${disabled ? "bg-slate-50 opacity-60" : "bg-white"}`}>
      <span className="flex min-w-0 items-start gap-3"><Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span><span className="block text-xs font-bold text-slate-800">{label}</span><span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span></span></span>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
    </label>
  );
}

function SupportNumber({ icon: Icon, label, description, value, suffix, disabled = false, onChange }) {
  return (
    <label className={`rounded-xl border border-slate-200 p-3 ${disabled ? "bg-slate-50 opacity-60" : "bg-white"}`}>
      <span className="flex items-center gap-2 text-xs font-bold text-slate-800"><Icon className="h-4 w-4 text-blue-600" />{label}</span>
      <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
      <span className="mt-2 flex items-center gap-2"><input type="number" min="0" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm" /><span className="text-xs font-semibold text-slate-500">{suffix}</span></span>
    </label>
  );
}
