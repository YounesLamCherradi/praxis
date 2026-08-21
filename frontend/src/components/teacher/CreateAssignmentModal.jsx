import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
} from "lucide-react";

import { useTeacherWorkspace } from "../../hooks/useTeacherWorkspace";
import { authenticatedFetch } from "../../services/auth";
import { runAiJob } from "../../services/aiJobs";
import {
  clearAssignmentBuilderDraft,
  getAssignmentBuilderDraft,
  saveAssignmentBuilderDraft,
} from "../../services/teacherApi";

import {
  ASSIGNMENT_TYPES,
  DEFAULT_AI_SUPPORT_SETTINGS,
  STUDENT_LEVELS,
} from "./create-assignment/constants";

import {
  buildBands,
  calculateTotal,
  createId,
  createStarterCriteria,
  fitCriteriaToTotal,
  normalizeCriterion,
  safeArray,
} from "./create-assignment/rubricUtils";

import { buildAuthHeaders } from "./create-assignment/authUtils";

import {
  buildAssignmentGenerationSystemPrompt,
  buildAssignmentGenerationUserPrompt,
  inferYearlessDueDate,
  normalizeGeneratedAssignment,
} from "./create-assignment/promptUtils";

import ModeSelectionStep from "./create-assignment/steps/ModeSelectionStep";
import RubricSetupStep from "./create-assignment/steps/RubricSetupStep";
import AssignmentDetailsStep from "./create-assignment/steps/AssignmentDetailsStep";
import SettingsStep from "./create-assignment/steps/SettingsStep";
import ReviewStep from "./create-assignment/steps/ReviewStep";

// Keep authenticated browser requests on the frontend origin. In production,
// Netlify proxies /api to Render and preserves the secure session cookie. A
// direct cross-origin Render request cannot use the cookie set on Netlify.
const RUBRIC_PARSE_ENDPOINT = "/api/rubric/parse-jobs";
const RUBRIC_PARSE_TIMEOUT_MS = 120_000;
const RUBRIC_PARSE_POLL_INTERVAL_MS = 1_200;

function waitForRubricPoll() {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, RUBRIC_PARSE_POLL_INTERVAL_MS);
  });
}

function normalizeStudentLevelOption(value) {
  const level = String(value || "").trim();
  return STUDENT_LEVELS.includes(level) ? level : "B1";
}

async function readRubricResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const responseText = await response.text();
  const isHtmlError = /<!doctype\s+html|<html[\s>]/i.test(responseText);

  return {
    error: isHtmlError
      ? `The rubric service returned an unexpected response (${response.status}). Please try again.`
      : responseText,
  };
}

async function waitForRubricParseJob(jobId) {
  const deadline = Date.now() + RUBRIC_PARSE_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const response = await authenticatedFetch(
      `${RUBRIC_PARSE_ENDPOINT}/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        timeoutMs: 20_000,
        retryDelaysMs: [500, 1_200],
      }
    );
    const data = await readRubricResponse(response);

    if (response.status === 202 && data?.status === "processing") {
      await waitForRubricPoll();
      continue;
    }

    if (!response.ok || data?.success === false) {
      throw new Error(
        data?.error || `Rubric parsing failed with status ${response.status}.`
      );
    }

    return data;
  }

  throw new Error(
    "Rubric parsing is taking longer than expected. Please try again."
  );
}
function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

function getDefaultDueDateValue(daysFromNow = 7) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(23, 59, 0, 0);

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return local.toISOString().slice(0, 16);
}

function normalizeCourseKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function clampInteger(
  value,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY
) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  const normalized = Number.isFinite(parsed) ? parsed : minimum;
  return Math.max(minimum, Math.min(maximum, normalized));
}

export default function CreateAssignmentModal({
  classes = [],
  assignments = [],
  publishedAssignments = [],
  reusableRubrics = [],
  defaultClassId = "",
  defaultClass = null,
  onClose,
  onCreate,
  onUpdate,
  editingAssignment = null,
}) {
  const { rubrics = [] } = useTeacherWorkspace() || {};

  const activeClasses = useMemo(
    () => classes.filter((course) => course?.archived !== true),
    [classes]
  );

  const selectableClasses = useMemo(() => {
    const options = [...activeClasses];

    if (!editingAssignment) {
      return options;
    }

    const editingClass =
      classes.find((cls) => {
        const sameId =
          editingAssignment.classId !== null &&
          editingAssignment.classId !== undefined &&
          String(cls.id) === String(editingAssignment.classId);

        const sameCode =
          editingAssignment.classCode &&
          cls.code &&
          String(cls.code).toUpperCase() ===
            String(editingAssignment.classCode).toUpperCase();

        return sameId || sameCode;
      }) || null;

    if (
      editingClass &&
      !options.some((cls) => String(cls.id) === String(editingClass.id))
    ) {
      options.push(editingClass);
    }

    return options;
  }, [activeClasses, classes, editingAssignment]);

  const savedRubricOptions = useMemo(() => {
    const assignmentRubrics = safeArray(assignments)
      .map((assignment) => {
        const schema =
          assignment?.rubricSchema ||
          (assignment?.rubric && !Array.isArray(assignment.rubric)
            ? assignment.rubric
            : null);
        if (!schema || !safeArray(schema.criteria).length) return null;
        return {
          ...schema,
          id:
            schema.id ||
            assignment.rubricId ||
            `assignment-rubric-${assignment.id}`,
          title:
            schema.title ||
            assignment.rubricTitle ||
            `${assignment.title || "Assignment"} rubric`,
          sourceAssignmentId: assignment.id,
          sourceAssignmentTitle: assignment.title || "",
        };
      })
      .filter(Boolean);

    const merged = [
      ...safeArray(rubrics),
      ...safeArray(reusableRubrics),
      ...assignmentRubrics,
    ];
    const seen = new Set();

    return merged.filter((rubric) => {
      const key = String(rubric.id || rubric.title || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assignments, rubrics, reusableRubrics]);

  const [step, setStep] = useState(1);

  const modalScrollRef = useRef(null);

  const [creationMode, setCreationMode] = useState("ai");
  const [draftAssignmentId, setDraftAssignmentId] = useState("");
  const [pendingDraft, setPendingDraft] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftConfirmation, setDraftConfirmation] = useState(null);
  const [isClosingDraft, setIsClosingDraft] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [course, setCourse] = useState(() => {
    const defaultCourse =
      defaultClass?.archived !== true
        ? defaultClass?.code ||
          selectableClasses.find(
            (cls) => String(cls.id) === String(defaultClassId)
          )?.code ||
          ""
        : "";

    if (defaultCourse) return defaultCourse;

    return selectableClasses.length === 1
      ? selectableClasses[0].code || selectableClasses[0].name || ""
      : "";
  });

  const [dueDate, setDueDate] = useState("");

  const [assignmentType, setAssignmentType] = useState("Response");
  const [assignmentTypeCustom, setAssignmentTypeCustom] = useState("");
  const [studentLevel, setStudentLevel] = useState("B1");
  const [gradeScale, setGradeScale] = useState(20);
  const [feedbackChecks, setFeedbackChecks] = useState(2);
  const [ideaRequestLimit, setIdeaRequestLimit] = useState(0);

  const [aiTopic, setAiTopic] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignmentSaveError, setAssignmentSaveError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [generationSuccess, setGenerationSuccess] = useState("");
  const [generatedDraft, setGeneratedDraft] = useState(null);

  const [includeRubricInPrompt, setIncludeRubricInPrompt] = useState(true);

  const [includeStudentAiSupportInPrompt, setIncludeStudentAiSupportInPrompt] =
    useState(true);

  const [minWords, setMinWords] = useState(250);
  const [maxWords, setMaxWords] = useState(400);

  const [allowAI, setAllowAI] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.aiIdeasCoach
  );

  const [coachTimeLimitMinutes, setCoachTimeLimitMinutes] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.coachTimeLimitMinutes
  );

  const [autoBuildOutlineFromCoach, setAutoBuildOutlineFromCoach] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.autoBuildOutlineFromCoach
  );

  // Old logic: feedback is enabled by a positive request limit.
  const aiFeedback = Number(feedbackChecks || 0) > 0;

  const [rubricMode, setRubricMode] = useState("");
  const [selectedRubricId, setSelectedRubricId] = useState("");
  const [rubricTitle, setRubricTitle] = useState("");
  const [uploadedRubricName, setUploadedRubricName] = useState("");
  const [uploadedRubricText, setUploadedRubricText] = useState("");
  const [criteria, setCriteria] = useState([]);

  const [parsedRubricSchema, setParsedRubricSchema] = useState(null);
  const [parsedRubricMatrix, setParsedRubricMatrix] = useState(null);
  const [isParsingRubric, setIsParsingRubric] = useState(false);
  const [rubricParseError, setRubricParseError] = useState("");
  const [rubricParseSuccess, setRubricParseSuccess] = useState("");

  const [isGeneratingRubric, setIsGeneratingRubric] = useState(false);
  const [rubricGenerationError, setRubricGenerationError] = useState("");
  const [rubricGenerationSuccess, setRubricGenerationSuccess] = useState("");

  const [rubricView, setRubricView] = useState("preview");
  const [expandedCriterionId, setExpandedCriterionId] = useState("");

  const selectedSavedRubric = useMemo(() => {
    return savedRubricOptions.find(
      (rubric) => String(rubric.id) === String(selectedRubricId)
    );
  }, [savedRubricOptions, selectedRubricId]);

  const selectedCourse = useMemo(() => {
    return (
      selectableClasses.find(
        (cls) => cls.code === course || cls.name === course
      ) ||
      selectableClasses.find(
        (cls) => String(cls.id) === String(defaultClassId)
      ) ||
      null
    );
  }, [selectableClasses, course, defaultClassId]);

  const rubricTotal = calculateTotal(criteria);
  const effectiveGradeScale =
    rubricMode === "generated"
      ? clampInteger(gradeScale, 1, 500)
      : clampInteger(rubricTotal || gradeScale, 1, 500);
  const resolvedAssignmentType =
    assignmentType === "Other"
      ? String(assignmentTypeCustom || "").trim()
      : assignmentType;

  const draftSnapshot = useMemo(
    () => ({
      step,
      draftAssignmentId,
      creationMode,
      title,
      description,
      course,
      dueDate,
      assignmentType,
      assignmentTypeCustom,
      studentLevel,
      gradeScale,
      feedbackChecks,
      ideaRequestLimit,
      aiTopic,
      aiBrief,
      generatedDraft,
      includeRubricInPrompt,
      includeStudentAiSupportInPrompt,
      minWords,
      maxWords,
      allowAI,
      coachTimeLimitMinutes,
      autoBuildOutlineFromCoach,
      rubricMode,
      selectedRubricId,
      rubricTitle,
      uploadedRubricName,
      uploadedRubricText,
      criteria,
      parsedRubricSchema,
      parsedRubricMatrix,
      rubricView,
      expandedCriterionId,
    }),
    [
      step,
      draftAssignmentId,
      creationMode,
      title,
      description,
      course,
      dueDate,
      assignmentType,
      assignmentTypeCustom,
      studentLevel,
      gradeScale,
      feedbackChecks,
      ideaRequestLimit,
      aiTopic,
      aiBrief,
      generatedDraft,
      includeRubricInPrompt,
      includeStudentAiSupportInPrompt,
      minWords,
      maxWords,
      allowAI,
      coachTimeLimitMinutes,
      autoBuildOutlineFromCoach,
      rubricMode,
      selectedRubricId,
      rubricTitle,
      uploadedRubricName,
      uploadedRubricText,
      criteria,
      parsedRubricSchema,
      parsedRubricMatrix,
      rubricView,
      expandedCriterionId,
    ]
  );

  const hasDraftProgress = useMemo(
    () =>
      Boolean(
        Number(step || 1) > 1 ||
          String(title || "").trim() ||
          String(description || "").trim() ||
          String(dueDate || "").trim() ||
          String(aiBrief || "").trim() ||
          String(rubricTitle || "").trim() ||
          String(assignmentTypeCustom || "").trim() ||
          rubricMode ||
          selectedRubricId ||
          String(uploadedRubricText || "").trim() ||
          safeArray(criteria).length > 0 ||
          generatedDraft ||
          Number(minWords || 0) !== 250 ||
          Number(maxWords || 0) !== 400 ||
          Boolean(allowAI) !== Boolean(DEFAULT_AI_SUPPORT_SETTINGS.aiIdeasCoach) ||
          Number(coachTimeLimitMinutes || 0) !== Number(DEFAULT_AI_SUPPORT_SETTINGS.coachTimeLimitMinutes || 0) ||
          Boolean(autoBuildOutlineFromCoach) !== Boolean(DEFAULT_AI_SUPPORT_SETTINGS.autoBuildOutlineFromCoach)
      ),
    [
      step,
      title,
      description,
      dueDate,
      aiBrief,
      rubricTitle,
      assignmentTypeCustom,
      rubricMode,
      selectedRubricId,
      uploadedRubricText,
      criteria,
      generatedDraft,
      minWords,
      maxWords,
      allowAI,
      coachTimeLimitMinutes,
      autoBuildOutlineFromCoach,
    ]
  );

  const uploadedRubricReady =
    rubricMode !== "uploaded" ||
    Boolean(
      !isParsingRubric &&
        !rubricParseError &&
        parsedRubricSchema &&
        criteria.length > 0
    );

  const canContinueRubric =
    (rubricMode === "uploaded" &&
      rubricTitle.trim() &&
      uploadedRubricReady) ||
    (rubricMode === "saved" && selectedRubricId) ||
    rubricMode === "generated" ||
    (rubricMode === "manual" &&
      rubricTitle.trim() &&
      criteria.length > 0);

  const canContinueMode =
    creationMode === "ai" || creationMode === "manual";

  function applySavedDraft(parsed) {
    if (!parsed || typeof parsed !== "object") return;
    setStep(1);
    const restoredDraftId = String(parsed.draftAssignmentId || "");
    const isCurrentTeacherDraft =
      isUuid(restoredDraftId) &&
      assignments.some(
        (assignment) => String(assignment?.id) === restoredDraftId
      );
    setDraftAssignmentId(isCurrentTeacherDraft ? restoredDraftId : "");
    setCreationMode(parsed.creationMode === "manual" ? "manual" : "ai");
    setTitle(String(parsed.title || ""));
    setDescription(String(parsed.description || ""));
    setCourse(String(parsed.course || ""));
    setDueDate(String(parsed.dueDate || ""));
    const parsedType = String(parsed.assignmentType || "").trim();
    if (ASSIGNMENT_TYPES.includes(parsedType) && parsedType !== "Other") {
      setAssignmentType(parsedType);
      setAssignmentTypeCustom(String(parsed.assignmentTypeCustom || ""));
    } else if (parsedType) {
      setAssignmentType("Other");
      setAssignmentTypeCustom(parsedType);
    } else {
      setAssignmentType("Response");
      setAssignmentTypeCustom(String(parsed.assignmentTypeCustom || ""));
    }
    setStudentLevel(normalizeStudentLevelOption(parsed.studentLevel));
    setGradeScale(clampInteger(parsed.gradeScale ?? 20, 1, 500));
    setFeedbackChecks(clampInteger(parsed.feedbackChecks ?? 2, 0, 20));
    setIdeaRequestLimit(clampInteger(parsed.ideaRequestLimit ?? 0, 0, 20));
    setAiTopic(String(parsed.aiTopic || ""));
    setAiBrief(String(parsed.aiBrief || ""));
    setGeneratedDraft(parsed.generatedDraft || null);
    setIncludeRubricInPrompt(parsed.includeRubricInPrompt !== false);
    setIncludeStudentAiSupportInPrompt(parsed.includeStudentAiSupportInPrompt !== false);
    setMinWords(Math.max(1, Number(parsed.minWords || 250)));
    setMaxWords(Math.max(1, Number(parsed.maxWords || 400)));
    setAllowAI(Boolean(parsed.allowAI));
    setCoachTimeLimitMinutes(Math.max(0, Number(parsed.coachTimeLimitMinutes || 0)));
    setAutoBuildOutlineFromCoach(Boolean(parsed.autoBuildOutlineFromCoach));
    setRubricMode(String(parsed.rubricMode || ""));
    setSelectedRubricId(String(parsed.selectedRubricId || ""));
    setRubricTitle(String(parsed.rubricTitle || ""));
    setUploadedRubricName(String(parsed.uploadedRubricName || ""));
    setUploadedRubricText(String(parsed.uploadedRubricText || ""));
    setCriteria(
      safeArray(parsed.criteria).length
        ? safeArray(parsed.criteria).map(normalizeCriterion)
        : []
    );
    setParsedRubricSchema(parsed.parsedRubricSchema || null);
    setParsedRubricMatrix(parsed.parsedRubricMatrix || null);
    setRubricView(parsed.rubricView === "edit" ? "edit" : "preview");
    setExpandedCriterionId(String(parsed.expandedCriterionId || ""));
    setPendingDraft(null);
    setDraftRestored(true);
  }

  useEffect(() => {
    if (editingAssignment) return;

    let active = true;
    getAssignmentBuilderDraft().then((parsed) => {
      if (!active || !parsed || typeof parsed !== "object") return;

      const hasRecoveredWork = Boolean(
        Number(parsed.step || 1) > 1 ||
          String(parsed.title || "").trim() ||
          String(parsed.description || "").trim() ||
          String(parsed.dueDate || "").trim() ||
          String(parsed.aiBrief || "").trim() ||
          String(parsed.rubricTitle || "").trim() ||
          String(parsed.rubricMode || "").trim() ||
          String(parsed.selectedRubricId || "").trim() ||
          String(parsed.uploadedRubricText || "").trim() ||
          safeArray(parsed.criteria).length > 0 ||
          parsed.generatedDraft
      );

      if (!hasRecoveredWork) {
        clearAssignmentBuilderDraft().catch(() => {});
        return;
      }

      setPendingDraft(parsed);
    }).catch((error) => {
      console.error("Could not restore the assignment draft from the database:", error);
    });
    return () => {
      active = false;
    };
  }, [editingAssignment]);

  useEffect(() => {
    if (editingAssignment) return;
    if (!hasDraftProgress) return;

    const timer = globalThis.setTimeout(() => {
      saveAssignmentBuilderDraft(draftSnapshot).catch((error) => {
        console.error("Could not autosave the assignment builder:", error);
      });
    }, 600);
    return () => globalThis.clearTimeout(timer);
  }, [editingAssignment, hasDraftProgress, draftSnapshot]);

  function clearLocalDraft() {
    clearAssignmentBuilderDraft().catch((error) => {
      console.error("Could not clear the assignment draft from the database:", error);
    });
    setDraftAssignmentId("");
  }

  async function persistDraftAssignmentRecord() {
    if (editingAssignment || !hasDraftProgress) {
      return "";
    }

    if (!onCreate || !onUpdate) {
      return "";
    }

    const hasClassReference = Boolean(
      selectedCourse?.id || String(course || "").trim()
    );

    if (!hasClassReference) {
      return "";
    }

    const cleanTitle = title.trim() || "Untitled draft assignment";
    const cleanDescription = description.trim();

    const normalizedCoachTimeLimit = allowAI
      ? Number.isFinite(Number(coachTimeLimitMinutes))
        ? Math.max(0, Number(coachTimeLimitMinutes))
        : 0
      : -1;

    const normalizedFeedbackRequestLimit = Math.max(
      0,
      Math.floor(Number(feedbackChecks || 0) || 0)
    );

    const outlineEnabled = Boolean(allowAI && autoBuildOutlineFromCoach);
    const rubricSchema = buildRubricPayload();

    const draftAssignment = {
      title: cleanTitle,
      description: cleanDescription,
      instructions: cleanDescription,
      prompt: cleanDescription,

      creationMode: creationMode || "ai",

      teacherRequest: aiBrief.trim(),
      aiTopic: aiTopic.trim(),
      aiBrief: aiBrief.trim(),
      generatedDraft,

      assignmentType: resolvedAssignmentType || "Other",
      studentLevel,
      languageLevel: studentLevel,
      gradeScale: effectiveGradeScale,

      classId: selectedCourse?.id || null,
      classCode: selectedCourse?.code || course,
      className: selectedCourse?.name || course,

      dueDate,
      status: "Draft",

      minWords: Number(minWords),
      maxWords: Number(maxWords),
      wordCountMin: Number(minWords),
      wordCountMax: Number(maxWords),

      ideaRequestLimit: 0,
      feedbackRequestLimit: normalizedFeedbackRequestLimit,

      allowAI,
      aiIdeasCoach: allowAI,
      ideationAI: allowAI,

      disableChatbot: !allowAI,
      chatTimeLimit: normalizedCoachTimeLimit,
      coachTimeLimitMinutes:
        normalizedCoachTimeLimit > 0 ? normalizedCoachTimeLimit : 0,
      aiCoachTimeLimitMinutes:
        normalizedCoachTimeLimit > 0 ? normalizedCoachTimeLimit : 0,

      aiFeedback: normalizedFeedbackRequestLimit > 0,
      aiDraftFeedback: normalizedFeedbackRequestLimit > 0,

      autoOutlineFromChat: outlineEnabled,
      autoBuildOutlineFromCoach: outlineEnabled,
      generateOutlineFromCoach: outlineEnabled,

      rubricSource: rubricMode,
      rubricId: rubricSchema?.id || null,
      rubricTitle: rubricSchema?.title || "",
      rubricSchema,
      rubricTotal: rubricSchema?.totalPoints || effectiveGradeScale,
      rubric: rubricSchema?.criteria || [],
      rubricCriteria: rubricSchema?.criteria || [],
      rubricSkipped: false,

      uploadedRubricName: rubricSchema?.uploadedRubricName || "",
      uploadedRubricText: rubricSchema?.uploadedRubricText || "",
    };

    if (isUuid(draftAssignmentId)) {
      await onUpdate({ id: draftAssignmentId, ...draftAssignment });
      return String(draftAssignmentId);
    }

    const createdDraft = await onCreate(draftAssignment);
    const createdId = String(createdDraft?.id || "");

    if (createdId) {
      setDraftAssignmentId(createdId);
    }

    return createdId;
  }

  async function closeModalAndKeepDraft() {
    if (hasDraftProgress) {
      setDraftConfirmation("close");
      return;
    }
    onClose();
  }

  function continueSavedDraft() {
    applySavedDraft(pendingDraft);
  }

  function startFreshAssignment() {
    setDraftConfirmation("fresh");
  }

  function discardDraftAndContinue() {
    if (!editingAssignment || draftConfirmation === "fresh") {
      clearLocalDraft();
    }
    setDraftConfirmation(null);

    if (draftConfirmation === "fresh") {
      setPendingDraft(null);
      setDraftRestored(false);
      return;
    }

    onClose();
  }

  async function saveDraftAndClose() {
    if (editingAssignment) {
      setDraftConfirmation(null);
      onClose();
      return;
    }

    setIsClosingDraft(true);
    try {
      await saveAssignmentBuilderDraft({
        ...draftSnapshot,
        draftAssignmentId: draftAssignmentId || "",
      });
      setDraftConfirmation(null);
      onClose();
    } catch (error) {
      console.error("Could not save the assignment draft before closing:", error);
      setGenerationError(
        "The draft could not be saved. Keep editing and try again."
      );
      setDraftConfirmation(null);
    } finally {
      setIsClosingDraft(false);
    }
  }

  const hasValidWordRange =
    Number(minWords || 0) > 0 &&
    Number(maxWords || 0) >= Number(minWords || 0);

  const hasValidAssignmentType =
    assignmentType !== "Other" || Boolean(String(assignmentTypeCustom || "").trim());

  const canContinueDetails =
    creationMode === "ai"
      ? Boolean(
          generatedDraft &&
            title.trim() &&
            description.trim() &&
            course &&
            dueDate &&
            aiBrief.trim() &&
            hasValidAssignmentType &&
            hasValidWordRange
        )
      : Boolean(
          title.trim() &&
            description.trim() &&
            course &&
            dueDate &&
            hasValidAssignmentType &&
            hasValidWordRange
        );

  useEffect(() => {
    if (!editingAssignment) {
      const courseIsSelectable = selectableClasses.some(
        (cls) => cls.code === course || cls.name === course
      );

      if (!courseIsSelectable) {
        setCourse(
          selectableClasses.length === 1
            ? selectableClasses[0].code || selectableClasses[0].name || ""
            : ""
        );
      }

      return;
    }

    setCreationMode(editingAssignment.creationMode || "manual");

    setTitle(editingAssignment.title || "");

    setDescription(
      editingAssignment.instructions || editingAssignment.description || ""
    );

    setCourse(editingAssignment.classCode || editingAssignment.className || "");
    setDueDate(editingAssignment.dueDate || "");

    {
      const existingType = String(editingAssignment.assignmentType || "").trim();
      if (ASSIGNMENT_TYPES.includes(existingType) && existingType !== "Other") {
        setAssignmentType(existingType);
        setAssignmentTypeCustom("");
      } else if (existingType) {
        setAssignmentType("Other");
        setAssignmentTypeCustom(existingType);
      } else {
        setAssignmentType("Response");
        setAssignmentTypeCustom("");
      }
    }
    setStudentLevel(normalizeStudentLevelOption(editingAssignment.studentLevel));
    setGradeScale(
      clampInteger(
        editingAssignment.gradeScale ??
          editingAssignment.rubricSchema?.totalPoints ??
          editingAssignment.rubricTotal ??
          20,
        1,
        500
      )
    );
    setFeedbackChecks(
      clampInteger(
        editingAssignment.feedbackRequestLimit ?? 2,
        0,
        20
      )
    );
    setIdeaRequestLimit(
      clampInteger(
        editingAssignment.ideaRequestLimit ?? 0,
        0,
        20
      )
    );

    setAiTopic(editingAssignment.aiTopic || editingAssignment.topic || "");
    setAiBrief(
      editingAssignment.teacherRequest ||
        editingAssignment.aiBrief ||
        editingAssignment.description ||
        editingAssignment.instructions ||
        ""
    );

    const existingGeneratedDraft =
      editingAssignment.generatedDraft ||
      (editingAssignment.creationMode === "ai" &&
      (editingAssignment.title ||
        editingAssignment.instructions ||
        editingAssignment.description)
        ? {
            title: editingAssignment.title || "",
            instructions:
              editingAssignment.instructions ||
              editingAssignment.description ||
              "",
          }
        : null);

    setGeneratedDraft(existingGeneratedDraft);

    setMinWords(editingAssignment.minWords || 250);
    setMaxWords(editingAssignment.maxWords || 400);

    const storedChatTimeLimit = Number(
      editingAssignment.chatTimeLimit ??
        editingAssignment.coachTimeLimitMinutes ??
        editingAssignment.aiCoachTimeLimitMinutes ??
        DEFAULT_AI_SUPPORT_SETTINGS.coachTimeLimitMinutes
    );

    const coachEnabled = Boolean(
      editingAssignment.disableChatbot !== true &&
        storedChatTimeLimit >= 0 &&
        (editingAssignment.aiIdeasCoach ??
          editingAssignment.allowAI ??
          DEFAULT_AI_SUPPORT_SETTINGS.aiIdeasCoach)
    );

    setAllowAI(coachEnabled);
    setCoachTimeLimitMinutes(
      coachEnabled && Number.isFinite(storedChatTimeLimit)
        ? Math.max(0, storedChatTimeLimit)
        : 0
    );

    setAutoBuildOutlineFromCoach(
      Boolean(
        coachEnabled &&
          (editingAssignment.autoOutlineFromChat ??
            editingAssignment.autoBuildOutlineFromCoach ??
            editingAssignment.generateOutlineFromCoach ??
            DEFAULT_AI_SUPPORT_SETTINGS.autoBuildOutlineFromCoach)
      )
    );

    const existingRubric = editingAssignment.rubricSchema;

    if (existingRubric) {
      const existingCriteria = existingRubric.criteria?.length
        ? existingRubric.criteria.map(normalizeCriterion)
        : createStarterCriteria();

      setRubricMode(
        existingRubric.source || editingAssignment.rubricSource || "manual"
      );

      setSelectedRubricId(
        String(editingAssignment.rubricId || existingRubric.id || "")
      );

      setRubricTitle(existingRubric.title || editingAssignment.rubricTitle || "");
      setUploadedRubricName(existingRubric.uploadedRubricName || "");
      setUploadedRubricText(existingRubric.uploadedRubricText || "");

      setParsedRubricSchema(existingRubric);
      setParsedRubricMatrix(existingRubric.rubricData || existingRubric.matrix || null);

      setCriteria(existingCriteria);
      setRubricView("preview");
      setExpandedCriterionId(existingCriteria[0]?.id || "");
    } else {
      setRubricMode("");
      setCriteria([]);
      setRubricTitle("");
      setRubricView("preview");
      setExpandedCriterionId("");
    }
  }, [editingAssignment, selectableClasses, course]);

  useEffect(() => {
    const container =
      modalScrollRef.current;

    if (!container) return;

    container.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [step]);

  async function goNext() {
    if (
      step === 1 &&
      !canContinueMode
    ) {
      return;
    }

    if (
      step === 2 &&
      !canContinueRubric
    ) {
      return;
    }

    if (
      step === 3 &&
      !canContinueDetails
    ) {
      return;
    }

    if (
      step === 4 &&
      rubricMode === "generated" &&
      !criteria.length
    ) {
      const generatedSuccessfully =
        await handleGenerateRubric();

      if (!generatedSuccessfully) {
        return;
      }
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    if (step === 2) {
      setStep(3);
      return;
    }

    if (step === 3) {
      setStep(4);
      return;
    }

    if (step === 4) {
      setStep(5);
    }
  }

  function goBack() {
    setStep((prev) => Math.max(prev - 1, 1));
  }

  function clearRubricParseMessages() {
    setRubricParseError("");
    setRubricParseSuccess("");
    setRubricGenerationError("");
    setRubricGenerationSuccess("");
  }

  function startGeneratedRubric() {
    setRubricMode("generated");
    clearRubricParseMessages();

    // A rubric from another source must never appear as the AI-generated one.
    setSelectedRubricId("");
    setRubricTitle("");
    setUploadedRubricName("");
    setUploadedRubricText("");
    setParsedRubricSchema(null);
    setParsedRubricMatrix(null);
    setCriteria([]);
    setExpandedCriterionId("");
    setRubricView("preview");
  }

  function handleSavedRubricSelection(rubricId) {
    setSelectedRubricId(rubricId);

    const rubric = savedRubricOptions.find(
      (item) => String(item.id) === String(rubricId)
    );

    if (!rubric) return;

    setRubricMode("saved");
    clearRubricParseMessages();

    setRubricTitle(rubric.title || "");
    setUploadedRubricName(rubric.uploadedRubricName || "");
    setUploadedRubricText(rubric.uploadedRubricText || rubric.rubricText || "");

    const rubricSchema =
      rubric.rubricSchema ||
      rubric.rubric ||
      rubric.schema ||
      rubric;

    setParsedRubricSchema(rubricSchema || null);
    setParsedRubricMatrix(rubric.rubricData || rubric.matrix || null);

    const nextCriteria =
      rubric.criteria ||
      rubric.rubric?.criteria ||
      rubric.rubricSchema?.criteria ||
      rubric.rubricCriteria ||
      [];

    const normalizedCriteria = nextCriteria?.length
      ? nextCriteria.map(normalizeCriterion)
      : createStarterCriteria();

    setCriteria(normalizedCriteria);
    setRubricView("preview");
    setExpandedCriterionId(normalizedCriteria[0]?.id || "");
  }

  function startManualRubric() {
    setRubricMode("manual");
    clearRubricParseMessages();

    setParsedRubricSchema(null);
    setParsedRubricMatrix(null);
    setUploadedRubricName("");
    setUploadedRubricText("");

    setRubricView("edit");

    if (!rubricTitle.trim()) {
      setRubricTitle("Assignment Rubric");
    }

    if (!criteria.length) {
      const starterCriteria = createStarterCriteria();
      setCriteria(starterCriteria);
      setExpandedCriterionId(starterCriteria[0]?.id || "");
    } else {
      setExpandedCriterionId(criteria[0]?.id || "");
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;

    setRubricMode("uploaded");
    setUploadedRubricName(file.name);
    clearRubricParseMessages();

    setParsedRubricSchema(null);
    setParsedRubricMatrix(null);
    setUploadedRubricText("");
    setCriteria([]);
    setExpandedCriterionId("");

    setRubricView("preview");
    setIsParsingRubric(true);

    if (!rubricTitle.trim()) {
      setRubricTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    try {
      const formData = new FormData();
      formData.append("rubric", file);

      const response = await authenticatedFetch(RUBRIC_PARSE_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          ...buildAuthHeaders(),
        },
        body: formData,
        timeoutMs: 20_000,
        retryDelaysMs: [],
      });
      const initialData = await readRubricResponse(response);

      if (!response.ok || initialData?.success === false) {
        throw new Error(
          initialData?.error ||
            `Rubric parsing failed with status ${response.status}.`
        );
      }

      const data = initialData?.jobId
        ? await waitForRubricParseJob(initialData.jobId)
        : initialData;

      const parsedSchema = data.schema || {};
      const parsedCriteria = safeArray(parsedSchema.criteria);

      if (!parsedCriteria.length) {
        throw new Error(
          "The upload was read, but no real rubric criteria were detected. Please upload a text-based PDF / Word file or paste the rubric text."
        );
      }

      const normalizedCriteria = parsedCriteria.map(normalizeCriterion);

      setParsedRubricSchema(parsedSchema);
      setParsedRubricMatrix(data.rubricData || null);
      setUploadedRubricText(data.text || "");

      setCriteria(normalizedCriteria);
      setRubricView("preview");
      setExpandedCriterionId(normalizedCriteria[0]?.id || "");

      setRubricTitle(
        parsedSchema.title ||
          file.name.replace(/\.[^/.]+$/, "") ||
          "Uploaded Rubric"
      );

      setRubricParseSuccess(
        `Rubric parsed successfully: ${
          parsedCriteria.length || 0
        } criteria detected.`
      );
    } catch (error) {
      console.error("Rubric upload parse error:", error);

      setParsedRubricSchema(null);
      setParsedRubricMatrix(null);
      setUploadedRubricText("");
      setCriteria([]);
      setExpandedCriterionId("");

      setRubricParseError(
        error?.name === "AbortError"
          ? "Rubric parsing took too long. Please try again; if the service was waking up, the next attempt should be faster."
          : error?.message ||
              "The rubric could not be parsed. Use a text-based PDF, Word file, or paste the rubric text."
      );
    } finally {
      setIsParsingRubric(false);
    }
  }

  async function handleGenerateRubric() {
    setRubricGenerationError("");
    setRubricGenerationSuccess("");
    setRubricParseError("");
    setRubricParseSuccess("");

    const generationTopic =
      aiTopic.trim() ||
      title.trim() ||
      aiBrief.trim() ||
      description.trim();

    if (!generationTopic) {
      setRubricGenerationError(
        "Enter an assignment topic, title, brief, or instructions before generating the rubric."
      );
      return false;
    }

    setRubricMode("generated");
    setIsGeneratingRubric(true);

    try {
      const data = await runAiJob("generate", {
          system:
            "You create practical classroom writing rubrics. Return only valid JSON with no markdown.",
          messages: [
            {
              role: "user",
              content: [
                "Generate a rubric for this writing assignment.",
                `Topic or title: ${generationTopic}`,
                `Assignment type: ${resolvedAssignmentType || assignmentType}`,
                `English level: ${studentLevel}`,
                `Required rubric total: ${gradeScale} points`,
                `Word range: ${minWords}-${maxWords}`,
                aiBrief.trim() ? `Instructor brief: ${aiBrief.trim()}` : "",
                description.trim()
                  ? `Current instructions: ${description.trim()}`
                  : "",
                "",
                "Return this exact JSON structure:",
                JSON.stringify(
                  {
                    title: "Assignment Rubric",
                    criteria: [
                      {
                        name: "Criterion name",
                        description: "What the instructor evaluates",
                        points: 5,
                        bands: [
                          {
                            label: "Excellent",
                            points: 5,
                            description: "Clear performance description",
                          },
                          {
                            label: "Proficient",
                            points: 4,
                            description: "Clear performance description",
                          },
                          {
                            label: "Developing",
                            points: 3,
                            description: "Clear performance description",
                          },
                          {
                            label: "Beginning",
                            points: 2,
                            description: "Clear performance description",
                          },
                        ],
                      },
                    ],
                  },
                  null,
                  2
                ),
                "",
                "Requirements:",
                "- Create 4 useful criteria.",
                `- Make the criterion maximum points add up to exactly ${gradeScale}.`,
                "- Give every criterion 4 score bands.",
                "- Keep descriptions specific, observable, and student-friendly.",
                "- Return JSON only.",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
          maxTokens: 1800,
          temperature: 0.25,
      });

      const generatedRubric = normalizeGeneratedRubricResponse(data);
      const generatedCriteria = safeArray(generatedRubric.criteria);

      if (!generatedCriteria.length) {
        throw new Error("AI returned a rubric without criteria.");
      }

      const normalizedCriteria = fitCriteriaToTotal(
        generatedCriteria,
        gradeScale
      );

      setRubricTitle(generatedRubric.title || "AI-Generated Rubric");
      setCriteria(normalizedCriteria);
      setParsedRubricSchema({
        ...generatedRubric,
        source: "generated",
        criteria: normalizedCriteria,
        totalPoints: calculateTotal(normalizedCriteria),
      });
      setParsedRubricMatrix(null);
      setUploadedRubricName("");
      setUploadedRubricText("");
      setSelectedRubricId("");
      setRubricView("preview");
      setExpandedCriterionId(normalizedCriteria[0]?.id || "");

      setRubricGenerationSuccess(
        `Rubric generated successfully: ${normalizedCriteria.length} criteria and ${calculateTotal(
          normalizedCriteria
        )} total points.`
      );

      return true;
    } catch (error) {
      console.error("Rubric generation error:", error);

      setCriteria([]);
      setParsedRubricSchema(null);
      setParsedRubricMatrix(null);
      setExpandedCriterionId("");

      setRubricGenerationError(
        error?.message || "AI could not generate the rubric right now."
      );

      return false;
    } finally {
      setIsGeneratingRubric(false);
    }
  }

  function updateCriterion(id, field, value) {
    setCriteria((prev) =>
      prev.map((criterion) =>
        criterion.id === id
          ? {
              ...criterion,
              [field]: field === "points" ? Number(value || 0) : value,
            }
          : criterion
      )
    );
  }

  function addCriterion() {
    setCriteria((prev) => {
      const nextCriteria = [
        ...prev,
        normalizeCriterion(
          {
            id: createId("criterion"),
            name: "",
            description: "",
            points: 5,
          },
          prev.length
        ),
      ];

      setExpandedCriterionId(nextCriteria[nextCriteria.length - 1]?.id || "");

      return nextCriteria;
    });

    setRubricView("edit");
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

        const updatedBands = criterion.bands.map((band) =>
          band.id === bandId
            ? {
                ...band,
                [field]: field === "points" ? Number(value || 0) : value,
              }
            : band
        );

        return {
          ...criterion,
          bands: updatedBands,
          levels: updatedBands.map((band) => ({
            id: band.id,
            label: band.label,
            score: band.points,
            points: band.points,
            description: band.description,
            tone: band.tone,
          })),
        };
      })
    );
  }

  function addBand(criterionId) {
    setCriteria((prev) =>
      prev.map((criterion) => {
        if (criterion.id !== criterionId) return criterion;

        const nextBands = [
          ...criterion.bands,
          {
            id: createId("band"),
            label: "Custom Level",
            points: 0,
            score: 0,
            description: "Describe this performance level.",
            tone: "satisfactory",
          },
        ];

        return {
          ...criterion,
          bands: nextBands,
          levels: nextBands.map((band) => ({
            id: band.id,
            label: band.label,
            score: band.points,
            points: band.points,
            description: band.description,
            tone: band.tone,
          })),
        };
      })
    );
  }

  function removeBand(criterionId, bandId) {
    setCriteria((prev) =>
      prev.map((criterion) => {
        if (criterion.id !== criterionId) return criterion;
        if (criterion.bands.length === 1) return criterion;

        const nextBands = criterion.bands.filter((band) => band.id !== bandId);

        return {
          ...criterion,
          bands: nextBands,
          levels: nextBands.map((band) => ({
            id: band.id,
            label: band.label,
            score: band.points,
            points: band.points,
            description: band.description,
            tone: band.tone,
          })),
        };
      })
    );
  }

  async function handleGenerateAssignmentDraft() {
    setGenerationError("");
    setGenerationSuccess("");

    const teacherRequest = aiBrief.trim();

    if (!teacherRequest) {
      setGenerationError(
        "Describe the assignment in the plain-English box first."
      );
      return;
    }

    setIsGenerating(true);
    setGeneratedDraft(null);

    try {
      const generationStartedAt = new Date();
      const data = await runAiJob("generate", {
          system: buildAssignmentGenerationSystemPrompt(),
          messages: [
            {
              role: "user",
              content: buildAssignmentGenerationUserPrompt({
                teacherRequest,
                availableCourses: selectableClasses,
                currentDate: generationStartedAt.toISOString(),
                gradeScale,
                rubricTitle,
                criteria,
                uploadedRubricText,
              }),
            },
          ],
          maxTokens: 1500,
          temperature: 0.25,
      });

      const generated = normalizeGeneratedAssignment(data);

      const generatedTitle =
        generated.title || "Generated Writing Assignment";

      const generatedInstructions =
        generated.instructions ||
        generated.description ||
        "";

      if (!generatedInstructions.trim()) {
        throw new Error(
          "AI did not return student-facing assignment instructions."
        );
      }

      setGeneratedDraft(generated);
      setTitle(generatedTitle);
      setDescription(generatedInstructions);
      setAiTopic(generatedTitle);

      {
        const generatedType = String(generated.assignmentType || "").trim();
        if (ASSIGNMENT_TYPES.includes(generatedType) && generatedType !== "Other") {
          setAssignmentType(generatedType);
          setAssignmentTypeCustom("");
        } else if (generatedType) {
          setAssignmentType("Other");
          setAssignmentTypeCustom(generatedType);
        } else {
          setAssignmentType("Response");
          setAssignmentTypeCustom("");
        }
      }

      setStudentLevel(
        normalizeStudentLevelOption(generated.languageLevel)
      );
      setGradeScale(clampInteger(generated.gradeScale ?? 20, 1, 500));

      setMinWords(
        Math.max(1, Number(generated.minWords || 250))
      );

      setMaxWords(
        Math.max(
          Math.max(1, Number(generated.minWords || 250)),
          Number(generated.maxWords || 400)
        )
      );

      setFeedbackChecks(
        clampInteger(
          generated.feedbackRequestLimit ?? 2,
          0,
          20
        )
      );

      setIdeaRequestLimit(0);

      setDueDate(
        inferYearlessDueDate(teacherRequest, generationStartedAt) ||
          generated.dueDate ||
          getDefaultDueDateValue(7)
      );

      const requestedCourseKey = normalizeCourseKey(
        generated.classCode ||
          generated.courseCode ||
          generated.className ||
          generated.classId
      );

      const generatedCourse =
        selectableClasses.find((item) => {
          const keys = [
            item?.id,
            item?.code,
            item?.name,
            `${item?.code || ""}${item?.name || ""}`,
          ].map(normalizeCourseKey);

          return (
            requestedCourseKey &&
            keys.includes(requestedCourseKey)
          );
        }) ||
        selectedCourse ||
        (selectableClasses.length === 1
          ? selectableClasses[0]
          : null) ||
        null;

      if (generatedCourse) {
        setCourse(
          generatedCourse.code ||
            generatedCourse.name ||
            generatedCourse.id ||
            ""
        );
      }

      const support = generated.aiSupport || {};

      const generatedTimeLimit = Number(
        support.chatTimeLimit ?? 0
      );

      const generatedCoachEnabled = Boolean(
        support.ideasCoach !== false &&
          generatedTimeLimit >= 0
      );

      setAllowAI(generatedCoachEnabled);

      setCoachTimeLimitMinutes(
        generatedCoachEnabled && Number.isFinite(generatedTimeLimit)
          ? Math.max(0, generatedTimeLimit)
          : 0
      );

      setAutoBuildOutlineFromCoach(
        Boolean(
          generatedCoachEnabled &&
            support.autoOutlineFromChat !== false
        )
      );

      setGenerationSuccess(
        "Assignment generated from your description. Review the generated fields, then continue."
      );
    } catch (error) {
      console.error("Assignment generation error:", error);

      setGenerationError(
        error?.message ||
          "AI could not generate the assignment right now."
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function buildRubricPayload() {
    const cleanedCriteria = criteria
      .map((criterion, index) =>
        normalizeCriterion(
          {
            ...criterion,
            name: String(criterion.name || "").trim(),
            description: String(criterion.description || "").trim(),
            points: Number(criterion.points || criterion.maxScore || 0),
            bands: safeArray(criterion.bands).map((band) => ({
              ...band,
              label: String(band.label || "").trim(),
              description: String(band.description || "").trim(),
              points: Number(band.points ?? band.score ?? 0),
              score: Number(band.points ?? band.score ?? 0),
            })),
          },
          index
        )
      )
      .filter((criterion) => criterion.name && criterion.points >= 0);

    if (rubricMode === "saved" && selectedSavedRubric) {
      return {
        ...selectedSavedRubric,
        id:
          editingAssignment?.rubricSchema?.id ||
          selectedSavedRubric.id ||
          createId("rubric"),
        title: rubricTitle || selectedSavedRubric.title,
        source: "saved",
        status: "Active",
        sourceAssignmentId: selectedSavedRubric.sourceAssignmentId || null,
        sourceAssignmentTitle: selectedSavedRubric.sourceAssignmentTitle || "",
        criteria: cleanedCriteria,
        totalPoints: calculateTotal(cleanedCriteria),
        rubricData: parsedRubricMatrix || selectedSavedRubric.rubricData || null,
      };
    }

    return {
      ...(parsedRubricSchema || {}),
      id:
        editingAssignment?.rubricSchema?.id ||
        parsedRubricSchema?.id ||
        createId("rubric"),
      title:
        rubricTitle.trim() ||
        parsedRubricSchema?.title ||
        `${title || "Assignment"} Rubric`,
      source: rubricMode,
      status: "Active",
      uploadedRubricName,
      uploadedRubricText,
      criteria: cleanedCriteria,
      totalPoints: calculateTotal(cleanedCriteria),
      rubricData: parsedRubricMatrix,
    };
  }

  async function handleSubmit() {
    if (isSavingAssignment) return;
    /*
      HARD GUARD:
      Only the explicit action button rendered on the final review step may
      create or update an assignment. Earlier steps have no submission path.
    */
    if (step !== 5) {
      return;
    }

    setAssignmentSaveError("");

    if (!canContinueDetails) {
      setAssignmentSaveError(
        "Some required assignment details are missing. Go back to Assignment details, complete the highlighted fields, then try again."
      );
      return;
    }

    const rubricSchema = buildRubricPayload();

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    const normalizedCoachTimeLimit = allowAI
      ? Number.isFinite(Number(coachTimeLimitMinutes))
        ? Math.max(0, Number(coachTimeLimitMinutes))
        : 0
      : -1;

    const outlineEnabled = Boolean(allowAI && autoBuildOutlineFromCoach);

    const normalizedIdeaRequestLimit = 0;

    const normalizedFeedbackRequestLimit = Math.max(
      0,
      Math.floor(Number(feedbackChecks || 0) || 0)
    );

    const aiFeedbackEnabled = normalizedFeedbackRequestLimit > 0;

    const assignment = {
      title: cleanTitle,
      description: cleanDescription,
      instructions: cleanDescription,
      prompt: cleanDescription,

      creationMode,

      teacherRequest: aiBrief.trim(),
      aiTopic: aiTopic.trim(),
      aiBrief: aiBrief.trim(),
      generatedDraft,

      assignmentType: resolvedAssignmentType || "Other",
      studentLevel,
      languageLevel: studentLevel,
      gradeScale: effectiveGradeScale,

      classId: selectedCourse?.id || null,
      classCode: selectedCourse?.code || course,
      className: selectedCourse?.name || course,

      dueDate,

      status: editingAssignment ? editingAssignment.status : "Draft",

      minWords: Number(minWords),
      maxWords: Number(maxWords),
      wordCountMin: Number(minWords),
      wordCountMax: Number(maxWords),

      ideaRequestLimit: normalizedIdeaRequestLimit,
      feedbackRequestLimit: normalizedFeedbackRequestLimit,

      allowAI,
      aiIdeasCoach: allowAI,
      ideationAI: allowAI,

      disableChatbot: !allowAI,
      chatTimeLimit: normalizedCoachTimeLimit,
      coachTimeLimitMinutes:
        normalizedCoachTimeLimit > 0 ? normalizedCoachTimeLimit : 0,
      aiCoachTimeLimitMinutes:
        normalizedCoachTimeLimit > 0 ? normalizedCoachTimeLimit : 0,

      aiFeedback: aiFeedbackEnabled,
      aiDraftFeedback: aiFeedbackEnabled,

      autoOutlineFromChat: outlineEnabled,
      autoBuildOutlineFromCoach: outlineEnabled,
      generateOutlineFromCoach: outlineEnabled,

      aiSupportSettings: {
        aiIdeasCoach: allowAI,
        chatTimeLimit: normalizedCoachTimeLimit,
        coachTimeLimitMinutes:
          normalizedCoachTimeLimit > 0 ? normalizedCoachTimeLimit : 0,
        ideaRequestLimit: normalizedIdeaRequestLimit,
        feedbackRequestLimit: normalizedFeedbackRequestLimit,
        aiDraftFeedback: aiFeedbackEnabled,
        autoOutlineFromChat: outlineEnabled,
        autoBuildOutlineFromCoach: outlineEnabled,
      },

      rubricSource: rubricMode,
      rubricId: rubricSchema?.id || null,
      rubricTitle: rubricSchema?.title || "",
      rubricSchema,
      rubricTotal: rubricSchema?.totalPoints || effectiveGradeScale,
      rubric: rubricSchema?.criteria || [],
      rubricCriteria: rubricSchema?.criteria || [],
      rubricSkipped: false,

      uploadedRubricName: rubricSchema?.uploadedRubricName || "",
      uploadedRubricText: rubricSchema?.uploadedRubricText || "",
    };

    setIsSavingAssignment(true);
    try {
      let savedAssignment = null;
      if (editingAssignment) {
        savedAssignment = await onUpdate({
          ...editingAssignment,
          ...assignment,
        });
      } else if (isUuid(draftAssignmentId)) {
        savedAssignment = await onUpdate({
          id: draftAssignmentId,
          ...assignment,
        });
      } else {
        savedAssignment = await onCreate(assignment);
      }

      if (!savedAssignment?.id) {
        throw new Error(
          editingAssignment
            ? "The assignment was not updated. Please try again."
            : "The assignment was not created. Please try again."
        );
      }
    } catch (error) {
      console.error("Assignment save failed:", error);
      setAssignmentSaveError(
        error?.conflict
          ? "This assignment changed elsewhere. Close and reopen it before saving."
          : error?.message || "The assignment could not be saved. Your local draft is still available."
      );
      return;
    } finally {
      setIsSavingAssignment(false);
    }

    clearLocalDraft();
    onClose();
  }

  const modalContent = (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-2 overflow-y-auto">
      <div
        className="absolute inset-0 z-0 bg-slate-950/55 backdrop-blur-md"
      />

      <div
        ref={modalScrollRef}
        className={`assignment-builder-readable relative z-10 my-6 max-h-[92vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl animate-fade-in-up sm:p-6 ${
          pendingDraft && !editingAssignment ? "max-w-[760px]" : "max-w-[1500px]"
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <h2 className="text-2xl font-serif font-black text-slate-950">
              {editingAssignment
                ? "Edit Assignment"
                : pendingDraft
                ? "Continue assignment draft"
                : "Create Assignment"}
            </h2>

            <p className="text-base text-slate-600 font-medium leading-relaxed lg:whitespace-nowrap">
              {pendingDraft && !editingAssignment
                ? "Review the recovered draft before deciding how to continue."
                : "Choose the creation mode first, then configure rubric, details, student support, and review the assignment before saving."}
            </p>
          </div>

          <button
            type="button"
            onClick={closeModalAndKeepDraft}
            className="p-2 rounded-xl hover:bg-[#F8FAFC] text-slate-400 border border-transparent hover:border-slate-200 transition-all"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {!editingAssignment && pendingDraft && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white text-blue-700 shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-950">
                  Welcome back — continue your draft?
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  We recovered this private assignment draft from your previous session.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="truncate text-base font-semibold text-slate-950">
                {String(pendingDraft.title || "Untitled assignment")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-medium text-slate-600">
                {pendingDraft.course && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    {pendingDraft.course}
                  </span>
                )}
                <span className="rounded-full bg-slate-100 px-2.5 py-1">
                  Step {Math.max(1, Number(pendingDraft.step || 1))} of 5
                </span>
                {pendingDraft.rubricTitle && (
                  <span className="max-w-full truncate rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">
                    Rubric: {pendingDraft.rubricTitle}
                  </span>
                )}
                {(pendingDraft.savedAt || pendingDraft.updatedAt) && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1">
                    Saved {new Date(pendingDraft.savedAt || pendingDraft.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={startFreshAssignment}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Discard and start fresh
              </button>
              <button
                type="button"
                onClick={continueSavedDraft}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                Continue draft
              </button>
            </div>
            <p className="mt-3 text-right text-[11px] text-slate-500">
              Discarding removes this recovered builder draft.
            </p>
          </div>
        )}

        {!editingAssignment && draftRestored && !pendingDraft && (
          <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Draft restored</p>
              <p className="mt-0.5">Your previous assignment details and rubric have been recovered.</p>
            </div>
          </div>
        )}

        <div
          className={pendingDraft && !editingAssignment ? "hidden" : "space-y-6"}
          data-assignment-builder-step={step}
        >
          {step === 1 && (
            <ModeSelectionStep
              creationMode={creationMode}
              setCreationMode={setCreationMode}
            />
          )}

          {step === 2 && (
            <RubricSetupStep
              startManualRubric={startManualRubric}
              savedRubricOptions={savedRubricOptions}
              reusableRubrics={reusableRubrics}
              rubricMode={rubricMode}
              setRubricMode={setRubricMode}
              startGeneratedRubric={startGeneratedRubric}
              selectedRubricId={selectedRubricId}
              handleSavedRubricSelection={handleSavedRubricSelection}
              rubricTitle={rubricTitle}
              setRubricTitle={setRubricTitle}
              uploadedRubricName={uploadedRubricName}
              handleFileUpload={handleFileUpload}
              isParsingRubric={isParsingRubric}
              rubricParseError={rubricParseError}
              rubricParseSuccess={rubricParseSuccess}
              isGeneratingRubric={isGeneratingRubric}
              rubricGenerationError={rubricGenerationError}
              rubricGenerationSuccess={rubricGenerationSuccess}
              handleGenerateRubric={handleGenerateRubric}
              parsedRubricSchema={parsedRubricSchema}
              parsedRubricMatrix={parsedRubricMatrix}
              criteria={criteria}
              rubricTotal={rubricTotal}
              rubricView={rubricView}
              setRubricView={setRubricView}
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
          )}

          {step === 3 && (
            <AssignmentDetailsStep
              creationMode={creationMode}
              classes={selectableClasses}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              course={course}
              setCourse={setCourse}
              dueDate={dueDate}
              setDueDate={setDueDate}
              minWords={minWords}
              setMinWords={setMinWords}
              maxWords={maxWords}
              setMaxWords={setMaxWords}
              assignmentType={assignmentType}
              setAssignmentType={setAssignmentType}
              assignmentTypeCustom={assignmentTypeCustom}
              setAssignmentTypeCustom={setAssignmentTypeCustom}
              studentLevel={studentLevel}
              setStudentLevel={setStudentLevel}
              gradeScale={gradeScale}
              setGradeScale={setGradeScale}
              rubricMode={rubricMode}
              feedbackChecks={feedbackChecks}
              setFeedbackChecks={setFeedbackChecks}
              ideaRequestLimit={ideaRequestLimit}
              setIdeaRequestLimit={setIdeaRequestLimit}
              aiTopic={aiTopic}
              setAiTopic={setAiTopic}
              aiBrief={aiBrief}
              setAiBrief={setAiBrief}
              allowAI={allowAI}
              coachTimeLimitMinutes={coachTimeLimitMinutes}
              autoBuildOutlineFromCoach={autoBuildOutlineFromCoach}
              aiFeedback={aiFeedback}
              includeRubricInPrompt={includeRubricInPrompt}
              setIncludeRubricInPrompt={setIncludeRubricInPrompt}
              includeStudentAiSupportInPrompt={includeStudentAiSupportInPrompt}
              setIncludeStudentAiSupportInPrompt={setIncludeStudentAiSupportInPrompt}
              isGenerating={isGenerating}
              generationError={generationError}
              generationSuccess={generationSuccess}
              generatedDraft={generatedDraft}
              handleGenerateAssignmentDraft={handleGenerateAssignmentDraft}
            />
          )}

          {step === 4 && (
            <SettingsStep
              allowAI={allowAI}
              setAllowAI={setAllowAI}
              coachTimeLimitMinutes={coachTimeLimitMinutes}
              setCoachTimeLimitMinutes={setCoachTimeLimitMinutes}
              ideaRequestLimit={ideaRequestLimit}
              setIdeaRequestLimit={setIdeaRequestLimit}
              autoBuildOutlineFromCoach={autoBuildOutlineFromCoach}
              setAutoBuildOutlineFromCoach={setAutoBuildOutlineFromCoach}
              feedbackChecks={feedbackChecks}
              setFeedbackChecks={setFeedbackChecks}
            />
          )}

          {step === 5 && (
            <div>
              <ReviewStep
              creationMode={creationMode}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              course={course}
              setCourse={setCourse}
              classes={selectableClasses}
              dueDate={dueDate}
              setDueDate={setDueDate}
              minWords={minWords}
              setMinWords={setMinWords}
              maxWords={maxWords}
              setMaxWords={setMaxWords}
              assignmentType={assignmentType}
              setAssignmentType={setAssignmentType}
              assignmentTypeCustom={assignmentTypeCustom}
              setAssignmentTypeCustom={setAssignmentTypeCustom}
              studentLevel={studentLevel}
              setStudentLevel={setStudentLevel}
              feedbackChecks={feedbackChecks}
              ideaRequestLimit={ideaRequestLimit}
              allowAI={allowAI}
              coachTimeLimitMinutes={coachTimeLimitMinutes}
              autoBuildOutlineFromCoach={autoBuildOutlineFromCoach}
              aiFeedback={Number(feedbackChecks || 0) > 0}
              rubricMode={rubricMode}
              rubricTitle={rubricTitle}
              selectedSavedRubric={selectedSavedRubric}
              uploadedRubricName={uploadedRubricName}
              parsedRubricSchema={parsedRubricSchema}
              parsedRubricMatrix={parsedRubricMatrix}
              criteria={criteria}
              rubricTotal={rubricTotal}
              isGeneratingRubric={isGeneratingRubric}
              onRegenerateRubric={handleGenerateRubric}
              onEditRubric={() => {
                setRubricView("edit");
                setStep(2);
              }}
                generatedDraft={generatedDraft}
              />
            </div>
          )}

          {step === 5 && assignmentSaveError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-medium text-rose-800"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <div>
                <p className="font-bold">Assignment not saved</p>
                <p className="mt-0.5 leading-relaxed">{assignmentSaveError}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={step === 1 ? closeModalAndKeepDraft : goBack}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-[#F8FAFC] transition-all text-xs font-bold"
            >
              {step === 1 ? (
                "Cancel"
              ) : (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </>
              )}
            </button>

            {step < 5 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  (step === 1 && !canContinueMode) ||
                  (step === 2 && !canContinueRubric) ||
                  (step === 3 && !canContinueDetails) ||
                  isGeneratingRubric
                }
                className={`inline-flex items-center justify-center gap-2 text-xs px-5 py-2.5 rounded-xl transition-all tracking-wide font-bold ${
                  (step === 1 && !canContinueMode) ||
                  (step === 2 && !canContinueRubric) ||
                  (step === 3 && !canContinueDetails) ||
                  isGeneratingRubric
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20"
                }`}
              >
                {isGeneratingRubric && step === 4
                  ? "Generating rubric..."
                  : step === 4
                  ? "Continue to Review"
                  : "Continue"}
                {!isGeneratingRubric && <ArrowRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSavingAssignment}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs px-5 py-2.5 rounded-xl transition-all tracking-wide font-bold shadow-sm shadow-blue-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />

                <span>
                  {isSavingAssignment
                    ? "Saving..."
                    : editingAssignment
                    ? "Save Assignment"
                    : "Create Assignment"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {draftConfirmation && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="assignment-draft-confirmation-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600">
                <X className="h-4 w-4" />
              </div>
              <div>
                <h3
                  id="assignment-draft-confirmation-title"
                  className="text-base font-semibold text-slate-950"
                >
                  {draftConfirmation === "fresh"
                    ? "Discard this recovered draft?"
                    : editingAssignment
                    ? "Discard unsaved changes?"
                    : "What would you like to do with this draft?"}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {draftConfirmation === "fresh"
                    ? "The recovered assignment details and rubric will be removed, and you will start with a clean assignment."
                    : editingAssignment
                    ? "Your changes to this assignment have not been saved."
                    : "Save it to continue later, keep working, or permanently discard the unfinished assignment."}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button
                type="button"
                onClick={() => setDraftConfirmation(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {draftConfirmation === "fresh" ? "Keep recovered draft" : "Keep editing"}
              </button>

              {draftConfirmation === "close" && !editingAssignment && (
                <button
                  type="button"
                  onClick={saveDraftAndClose}
                  disabled={isClosingDraft}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-60"
                >
                  {isClosingDraft ? "Saving..." : "Save and close"}
                </button>
              )}

              <button
                type="button"
                onClick={discardDraftAndContinue}
                disabled={isClosingDraft}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
              >
                {draftConfirmation === "fresh"
                  ? "Discard and start fresh"
                  : editingAssignment
                  ? "Discard changes"
                  : "Discard draft"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}

function normalizeGeneratedRubricResponse(data) {
  const direct =
    data?.rubric ||
    data?.result?.rubric ||
    data?.data?.rubric ||
    data?.result ||
    data?.data;

  if (direct && typeof direct === "object" && Array.isArray(direct.criteria)) {
    return direct;
  }

  const rawText =
    data?.content?.[0]?.text ||
    data?.content ||
    data?.text ||
    data?.message?.content ||
    data?.response ||
    data?.output ||
    "";

  if (typeof rawText === "object" && Array.isArray(rawText.criteria)) {
    return rawText;
  }

  const cleanedText = String(rawText)
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  const firstBrace = cleanedText.indexOf("{");
  const lastBrace = cleanedText.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("AI did not return a readable rubric JSON object.");
  }

  try {
    return JSON.parse(cleanedText.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    throw new Error("AI returned rubric content that was not valid JSON.");
  }
}
