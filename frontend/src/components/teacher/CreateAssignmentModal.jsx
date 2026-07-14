import React, { useEffect, useMemo, useState } from "react";
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
  DEFAULT_INTEGRITY_SETTINGS,
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

  const [creationMode, setCreationMode] = useState("ai");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [course, setCourse] = useState(
    defaultClass?.code ||
      classes.find((cls) => String(cls.id) === String(defaultClassId))?.code ||
      classes[0]?.code ||
      ""
  );

  const [dueDate, setDueDate] = useState("");

  const [assignmentType, setAssignmentType] = useState("Response");
  const [studentLevel, setStudentLevel] = useState("B1");
  const [feedbackChecks, setFeedbackChecks] = useState(2);

  const [aiTopic, setAiTopic] = useState("");
  const [aiBrief, setAiBrief] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationSuccess, setGenerationSuccess] = useState("");
  const [generatedDraft, setGeneratedDraft] = useState(null);

  const [includeRubricInPrompt, setIncludeRubricInPrompt] = useState(true);

  const [includeStudentAiSupportInPrompt, setIncludeStudentAiSupportInPrompt] =
    useState(true);

  const [includeIntegritySettingsInPrompt, setIncludeIntegritySettingsInPrompt] =
    useState(false);

  const [minWords, setMinWords] = useState(250);
  const [maxWords, setMaxWords] = useState(400);

  const [allowAI, setAllowAI] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.aiIdeasCoach
  );

  const [coachTimeLimitMinutes, setCoachTimeLimitMinutes] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.coachTimeLimitMinutes
  );

  const [aiFeedback, setAiFeedback] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.aiDraftFeedback
  );

  const [writingPlayback, setWritingPlayback] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.writingPlayback
  );

  const [autoBuildOutlineFromCoach, setAutoBuildOutlineFromCoach] = useState(
    DEFAULT_AI_SUPPORT_SETTINGS.autoBuildOutlineFromCoach
  );

  const [integritySettings, setIntegritySettings] = useState(
    DEFAULT_INTEGRITY_SETTINGS
  );

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
      classes.find((cls) => cls.code === course || cls.name === course) ||
      classes.find((cls) => String(cls.id) === String(defaultClassId)) ||
      null
    );
  }, [classes, course, defaultClassId]);

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
            aiTopic.trim() &&
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
      if (!course && classes[0]?.code) {
        setCourse(classes[0].code);
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

    setAiTopic(editingAssignment.aiTopic || editingAssignment.topic || "");
    setAiBrief(editingAssignment.aiBrief || "");

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

    setAllowAI(
      editingAssignment.aiIdeasCoach ??
        editingAssignment.allowAI ??
        DEFAULT_AI_SUPPORT_SETTINGS.aiIdeasCoach
    );

    setCoachTimeLimitMinutes(
      editingAssignment.coachTimeLimitMinutes ??
        editingAssignment.aiCoachTimeLimitMinutes ??
        DEFAULT_AI_SUPPORT_SETTINGS.coachTimeLimitMinutes
    );

    setAiFeedback(
      editingAssignment.aiDraftFeedback ??
        editingAssignment.aiFeedback ??
        DEFAULT_AI_SUPPORT_SETTINGS.aiDraftFeedback
    );

    setWritingPlayback(
      editingAssignment.saveWritingPlayback ??
        editingAssignment.writingPlayback ??
        DEFAULT_AI_SUPPORT_SETTINGS.writingPlayback
    );

    setAutoBuildOutlineFromCoach(
      editingAssignment.autoBuildOutlineFromCoach ??
        editingAssignment.generateOutlineFromCoach ??
        DEFAULT_AI_SUPPORT_SETTINGS.autoBuildOutlineFromCoach
    );

    setIntegritySettings({
      ...DEFAULT_INTEGRITY_SETTINGS,
      ...(editingAssignment.integritySettings || {}),
      lockAfterSubmission: true,
    });

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
  }, [editingAssignment, classes, course]);

  function updateIntegritySetting(field, value) {
    if (field === "lockAfterSubmission") return;

    setIntegritySettings((prev) => ({
      ...prev,
      [field]: value,
      lockAfterSubmission: true,
    }));
  }

  async function goNext() {
    if (step === 1 && !canContinueRubric) return;
    if (step === 2 && !canContinueDetails) return;

    if (step === 3 && rubricMode === "generated" && !criteria.length) {
      const generatedSuccessfully = await handleGenerateRubric();

      if (!generatedSuccessfully) {
        return;
      }
    }

    setStep((prev) => Math.min(prev + 1, 4));
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

    if (!aiTopic.trim()) {
      setGenerationError("Please enter a topic or assignment idea first.");
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
                aiTopic,
                aiBrief,
                assignmentType,
                studentLevel,
                minWords,
                maxWords,
                feedbackChecks,
                dueDate,
                includeRubricInPrompt,
                rubricTitle,
                criteria,
                uploadedRubricText,
                includeStudentAiSupportInPrompt,
                allowAI,
                coachTimeLimitMinutes,
                aiFeedback,
                writingPlayback,
                autoBuildOutlineFromCoach,
                includeIntegritySettingsInPrompt,
                integritySettings: {
                  ...integritySettings,
                  lockAfterSubmission: true,
                },
              }),
            },
          ],
          maxTokens: 1000,
          temperature: 0.35,
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

      setGeneratedDraft(generated);

      if (generated.title) {
        setTitle(generated.title);
      }

      if (generated.instructions) {
        setDescription(generated.instructions);
      }

      if (generated.suggestedMinWords) {
        setMinWords(generated.suggestedMinWords);
      }

      if (generated.suggestedMaxWords) {
        setMaxWords(generated.suggestedMaxWords);
      }

      setGenerationSuccess(
        "Assignment draft generated. Review and edit it before continuing."
      );
    } catch (error) {
      console.error("Assignment generation error:", error);

      setGenerationError(
        error?.message ||
          "Claude could not generate the assignment draft right now."
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

  function handleSubmit(e) {
    e.preventDefault();

    if (!canContinueDetails) return;

    const rubricSchema = buildRubricPayload();

    const cleanedIntegritySettings = {
      pastePolicy:
        integritySettings.pastePolicy ||
        DEFAULT_INTEGRITY_SETTINGS.pastePolicy ||
        "warn",
      logPasteAttempts:
        integritySettings.logPasteAttempts ??
        DEFAULT_INTEGRITY_SETTINGS.logPasteAttempts ??
        true,
      requireHonorConfirmation:
        integritySettings.requireHonorConfirmation ??
        DEFAULT_INTEGRITY_SETTINGS.requireHonorConfirmation ??
        true,
      enforceWordCount:
        integritySettings.enforceWordCount ??
        DEFAULT_INTEGRITY_SETTINGS.enforceWordCount ??
        true,
      lockAfterSubmission: true,
    };

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    const normalizedCoachTimeLimit = Math.max(
      1,
      Number(coachTimeLimitMinutes || DEFAULT_AI_SUPPORT_SETTINGS.coachTimeLimitMinutes || 15)
    );

    const outlineEnabled = Boolean(allowAI && autoBuildOutlineFromCoach);

    const assignment = {
      title: cleanTitle,
      description: cleanDescription,
      instructions: cleanDescription,
      prompt: cleanDescription,

      creationMode,

      aiTopic: aiTopic.trim(),
      aiBrief: aiBrief.trim(),
      generatedDraft,

      assignmentType,
      studentLevel,

      classId: selectedCourse?.id || null,
      classCode: selectedCourse?.code || course,
      className: selectedCourse?.name || course,

      dueDate,

      status: editingAssignment ? editingAssignment.status : "Draft",

      minWords: Number(minWords),
      maxWords: Number(maxWords),
      wordCountMin: Number(minWords),
      wordCountMax: Number(maxWords),

      feedbackRequestLimit: Number(feedbackChecks || 0),

      allowAI,
      aiIdeasCoach: allowAI,
      ideationAI: allowAI,

      coachTimeLimitMinutes: normalizedCoachTimeLimit,
      aiCoachTimeLimitMinutes: normalizedCoachTimeLimit,

      aiFeedback,
      aiDraftFeedback: aiFeedback,

      writingPlayback,
      saveWritingPlayback: writingPlayback,

      autoBuildOutlineFromCoach: outlineEnabled,
      generateOutlineFromCoach: outlineEnabled,

      aiSupportSettings: {
        aiIdeasCoach: allowAI,
        coachTimeLimitMinutes: normalizedCoachTimeLimit,
        aiDraftFeedback: aiFeedback,
        writingPlayback,
        autoBuildOutlineFromCoach: outlineEnabled,
      },

      integritySettings: cleanedIntegritySettings,

      pastePolicy: cleanedIntegritySettings.pastePolicy,
      logPasteAttempts: cleanedIntegritySettings.logPasteAttempts,
      requireHonorConfirmation: cleanedIntegritySettings.requireHonorConfirmation,
      enforceWordCount: cleanedIntegritySettings.enforceWordCount,
      lockAfterSubmission: true,

      // Legacy fields intentionally disabled because they are no longer part of
      // the teacher-facing integrity settings.
      detectLargeInsertions: false,
      largeInsertionThreshold: null,
      disableDragDrop: false,

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

      <div className="relative z-10 bg-white border border-slate-200 rounded-3xl shadow-2xl w-[calc(100vw-2rem)] max-w-[1500px] p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto animate-fade-in-up">
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

        <form onSubmit={handleSubmit} className="space-y-6">
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
              classes={classes}
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
              aiTopic={aiTopic}
              setAiTopic={setAiTopic}
              aiBrief={aiBrief}
              setAiBrief={setAiBrief}
              allowAI={allowAI}
              coachTimeLimitMinutes={coachTimeLimitMinutes}
              autoBuildOutlineFromCoach={autoBuildOutlineFromCoach}
              aiFeedback={aiFeedback}
              writingPlayback={writingPlayback}
              integritySettings={cleanedIntegritySettingsForPrompt(integritySettings)}
              includeRubricInPrompt={includeRubricInPrompt}
              setIncludeRubricInPrompt={setIncludeRubricInPrompt}
              includeStudentAiSupportInPrompt={includeStudentAiSupportInPrompt}
              setIncludeStudentAiSupportInPrompt={setIncludeStudentAiSupportInPrompt}
              includeIntegritySettingsInPrompt={includeIntegritySettingsInPrompt}
              setIncludeIntegritySettingsInPrompt={setIncludeIntegritySettingsInPrompt}
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
              autoBuildOutlineFromCoach={autoBuildOutlineFromCoach}
              setAutoBuildOutlineFromCoach={setAutoBuildOutlineFromCoach}
              aiFeedback={aiFeedback}
              setAiFeedback={setAiFeedback}
              writingPlayback={writingPlayback}
              setWritingPlayback={setWritingPlayback}
              integritySettings={{
                ...integritySettings,
                lockAfterSubmission: true,
              }}
              updateIntegritySetting={updateIntegritySetting}
            />
          )}

          {step === 4 && (
            <ReviewStep
              creationMode={creationMode}
              title={title}
              description={description}
              course={course}
              classes={classes}
              dueDate={dueDate}
              minWords={minWords}
              maxWords={maxWords}
              assignmentType={assignmentType}
              studentLevel={studentLevel}
              feedbackChecks={feedbackChecks}
              allowAI={allowAI}
              coachTimeLimitMinutes={coachTimeLimitMinutes}
              autoBuildOutlineFromCoach={autoBuildOutlineFromCoach}
              aiFeedback={aiFeedback}
              writingPlayback={writingPlayback}
              integritySettings={{
                ...integritySettings,
                lockAfterSubmission: true,
              }}
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
                  : "Continue"}
                {!isGeneratingRubric && <ArrowRight className="w-4 h-4" />}
              </button>
            ) : (
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-5 py-2.5 rounded-xl transition-all tracking-wide font-bold shadow-sm shadow-blue-600/20"
              >
                <CheckCircle2 className="w-4 h-4" />

                <span>
                  {editingAssignment ? "Save Assignment" : "Create Assignment"}
                </span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

function cleanedIntegritySettingsForPrompt(settings = {}) {
  return {
    pastePolicy:
      settings.pastePolicy ||
      DEFAULT_INTEGRITY_SETTINGS.pastePolicy ||
      "warn",
    logPasteAttempts:
      settings.logPasteAttempts ??
      DEFAULT_INTEGRITY_SETTINGS.logPasteAttempts ??
      true,
    requireHonorConfirmation:
      settings.requireHonorConfirmation ??
      DEFAULT_INTEGRITY_SETTINGS.requireHonorConfirmation ??
      true,
    enforceWordCount:
      settings.enforceWordCount ??
      DEFAULT_INTEGRITY_SETTINGS.enforceWordCount ??
      true,
    lockAfterSubmission: true,
  };
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
