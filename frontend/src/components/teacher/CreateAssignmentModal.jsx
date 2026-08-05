import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { useTeacherWorkspace } from "../../hooks/useTeacherWorkspace";
import { authenticatedFetch } from "../../services/auth";
import {
  clearAssignmentBuilderDraft,
  getAssignmentBuilderDraft,
  saveAssignmentBuilderDraft,
} from "../../services/teacherApi";

import {
  ASSIGNMENT_TYPES,
  DEFAULT_AI_SUPPORT_SETTINGS,
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
const AI_ENDPOINT = "/api/generate";
const RUBRIC_PARSE_ENDPOINT = "/api/rubric/parse";
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

  const [creationMode, setCreationMode] = useState("");
  const [draftAssignmentId, setDraftAssignmentId] = useState("");

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
          creationMode ||
        String(title || "").trim() ||
          String(description || "").trim() ||
          String(course || "").trim() ||
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
      creationMode,
      title,
      description,
      course,
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

  useEffect(() => {
    if (editingAssignment) return;

    let active = true;
    getAssignmentBuilderDraft().then((parsed) => {
      if (!active || !parsed || typeof parsed !== "object") return;

      // Recover unfinished form data, but always reopen a new-assignment flow
      // at Creation mode. Restoring the previous wizard position made the
      // modal appear to skip Step 1 without the teacher choosing anything in
      // the current session.
      setStep(1);
      // Legacy frontend-only drafts used timestamps as assignment IDs.
      // Supabase assignments use UUIDs, so retain the recovered form fields
      // but create a fresh backend row instead of PATCHing a numeric ID.
      setDraftAssignmentId(
        isUuid(parsed.draftAssignmentId) ? String(parsed.draftAssignmentId) : ""
      );
      setCreationMode(parsed.creationMode === "manual" ? "manual" : parsed.creationMode === "ai" ? "ai" : "");
      setTitle(String(parsed.title || ""));
      setDescription(String(parsed.description || ""));
      setCourse(String(parsed.course || ""));
      setDueDate(String(parsed.dueDate || ""));
      {
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
      }
      setStudentLevel(String(parsed.studentLevel || "B1"));
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
    }).catch((error) => {
      console.error("Could not restore the Supabase assignment draft:", error);
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
      console.error("Could not clear the Supabase assignment draft:", error);
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

      creationMode: creationMode || "manual",

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
    let persistedDraftId = "";

    if (!editingAssignment && hasDraftProgress) {
      try {
        persistedDraftId = await persistDraftAssignmentRecord();
      } catch (error) {
        console.error("Could not save assignment draft to Supabase:", error);
      }

      await saveAssignmentBuilderDraft({
        ...draftSnapshot,
        draftAssignmentId: persistedDraftId || draftAssignmentId || "",
      });
    }
    onClose();
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
    setStudentLevel(editingAssignment.studentLevel || "B1");
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
      });

      const contentType = response.headers.get("content-type") || "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok || data?.success === false) {
        throw new Error(
          data?.error ||
            `Rubric parsing failed with status ${response.status}.`
        );
      }

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
        error?.message ||
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
      const response = await authenticatedFetch(AI_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
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
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Rubric generation failed with status ${response.status}.`
        );
      }

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
      const response = await authenticatedFetch(AI_ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...buildAuthHeaders(),
        },
        body: JSON.stringify({
          system: buildAssignmentGenerationSystemPrompt(),
          messages: [
            {
              role: "user",
              content: buildAssignmentGenerationUserPrompt({
                teacherRequest,
                availableCourses: selectableClasses,
                currentDate: new Date().toISOString(),
                gradeScale,
                rubricTitle,
                criteria,
                uploadedRubricText,
              }),
            },
          ],
          maxTokens: 1500,
          temperature: 0.25,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Assignment generation failed with status ${response.status}.`
        );
      }

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
        generated.languageLevel || "B1"
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
        generated.dueDate || getDefaultDueDateValue(7)
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
        selectableClasses[0] ||
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
      Only the explicit action button rendered on Step 4 may create
      or update an assignment. Steps 1–3 have no form submission path.
    */
    if (step !== 5) {
      return;
    }

    if (!canContinueDetails) return;

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
      if (editingAssignment) {
        await onUpdate({
          ...editingAssignment,
          ...assignment,
        });
      } else if (isUuid(draftAssignmentId)) {
        await onUpdate({
          id: draftAssignmentId,
          ...assignment,
        });
      } else {
        await onCreate(assignment);
      }
    } catch (error) {
      console.error("Assignment save failed:", error);
      setGenerationError(
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
        onClick={closeModalAndKeepDraft}
      />

      <div
        ref={modalScrollRef}
        className="assignment-builder-readable relative z-10 bg-white border border-slate-200 rounded-3xl shadow-2xl w-[calc(100vw-2rem)] max-w-[1500px] p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto animate-fade-in-up"
      >
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <h2 className="text-2xl font-serif font-black text-slate-950">
              {editingAssignment ? "Edit Assignment" : "Create Assignment"}
            </h2>

            <p className="text-base text-slate-600 font-medium leading-relaxed lg:whitespace-nowrap">
              Choose the creation mode first, then configure rubric, details, student support, and review the assignment before saving.
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

        <div
          className="space-y-6"
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
              description={description}
              course={course}
              classes={selectableClasses}
              dueDate={dueDate}
              minWords={minWords}
              maxWords={maxWords}
              assignmentType={resolvedAssignmentType || assignmentType}
              studentLevel={studentLevel}
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
