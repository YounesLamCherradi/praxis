import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  ClipboardList,
  CheckCircle2,
  FileText,
  Layers,
  Search,
  Copy,
  Upload,
  Eye,
  Link2,
  SlidersHorizontal,
  AlertCircle,
  RotateCcw,
  BookOpen,
  FolderOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext";

const DEFAULT_CRITERIA = [
  {
    id: "criterion_argument",
    name: "Argument Quality",
    description: "Clear thesis, logical reasoning, and strong argumentation.",
    points: 30,
  },
  {
    id: "criterion_evidence",
    name: "Evidence & Support",
    description: "Use of relevant examples, references, and supporting details.",
    points: 25,
  },
  {
    id: "criterion_organization",
    name: "Organization",
    description: "Structure, paragraph flow, and coherence.",
    points: 20,
  },
  {
    id: "criterion_language",
    name: "Language & Style",
    description: "Grammar, clarity, tone, and academic writing quality.",
    points: 25,
  },
];

function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
}

function roundToHalf(value) {
  return Math.round(Number(value || 0) * 2) / 2;
}

function buildBands(points = 0) {
  const max = Number(points || 0);

  return [
    {
      id: "excellent",
      label: "Excellent",
      points: roundToHalf(max),
      description: "Fully meets or exceeds the expectations for this criterion.",
    },
    {
      id: "good",
      label: "Good",
      points: roundToHalf(max * 0.85),
      description: "Meets the criterion well with minor gaps or weaknesses.",
    },
    {
      id: "satisfactory",
      label: "Satisfactory",
      points: roundToHalf(max * 0.7),
      description: "Meets the basic expectations but needs more development.",
    },
    {
      id: "needs-work",
      label: "Needs Work",
      points: roundToHalf(max * 0.5),
      description: "Partially meets the criterion and needs important revision.",
    },
    {
      id: "beginning",
      label: "Beginning",
      points: roundToHalf(max * 0.3),
      description: "Shows limited progress toward the criterion.",
    },
  ];
}

function normalizeCriterion(criterion, index = 0) {
  const points = Number(criterion.points || criterion.maxPoints || 0);

  return {
    id: criterion.id || createId("criterion"),
    name: criterion.name || criterion.title || `Criterion ${index + 1}`,
    description:
      criterion.description ||
      criterion.guidelines ||
      criterion.descriptor ||
      "",
    points,
    bands:
      Array.isArray(criterion.bands) && criterion.bands.length > 0
        ? criterion.bands.map((band, bandIndex) => ({
            id: band.id || `band_${bandIndex + 1}`,
            label: band.label || band.name || `Level ${bandIndex + 1}`,
            points: Number(band.points ?? band.score ?? 0),
            description:
              band.description || band.feedback || band.descriptor || "",
          }))
        : buildBands(points),
  };
}

function calculateTotal(criteria = []) {
  return criteria.reduce(
    (sum, criterion) => sum + Number(criterion.points || 0),
    0
  );
}

function normalizeRubric(rubric = {}) {
  const criteria = Array.isArray(rubric.criteria)
    ? rubric.criteria.map(normalizeCriterion)
    : [];

  return {
    id: rubric.id || createId("rubric"),
    title: rubric.title || rubric.name || "Untitled Rubric",
    assignmentId: rubric.assignmentId ?? null,
    assignmentTitle: rubric.assignmentTitle || "",
    source: rubric.source || "manual",
    status: rubric.status || "Draft",
    criteria,
    totalPoints: rubric.totalPoints || calculateTotal(criteria),
    uploadedRubricName: rubric.uploadedRubricName || "",
    uploadedRubricText: rubric.uploadedRubricText || "",
    createdAt: rubric.createdAt || "",
    updatedAt: rubric.updatedAt || "",
  };
}

function createStarterCriteria() {
  return DEFAULT_CRITERIA.map((criterion, index) =>
    normalizeCriterion(
      {
        ...criterion,
        id: createId("criterion"),
      },
      index
    )
  );
}

function parseRubricText(text = "") {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const possibleCriteria = lines
    .filter((line) => line.length > 8)
    .slice(0, 8)
    .map((line, index) => {
      const pointMatch = line.match(/(\d+(?:\.\d+)?)\s*(pts?|points?)/i);
      const points = pointMatch ? Number(pointMatch[1]) : 20;

      const cleanedLine = line
        .replace(/(\d+(?:\.\d+)?)\s*(pts?|points?)/i, "")
        .replace(/^[-•*\d.)\s]+/, "")
        .trim();

      const [namePart, ...descriptionParts] = cleanedLine.split(/[:–—-]/);

      const name = namePart?.trim() || `Criterion ${index + 1}`;

      const description =
        descriptionParts.join(" ").trim() ||
        "Review this criterion and adjust the description before saving.";

      return normalizeCriterion(
        {
          id: createId("criterion"),
          name,
          description,
          points,
        },
        index
      );
    });

  return possibleCriteria.length > 0
    ? possibleCriteria
    : createStarterCriteria();
}

function sourceLabel(source = "manual") {
  if (source === "uploaded") return "Uploaded";
  if (source === "saved") return "Saved";
  if (source === "generated") return "AI-generated";
  return "Manual";
}

function rubricDescription(rubric) {
  const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];

  if (rubric.uploadedRubricName) {
    return `Uploaded source: ${rubric.uploadedRubricName}`;
  }

  if (criteria.length === 0) {
    return "No criteria description available yet.";
  }

  const names = criteria.slice(0, 3).map((criterion) => criterion.name);

  return `Evaluates ${names.join(", ")}${
    criteria.length > 3 ? `, and ${criteria.length - 3} more` : ""
  }.`;
}

export default function TeacherRubrics() {
  const {
    rubrics = [],
    assignments = [],
    classes = [],
    addRubric,
    updateRubric,
    deleteRubric,
    duplicateRubric,
    attachRubricToAssignment,
  } = useTeacherWorkspace();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [previewRecord, setPreviewRecord] = useState(null);

  const records = useMemo(() => {
    const builtRecords = [];
    const shownRubricIds = new Set();

    assignments.forEach((assignment) => {
      const attachedRubric =
        assignment.rubricSchema ||
        rubrics.find(
          (rubric) => String(rubric.assignmentId) === String(assignment.id)
        ) ||
        rubrics.find(
          (rubric) =>
            assignment.rubricId &&
            String(rubric.id) === String(assignment.rubricId)
        );

      if (!attachedRubric) return;

      const rubric = normalizeRubric({
        ...attachedRubric,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
      });

      shownRubricIds.add(String(rubric.id));

      builtRecords.push({
        id: `assignment_${assignment.id}_${rubric.id}`,
        type: "assignment",
        assignment,
        rubric,
      });
    });

    rubrics.forEach((rubricItem) => {
      const normalized = normalizeRubric(rubricItem);

      const alreadyShown = shownRubricIds.has(String(normalized.id));
      const attachedToExistingAssignment = assignments.some(
        (assignment) =>
          String(assignment.id) === String(normalized.assignmentId)
      );

      if (alreadyShown || attachedToExistingAssignment) return;

      builtRecords.push({
        id: `library_${normalized.id}`,
        type: "library",
        assignment: null,
        rubric: normalized,
      });
    });

    return builtRecords;
  }, [assignments, rubrics]);

  const courseOptions = useMemo(() => {
    const options = new Map();

    classes.forEach((cls) => {
      if (cls.code) options.set(cls.code, `${cls.code} — ${cls.name}`);
    });

    assignments.forEach((assignment) => {
      const code = assignment.classCode || assignment.className;

      if (code) {
        options.set(
          code,
          `${code}${assignment.className ? ` — ${assignment.className}` : ""}`
        );
      }
    });

    return Array.from(options.entries());
  }, [classes, assignments]);

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const rubric = record.rubric;
      const assignment = record.assignment;

      const query = searchQuery.toLowerCase().trim();
      const description = rubricDescription(rubric).toLowerCase();

      const matchesSearch =
        !query ||
        rubric.title?.toLowerCase().includes(query) ||
        description.includes(query) ||
        assignment?.title?.toLowerCase().includes(query) ||
        assignment?.classCode?.toLowerCase().includes(query) ||
        assignment?.className?.toLowerCase().includes(query) ||
        rubric.criteria?.some((criterion) =>
          criterion.name?.toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "all" ||
        String(rubric.status || "").toLowerCase() === statusFilter;

      const matchesSource =
        sourceFilter === "all" ||
        String(rubric.source || "manual").toLowerCase() === sourceFilter;

      const recordCourse = assignment?.classCode || assignment?.className || "";

      const matchesCourse =
        courseFilter === "all" || String(recordCourse) === String(courseFilter);

      return matchesSearch && matchesStatus && matchesSource && matchesCourse;
    });
  }, [records, searchQuery, statusFilter, sourceFilter, courseFilter]);

  const activeCount = records.filter(
    (record) => record.rubric.status?.toLowerCase() === "active"
  ).length;

  const attachedCount = records.filter(
    (record) => record.type === "assignment"
  ).length;

  const libraryCount = records.filter((record) => record.type === "library")
    .length;

  function openCreateModal() {
    setEditingRecord(null);
    setIsModalOpen(true);
  }

  function openEditModal(record) {
    setEditingRecord(record);
    setIsModalOpen(true);
  }

  function openViewModal(record) {
    setPreviewRecord(record);
  }

  function handleSaveRubric(rubricData, attachAssignmentId = "") {
    const selectedAssignment = assignments.find(
      (assignment) => String(assignment.id) === String(attachAssignmentId)
    );

    if (editingRecord?.type === "assignment") {
      const targetAssignmentId =
        attachAssignmentId || editingRecord.assignment?.id;

      attachRubricToAssignment(targetAssignmentId, {
        ...rubricData,
        id: editingRecord.rubric.id,
        assignmentId: targetAssignmentId,
        assignmentTitle:
          selectedAssignment?.title ||
          editingRecord.assignment?.title ||
          rubricData.assignmentTitle,
        status: "Active",
      });
    } else if (editingRecord?.type === "library") {
      const updatedRubric = updateRubric(editingRecord.rubric.id, {
        ...rubricData,
        id: editingRecord.rubric.id,
      });

      if (attachAssignmentId && updatedRubric) {
        attachRubricToAssignment(attachAssignmentId, {
          ...updatedRubric,
          id: createId("rubric"),
          source: "saved",
          status: "Active",
        });
      }
    } else if (attachAssignmentId) {
      attachRubricToAssignment(attachAssignmentId, {
        ...rubricData,
        id: createId("rubric"),
        status: "Active",
      });
    } else {
      addRubric({
        ...rubricData,
        id: createId("rubric"),
        assignmentId: null,
        assignmentTitle: "",
      });
    }

    setIsModalOpen(false);
    setEditingRecord(null);
  }

  function handleDuplicate(record) {
    if (!record?.rubric?.id) return;
    duplicateRubric(record.rubric.id);
  }

  function handleDelete(record) {
    if (!record?.rubric?.id) return;

    const confirmed = window.confirm("Delete this rubric from the library?");
    if (!confirmed) return;

    deleteRubric(record.rubric.id);
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 text-[9px] font-mono font-bold uppercase tracking-widest text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
              <ClipboardList className="w-3 h-3" />
              Rubrics
            </div>

            <h2 className="text-2xl font-serif font-black text-slate-950">
              Rubric Records
            </h2>

            <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
              View rubric details, check where each rubric is used, and edit
              criteria or score bands from one organized workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-sans text-xs font-bold px-4 py-2.5 rounded-xl transition-all tracking-wide flex items-center gap-1.5 shadow-sm shadow-blue-600/20 cursor-pointer self-start"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Create Rubric</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6">
          <SummaryBox
            label="Total Records"
            value={records.length}
            icon={ClipboardList}
          />
          <SummaryBox label="Attached" value={attachedCount} icon={BookOpen} />
          <SummaryBox
            label="Reusable"
            value={libraryCount}
            icon={FolderOpen}
          />
          <SummaryBox label="Active" value={activeCount} icon={CheckCircle2} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />

            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search rubric, description, assignment, course..."
              className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </div>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="all">All courses</option>
            {courseOptions.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="draft">Draft only</option>
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          >
            <option value="all">All sources</option>
            <option value="manual">Manual</option>
            <option value="uploaded">Uploaded</option>
            <option value="saved">Saved</option>
            <option value="generated">AI-generated</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden lg:grid grid-cols-[1.2fr_1.6fr_1fr_0.8fr_0.9fr_170px] gap-4 px-5 py-3 bg-[#F8FAFC] border-b border-slate-200">
          <TableHeader label="Rubric" />
          <TableHeader label="Description" />
          <TableHeader label="Assignment / Course" />
          <TableHeader label="Points" />
          <TableHeader label="Status" />
          <TableHeader label="Actions" align="right" />
        </div>

        {filteredRecords.length === 0 ? (
          <EmptyState onAction={openCreateModal} />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map((record) => (
              <RubricRecordRow
                key={record.id}
                record={record}
                onView={() => openViewModal(record)}
                onEdit={() => openEditModal(record)}
                onDuplicate={() => handleDuplicate(record)}
                onDelete={() => handleDelete(record)}
              />
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <RubricModal
          record={editingRecord}
          assignments={assignments}
          onClose={() => {
            setIsModalOpen(false);
            setEditingRecord(null);
          }}
          onSave={handleSaveRubric}
        />
      )}

      {previewRecord && (
        <RubricPreviewModal
          record={previewRecord}
          onClose={() => setPreviewRecord(null)}
          onEdit={() => {
            setEditingRecord(previewRecord);
            setPreviewRecord(null);
            setIsModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

function TableHeader({ label, align = "left" }) {
  return (
    <p
      className={`text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 ${
        align === "right" ? "text-right" : ""
      }`}
    >
      {label}
    </p>
  );
}

function RubricRecordRow({
  record,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
}) {
  const { rubric, assignment, type } = record;

  const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
  const totalPoints = rubric.totalPoints || calculateTotal(criteria);
  const isActive = rubric.status?.toLowerCase() === "active";
  const isLibrary = type === "library";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.6fr_1fr_0.8fr_0.9fr_170px] gap-4 p-5 items-center hover:bg-[#F8FAFC] transition-all">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`text-[9px] font-mono font-bold uppercase tracking-wider border px-2 py-0.5 rounded ${
              isLibrary
                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                : "bg-blue-50 text-blue-700 border-blue-100"
            }`}
          >
            {isLibrary ? "Library" : "Attached"}
          </span>

          <SourceBadge source={rubric.source} />
        </div>

        <h3 className="font-serif text-base font-bold text-slate-950 mt-2 truncate">
          {rubric.title}
        </h3>

        <p className="text-[11px] text-slate-400 mt-1">
          {criteria.length} criteria ·{" "}
          {criteria.reduce(
            (sum, criterion) => sum + Number(criterion.bands?.length || 0),
            0
          )}{" "}
          score bands
        </p>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed">
        {rubricDescription(rubric)}
      </p>

      <div className="text-xs text-slate-600">
        {assignment ? (
          <>
            <p className="font-bold text-slate-900 truncate">
              {assignment.title}
            </p>
            <p className="text-[11px] font-mono text-slate-400 mt-0.5">
              {assignment.classCode || assignment.className || "No course"}
            </p>
          </>
        ) : (
          <>
            <p className="font-bold text-slate-900">Reusable rubric</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Not attached to an assignment
            </p>
          </>
        )}
      </div>

      <div>
        <p className="font-mono text-sm font-black text-blue-700">
          {totalPoints}
          <span className="text-xs text-slate-400"> pts</span>
        </p>
      </div>

      <div>
        <StatusBadge active={isActive} />
      </div>

      <div className="flex lg:justify-end gap-2 flex-wrap">
        <button
          type="button"
          onClick={onView}
          className="px-3 py-1.5 rounded-xl border border-blue-100 bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1.5"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>

        <button
          type="button"
          onClick={onEdit}
          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-[#F8FAFC] transition-all flex items-center gap-1.5"
        >
          <Pencil className="w-3.5 h-3.5 text-slate-400" />
          Edit rubric
        </button>

        {isLibrary && (
          <div className="flex gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={onDuplicate}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-[#F8FAFC] transition-all flex items-center gap-1.5"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="px-3 py-1.5 rounded-xl border border-red-200 text-red-600 bg-red-50/40 hover:bg-red-50 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RubricModal({ record, assignments, onClose, onSave }) {
  const rubric = record?.rubric || null;
  const assignment = record?.assignment || null;

  const [title, setTitle] = useState(rubric?.title || "");
  const [status, setStatus] = useState(rubric?.status || "Draft");
  const [source, setSource] = useState(rubric?.source || "manual");

  const [assignmentId, setAssignmentId] = useState(
    assignment?.id
      ? String(assignment.id)
      : rubric?.assignmentId
      ? String(rubric.assignmentId)
      : ""
  );

  const [uploadedRubricName, setUploadedRubricName] = useState(
    rubric?.uploadedRubricName || ""
  );

  const [uploadedRubricText, setUploadedRubricText] = useState(
    rubric?.uploadedRubricText || ""
  );

  const [criteria, setCriteria] = useState(() => {
    if (rubric?.criteria?.length) {
      return rubric.criteria.map(normalizeCriterion);
    }

    return createStarterCriteria();
  });

  const totalPoints = calculateTotal(criteria);
  const [expandedCriterionId, setExpandedCriterionId] = useState(
    criteria[0]?.id || ""
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function updateCriterion(id, field, value) {
    setCriteria((prev) =>
      prev.map((criterion) => {
        if (criterion.id !== id) return criterion;

        return {
          ...criterion,
          [field]: field === "points" ? Number(value || 0) : value,
        };
      })
    );
  }

  function addCriterion() {
    setCriteria((prev) => {
      const nextCriterion = normalizeCriterion(
        {
          id: createId("criterion"),
          name: "",
          description: "",
          points: 10,
        },
        prev.length
      );

      setExpandedCriterionId(nextCriterion.id);

      return [...prev, nextCriterion];
    });
  }

  function removeCriterion(id) {
    if (criteria.length === 1) return;

    setCriteria((prev) => {
      const nextCriteria = prev.filter((criterion) => criterion.id !== id);

      if (String(expandedCriterionId) === String(id)) {
        setExpandedCriterionId(nextCriteria[0]?.id || "");
      }

      return nextCriteria;
    });
  }

  function resetBandsForCriterion(id) {
    setCriteria((prev) =>
      prev.map((criterion) =>
        criterion.id === id
          ? {
              ...criterion,
              bands: buildBands(criterion.points),
            }
          : criterion
      )
    );
  }

  function updateBand(criterionId, bandId, field, value) {
    setCriteria((prev) =>
      prev.map((criterion) => {
        if (criterion.id !== criterionId) return criterion;

        return {
          ...criterion,
          bands: criterion.bands.map((band) =>
            band.id === bandId
              ? {
                  ...band,
                  [field]: field === "points" ? Number(value || 0) : value,
                }
              : band
          ),
        };
      })
    );
  }

  function addBand(criterionId) {
    setCriteria((prev) =>
      prev.map((criterion) => {
        if (criterion.id !== criterionId) return criterion;

        return {
          ...criterion,
          bands: [
            ...criterion.bands,
            {
              id: createId("band"),
              label: "Custom Level",
              points: 0,
              description: "Describe this performance level.",
            },
          ],
        };
      })
    );
  }

  function removeBand(criterionId, bandId) {
    setCriteria((prev) =>
      prev.map((criterion) => {
        if (criterion.id !== criterionId) return criterion;
        if (criterion.bands.length === 1) return criterion;

        return {
          ...criterion,
          bands: criterion.bands.filter((band) => band.id !== bandId),
        };
      })
    );
  }

  function handleFileUpload(file) {
    if (!file) return;

    setSource("uploaded");
    setUploadedRubricName(file.name);

    const reader = new FileReader();

    reader.onload = () => {
      const text = String(reader.result || "");

      setUploadedRubricText(text);
      setCriteria(parseRubricText(text));

      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    };

    reader.onerror = () => {
      setUploadedRubricText("");

      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
    };

    reader.readAsText(file);
  }

  function handleSubmit(e) {
    e.preventDefault();

    const selectedAssignment = assignments.find(
      (item) => String(item.id) === String(assignmentId)
    );

    const cleanedCriteria = criteria
      .map((criterion, index) =>
        normalizeCriterion(
          {
            ...criterion,
            name: criterion.name.trim(),
            description: criterion.description.trim(),
            points: Number(criterion.points || 0),
            bands: criterion.bands.map((band) => ({
              ...band,
              label: band.label.trim(),
              description: band.description.trim(),
              points: Number(band.points || 0),
            })),
          },
          index
        )
      )
      .filter((criterion) => criterion.name && criterion.points >= 0);

    if (!title.trim() || cleanedCriteria.length === 0) return;

    const rubricPayload = {
      id: rubric?.id,
      title: title.trim(),
      status,
      source,
      assignmentId: selectedAssignment?.id || null,
      assignmentTitle: selectedAssignment?.title || "",
      uploadedRubricName,
      uploadedRubricText,
      criteria: cleanedCriteria,
      totalPoints: calculateTotal(cleanedCriteria),
    };

    onSave(rubricPayload, selectedAssignment?.id || "");
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden p-3 sm:p-5">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up">
        <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-mono font-bold tracking-widest text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1.5">
                <ClipboardList className="w-3 h-3" />
                Rubric Editor
              </span>

              <h2 className="text-2xl font-serif font-black text-slate-950">
                {record ? "Edit Rubric" : "Create Rubric"}
              </h2>

              <p className="text-xs text-slate-500 font-medium">
                Create or edit rubric criteria, points, score bands, and assignment attachment.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#F8FAFC] text-slate-400 border border-transparent hover:border-slate-200 transition-all"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]/60 px-4 py-5 sm:px-6 sm:py-6">
            <div className="max-w-5xl mx-auto space-y-5">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-base font-bold text-slate-950">
                      Basic Information
                    </h3>

                    <p className="text-xs text-slate-500 mt-0.5">
                      Name the rubric and choose whether it is still a draft or
                      active.
                    </p>
                  </div>

                  <span className="bg-blue-50 text-blue-700 border border-blue-100 font-mono text-[11px] font-bold px-2 py-1 rounded-lg">
                    {totalPoints} pts
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2 space-y-1.5">
                    <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      Rubric Title
                    </label>

                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                      placeholder="Example: Critical Essay Rubric"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      Status
                    </label>

                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Active">Active</option>
                    </select>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div>
                  <h3 className="font-serif text-base font-bold text-slate-950">
                    Rubric Source
                  </h3>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose how this rubric was created.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <SourceCard
                    active={source === "manual"}
                    icon={Pencil}
                    title="Manual"
                    description="Built directly in Praxis."
                    onClick={() => setSource("manual")}
                  />

                  <SourceCard
                    active={source === "saved"}
                    icon={FolderOpen}
                    title="Saved"
                    description="Reusable rubric/template."
                    onClick={() => setSource("saved")}
                  />

                  <label
                    className={`text-left rounded-xl border p-4 transition-all cursor-pointer ${
                      source === "uploaded"
                        ? "bg-white border-blue-300 ring-4 ring-blue-500/10"
                        : "bg-white border-slate-200 hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.txt"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e.target.files?.[0])}
                    />

                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-bold text-slate-900">
                        Upload
                      </p>
                    </div>

                    <p className="text-[11px] text-slate-500 mt-1">
                      Upload PDF, Word, or text.
                    </p>

                    {uploadedRubricName && (
                      <p className="mt-2 text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg inline-block">
                        {uploadedRubricName}
                      </p>
                    )}
                  </label>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
                <div>
                  <h3 className="font-serif text-base font-bold text-slate-950">
                    Assignment Attachment
                  </h3>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Attach this rubric to an assignment or keep it reusable.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <select
                    value={assignmentId}
                    onChange={(e) => setAssignmentId(e.target.value)}
                    className="w-full bg-[#F8FAFC] text-slate-900 border border-slate-200 text-xs rounded-xl p-3 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                  >
                    <option value="">Save as reusable rubric only</option>

                    {assignments.map((assignmentItem) => (
                      <option key={assignmentItem.id} value={assignmentItem.id}>
                        {assignmentItem.title} —{" "}
                        {assignmentItem.classCode || assignmentItem.className}
                      </option>
                    ))}
                  </select>

                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 flex items-start gap-2">
                    <Link2 className="w-4 h-4 text-blue-700 mt-0.5 shrink-0" />

                    <p className="text-[11px] text-blue-800 leading-relaxed">
                      Attached rubrics will appear in grading and submission
                      review.
                    </p>
                  </div>
                </div>
              </section>

              <CriteriaEditor
                criteria={criteria}
                totalPoints={totalPoints}
                expandedCriterionId={expandedCriterionId}
                setExpandedCriterionId={setExpandedCriterionId}
                updateCriterion={updateCriterion}
                addCriterion={addCriterion}
                removeCriterion={removeCriterion}
                resetBandsForCriterion={resetBandsForCriterion}
                updateBand={updateBand}
                addBand={addBand}
                removeBand={removeBand}
              />

              {totalPoints <= 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 mt-0.5" />

                  <p className="text-xs text-amber-800">
                    The rubric total is currently 0 points. Add point values
                    before using it for grading.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 z-20 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 text-xs font-bold sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-[#F8FAFC] transition-all"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 py-2.5 rounded-xl transition-all tracking-wide flex items-center gap-1.5 shadow-sm shadow-blue-600/20"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{record ? "Save Changes" : "Create Rubric"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function CriteriaEditor({
  criteria,
  totalPoints,
  expandedCriterionId,
  setExpandedCriterionId,
  updateCriterion,
  addCriterion,
  removeCriterion,
  resetBandsForCriterion,
  updateBand,
  addBand,
  removeBand,
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h3 className="font-serif text-base font-bold text-slate-950">
            Criteria & Score Bands
          </h3>

          <p className="text-xs text-slate-500 mt-0.5">
            Define what will be evaluated and how each level should be scored.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-blue-50 text-blue-700 border border-blue-100 font-mono text-[11px] font-bold px-2 py-1 rounded-lg">
            {totalPoints} pts
          </span>

          <button
            type="button"
            onClick={addCriterion}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            Add Criterion
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {criteria.map((criterion, index) => {
          const isExpanded =
            String(expandedCriterionId) === String(criterion.id);

          return (
            <div
              key={criterion.id}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedCriterionId(isExpanded ? "" : criterion.id)
                }
                className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition-all ${
                  isExpanded
                    ? "border-b border-slate-100 bg-blue-50/60"
                    : "bg-[#F8FAFC] hover:bg-blue-50/40"
                }`}
                aria-expanded={isExpanded}
              >
                <div className="min-w-0">
                  <p className="font-serif text-sm font-bold text-slate-950">
                    {criterion.name || `Criterion ${index + 1}`}
                  </p>

                  <p className="mt-1 text-[11px] text-slate-500">
                    {criterion.bands?.length || 0} score bands ·{" "}
                    {criterion.points || 0} pts
                  </p>
                </div>

                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 font-mono text-[10px] font-bold text-blue-700">
                  {isExpanded ? "Collapse" : "Expand / edit"}
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>

              {isExpanded && (
                <div className="space-y-4 bg-[#F8FAFC] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Criterion {index + 1}
                    </p>

                    <button
                      type="button"
                      disabled={criteria.length === 1}
                      onClick={() => removeCriterion(criterion.id)}
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        criteria.length === 1
                          ? "cursor-not-allowed text-slate-300"
                          : "text-red-500 hover:underline"
                      }`}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
                    <div className="space-y-2 lg:col-span-4">
                      <input
                        value={criterion.name}
                        onChange={(event) =>
                          updateCriterion(
                            criterion.id,
                            "name",
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="Criterion name"
                        required
                      />

                      <textarea
                        rows={2}
                        value={criterion.description}
                        onChange={(event) =>
                          updateCriterion(
                            criterion.id,
                            "description",
                            event.target.value
                          )
                        }
                        className="w-full resize-none rounded-xl border border-slate-200 bg-white p-2.5 text-xs outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        placeholder="Describe what this criterion evaluates..."
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                        Max Points
                      </label>

                      <input
                        type="number"
                        min="0"
                        value={criterion.points}
                        onChange={(event) =>
                          updateCriterion(
                            criterion.id,
                            "points",
                            event.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-center text-xs font-bold text-slate-900 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
                        required
                      />

                      <button
                        type="button"
                        onClick={() => resetBandsForCriterion(criterion.id)}
                        className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700 transition-all hover:bg-blue-100"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset bands
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Score Bands
                      </p>

                      <button
                        type="button"
                        onClick={() => addBand(criterion.id)}
                        className="text-[10px] font-bold text-blue-700 hover:underline"
                      >
                        Add band
                      </button>
                    </div>

                    <div className="space-y-2">
                      {criterion.bands.map((band) => (
                        <div
                          key={band.id}
                          className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-[#F8FAFC] p-2 lg:grid-cols-12"
                        >
                          <input
                            value={band.label}
                            onChange={(event) =>
                              updateBand(
                                criterion.id,
                                band.id,
                                "label",
                                event.target.value
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-blue-500 lg:col-span-2"
                            placeholder="Level"
                          />

                          <input
                            type="number"
                            min="0"
                            value={band.points}
                            onChange={(event) =>
                              updateBand(
                                criterion.id,
                                band.id,
                                "points",
                                event.target.value
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-blue-500 lg:col-span-2"
                            placeholder="Points"
                          />

                          <input
                            value={band.description}
                            onChange={(event) =>
                              updateBand(
                                criterion.id,
                                band.id,
                                "description",
                                event.target.value
                              )
                            }
                            className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-[11px] outline-none focus:border-blue-500 lg:col-span-7"
                            placeholder="Description"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeBand(criterion.id, band.id)
                            }
                            disabled={criterion.bands.length === 1}
                            className={`rounded-lg border px-2 py-2 text-[10px] font-bold lg:col-span-1 ${
                              criterion.bands.length === 1
                                ? "cursor-not-allowed border-slate-200 text-slate-300"
                                : "border-red-100 text-red-500 hover:bg-red-50"
                            }`}
                          >
                            X
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RubricPreviewModal({ record, onClose, onEdit }) {
  const rubric = record.rubric;
  const assignment = record.assignment;

  const criteria = Array.isArray(rubric.criteria) ? rubric.criteria : [];
  const totalPoints = rubric.totalPoints || calculateTotal(criteria);
  const [expandedCriterionId, setExpandedCriterionId] = useState(
    criteria[0]?.id || ""
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center overflow-hidden p-3 sm:p-5">
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-fade-in-up">
        <div className="sticky top-0 z-20 shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block rounded border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-blue-700">
                View Rubric
              </span>

              <h2 className="mt-2 font-serif text-2xl font-black text-slate-950">
                {rubric.title}
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                {assignment
                  ? `Assignment: ${assignment.title}`
                  : "Reusable library rubric"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
                  {criteria.length} criteria
                </span>

                <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
                  {totalPoints} points
                </span>

                <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 font-mono text-[10px] font-bold text-indigo-700">
                  {sourceLabel(rubric.source)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-transparent p-2 text-slate-400 transition-all hover:border-slate-200 hover:bg-[#F8FAFC]"
            >
              <X className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC]/60 px-4 py-5 sm:px-6 sm:py-6">
          <div className="space-y-3">
            {criteria.map((criterion, index) => {
              const isExpanded =
                String(expandedCriterionId) === String(criterion.id);

              return (
                <div
                  key={criterion.id || index}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedCriterionId(
                        isExpanded ? "" : criterion.id
                      )
                    }
                    className={`flex w-full items-center justify-between gap-4 p-4 text-left transition-all ${
                      isExpanded
                        ? "border-b border-slate-100 bg-blue-50/60"
                        : "bg-white hover:bg-blue-50/30"
                    }`}
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Criterion {index + 1}
                      </p>

                      <h3 className="mt-1 font-serif text-base font-bold text-slate-950">
                        {criterion.name}
                      </h3>

                      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {criterion.description}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[10px] font-bold text-blue-700">
                        {criterion.points} pts
                      </span>

                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-blue-600" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="space-y-4 p-4">
                      <p className="text-xs leading-relaxed text-slate-600">
                        {criterion.description}
                      </p>

                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        {criterion.bands?.map((band) => (
                          <div
                            key={band.id}
                            className="rounded-xl border border-slate-200 bg-[#F8FAFC] p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-slate-900">
                                {band.label}
                              </p>

                              <span className="font-mono text-[10px] font-bold text-blue-700">
                                {band.points} pts
                              </span>
                            </div>

                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                              {band.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 z-20 flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 text-xs font-bold sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-slate-500 transition-all hover:bg-[#F8FAFC]"
          >
            Close
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700"
          >
            <Pencil className="h-4 w-4" />
            Edit rubric
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function EmptyState({ onAction }) {
  return (
    <div className="p-12 text-center bg-[#F8FAFC]">
      <ClipboardList className="w-9 h-9 mx-auto text-slate-300 stroke-[1.5] mb-3" />

      <h3 className="font-serif font-bold text-slate-900">
        No rubric records found
      </h3>

      <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto leading-relaxed">
        Create a rubric, attach one to an assignment, or adjust the filters.
      </p>

      <button
        type="button"
        onClick={onAction}
        className="mt-5 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-sm shadow-blue-600/20"
      >
        <Plus className="w-4 h-4" />
        Create Rubric
      </button>
    </div>
  );
}

function SourceCard({ active, icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition-all ${
        active
          ? "bg-white border-blue-300 ring-4 ring-blue-500/10"
          : "bg-white border-slate-200 hover:border-blue-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-blue-600" />

        <p className="text-xs font-bold text-slate-900">{title}</p>
      </div>

      <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
        {description}
      </p>
    </button>
  );
}

function SummaryBox({ label, value, icon: Icon }) {
  return (
    <div className="rounded-xl bg-[#F8FAFC] border border-slate-200 p-4 transition-all duration-300 hover:-translate-y-0.5 shadow-sm flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 stroke-[1.8]" />
      </div>

      <div className="min-w-0 space-y-0.5">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-slate-400 block truncate">
          {label}
        </span>

        <p className="font-mono text-sm font-bold text-slate-900 truncate">
          {value}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`inline-flex text-[9px] font-mono border px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
        active
          ? "bg-blue-50 text-blue-700 border-blue-100"
          : "bg-slate-100 text-slate-500 border-slate-200"
      }`}
    >
      {active ? "Active" : "Draft"}
    </span>
  );
}

function SourceBadge({ source }) {
  return (
    <span className="inline-flex text-[9px] font-mono border px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border-indigo-100">
      {sourceLabel(source)}
    </span>
  );
}