import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  BookOpen,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { useTeacherWorkspace } from "../../contexts/TeacherWorkspaceContext";

import {
  DEFAULT_AI_SUPPORT_SETTINGS,
  STEP_ITEMS,
} from "./create-assignment/constants";

import {
  buildBands,
  calculateTotal,
  createId,
  createStarterCriteria,
  normalizeCriterion,
  safeArray,
} from "./create-assignment/rubricUtils";

import { buildAuthHeaders } from "./create-assignment/authUtils";

import {
  buildAssignmentGenerationSystemPrompt,
  buildAssignmentGenerationUserPrompt,
  normalizeGeneratedAssignment,
} from "./create-assignment/promptUtils";

import StepPill from "./create-assignment/shared/StepPill";

import RubricSetupStep from "./create-assignment/steps/RubricSetupStep";
import AssignmentDetailsStep from "./create-assignment/steps/AssignmentDetailsStep";
import SettingsStep from "./create-assignment/steps/SettingsStep";
import ReviewStep from "./create-assignment/steps/ReviewStep";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const AI_ENDPOINT = `${API_BASE_URL}/api/generate`;
const RUBRIC_PARSE_ENDPOINT = `${API_BASE_URL}/api/rubric/parse`;

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
    const merged = [...safeArray(rubrics), ...safeArray(reusableRubrics)];
    const seen = new Set();

    return merged.filter((rubric) => {
      const key = String(rubric.id || rubric.title || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rubrics, reusableRubrics]);

  const [step, setStep] = useState(1);

  const modalScrollRef = useRef(null);

  const [creationMode, setCreationMode] = useState("ai");

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
  const [studentLevel, setStudentLevel] = useState("B1");
  const [feedbackChecks, setFeedbackChecks] = useState(2);
  const [ideaRequestLimit, setIdeaRequestLimit] = useState(3);

  const [aiTopic, setAiTopic] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
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

  const hasValidWordRange =
    Number(minWords || 0) > 0 &&
    Number(maxWords || 0) >= Number(minWords || 0);

  const canContinueDetails =
    creationMode === "ai"
      ? Boolean(
          generatedDraft &&
            title.trim() &&
            description.trim() &&
            course &&
            dueDate &&
            aiBrief.trim() &&
            hasValidWordRange
        )
      : Boolean(
          title.trim() &&
            description.trim() &&
            course &&
            dueDate &&
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

    setAssignmentType(editingAssignment.assignmentType || "Response");
    setStudentLevel(editingAssignment.studentLevel || "B1");
    setFeedbackChecks(editingAssignment.feedbackRequestLimit ?? 2);
    setIdeaRequestLimit(editingAssignment.ideaRequestLimit ?? 3);

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
      !canContinueRubric
    ) {
      return;
    }

    if (
      step === 2 &&
      !canContinueDetails
    ) {
      return;
    }

    if (
      step === 3 &&
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

      const response = await fetch(RUBRIC_PARSE_ENDPOINT, {
        method: "POST",
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
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
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
                `Assignment type: ${assignmentType}`,
                `English level: ${studentLevel}`,
                `Word range: ${minWords}-${maxWords}`,
                aiBrief.trim() ? `Teacher brief: ${aiBrief.trim()}` : "",
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
                        description: "What the teacher evaluates",
                        points: 25,
                        bands: [
                          {
                            label: "Excellent",
                            points: 25,
                            description: "Clear performance description",
                          },
                          {
                            label: "Proficient",
                            points: 19,
                            description: "Clear performance description",
                          },
                          {
                            label: "Developing",
                            points: 13,
                            description: "Clear performance description",
                          },
                          {
                            label: "Beginning",
                            points: 6,
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
                "- Make the total exactly 100 points.",
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
        throw new Error("Claude returned a rubric without criteria.");
      }

      const normalizedCriteria = generatedCriteria.map(normalizeCriterion);

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
        error?.message || "Claude could not generate the rubric right now."
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
            points: 10,
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
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
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
          "Claude did not return student-facing assignment instructions."
        );
      }

      setGeneratedDraft(generated);
      setTitle(generatedTitle);
      setDescription(generatedInstructions);
      setAiTopic(generatedTitle);

      setAssignmentType(
        generated.assignmentType || "Response"
      );

      setStudentLevel(
        generated.languageLevel || "B1"
      );

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
        Math.max(
          0,
          Number(generated.feedbackRequestLimit ?? 2)
        )
      );

      setIdeaRequestLimit(
        Math.max(
          0,
          Number(generated.ideaRequestLimit ?? 3)
        )
      );

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
          "Claude could not generate the assignment right now."
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

  function handleSubmit() {
    /*
      HARD GUARD:
      Only the explicit action button rendered on Step 4 may create
      or update an assignment. Steps 1–3 have no form submission path.
    */
    if (step !== 4) {
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

    const normalizedIdeaRequestLimit = Math.max(
      0,
      Number(ideaRequestLimit || 0)
    );

    const normalizedFeedbackRequestLimit = Math.max(
      0,
      Number(feedbackChecks || 0)
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

      assignmentType,
      studentLevel,
      languageLevel: studentLevel,

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
      rubric: rubricSchema?.criteria || [],
      rubricCriteria: rubricSchema?.criteria || [],
      rubricSkipped: false,

      uploadedRubricName: rubricSchema?.uploadedRubricName || "",
      uploadedRubricText: rubricSchema?.uploadedRubricText || "",
    };

    if (editingAssignment) {
      onUpdate({
        ...editingAssignment,
        ...assignment,
      });
    } else {
      onCreate(assignment);
    }

    onClose();
  }

  const modalContent = (
    <div className="fixed inset-0 z-[2147483647] flex items-center justify-center p-2 overflow-y-auto">
      <div
        className="absolute inset-0 z-0 bg-slate-950/55 backdrop-blur-md"
        onClick={onClose}
      />

      <div
        ref={modalScrollRef}
        className="relative z-10 bg-white border border-slate-200 rounded-3xl shadow-2xl w-[calc(100vw-2rem)] max-w-[1500px] p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto animate-fade-in-up"
      >
        <div className="flex items-start justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div className="space-y-1">
            <span className="text-[9px] font-mono font-bold tracking-widest text-blue-700 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100 inline-flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" />
              Assignment Builder
            </span>

            <h2 className="text-2xl font-serif font-black text-slate-950">
              {editingAssignment ? "Edit Assignment" : "Create Assignment"}
            </h2>

            <p className="text-xs text-slate-500 font-medium max-w-2xl leading-relaxed">
              Choose AI-assisted or manual setup, attach a rubric, configure
              student support, and review the assignment before saving.
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
          {STEP_ITEMS.map((item) => (
            <StepPill
              key={item.id}
              step={item}
              active={step === item.id}
              completed={step > item.id}
            />
          ))}
        </div>

        <div
          className="space-y-6"
          data-assignment-builder-step={step}
        >
          {step === 1 && (
            <RubricSetupStep
              creationMode={creationMode}
              setCreationMode={setCreationMode}
              startManualRubric={startManualRubric}
              savedRubricOptions={savedRubricOptions}
              reusableRubrics={reusableRubrics}
              rubricMode={rubricMode}
              setRubricMode={setRubricMode}
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

          {step === 2 && (
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
              studentLevel={studentLevel}
              setStudentLevel={setStudentLevel}
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

          {step === 3 && (
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

          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
                <p className="font-mono text-[9px] font-black uppercase tracking-[0.16em] text-blue-700">
                  Step 4 · Final Review
                </p>
                <p className="mt-1 text-xs text-blue-800">
                  Review every value below. The assignment is not created until you select the final Create Assignment button.
                </p>
              </div>

              <ReviewStep
              creationMode={creationMode}
              title={title}
              description={description}
              course={course}
              classes={selectableClasses}
              dueDate={dueDate}
              minWords={minWords}
              maxWords={maxWords}
              assignmentType={assignmentType}
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
                generatedDraft={generatedDraft}
              />
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={step === 1 ? onClose : goBack}
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

            {step < 4 ? (
              <button
                type="button"
                onClick={goNext}
                disabled={
                  (step === 1 && !canContinueRubric) ||
                  (step === 2 && !canContinueDetails) ||
                  isGeneratingRubric
                }
                className={`inline-flex items-center justify-center gap-2 text-xs px-5 py-2.5 rounded-xl transition-all tracking-wide font-bold ${
                  (step === 1 && !canContinueRubric) ||
                  (step === 2 && !canContinueDetails) ||
                  isGeneratingRubric
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/20"
                }`}
              >
                {isGeneratingRubric && step === 3
                  ? "Generating rubric..."
                  : step === 3
                  ? "Continue to Review"
                  : "Continue"}
                {!isGeneratingRubric && <ArrowRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 py-2.5 rounded-xl transition-all tracking-wide font-bold shadow-sm shadow-blue-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />

                <span>
                  {editingAssignment ? "Save Assignment" : "Create Assignment"}
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
    throw new Error("Claude did not return a readable rubric JSON object.");
  }

  try {
    return JSON.parse(cleanedText.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    throw new Error("Claude returned rubric content that was not valid JSON.");
  }
}