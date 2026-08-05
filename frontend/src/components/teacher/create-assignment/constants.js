import {
  Wand2,
  ClipboardList,
  FileText,
  Settings,
  CheckCircle2,
} from "lucide-react";

export const STEP_ITEMS = [
  { id: 1, label: "Creation mode", icon: Wand2 },
  { id: 2, label: "Choose rubric", icon: ClipboardList },
  { id: 3, label: "Details", icon: FileText },
  { id: 4, label: "Settings", icon: Settings },
  { id: 5, label: "Review", icon: CheckCircle2 },
];

export const ASSIGNMENT_TYPES = [
  "Response",
  "Definition",
  "Argument",
  "Narrative",
  "Compare and Contrast",
  "Process Paragraph",
  "Reflection",
  "Summary",
  "Analysis",
  "Other",
];

export const STUDENT_LEVELS = [
  "A1",
  "A2",
  "B1",
  "B2",
  "C1",
  "C2",
  "Mixed level",
];

export const DEFAULT_CRITERIA = [
  {
    id: "criterion_argument",
    name: "Assignment Focus",
    description: "The writing clearly responds to the assigned topic and task.",
    points: 5,
  },
  {
    id: "criterion_development",
    name: "Development & Support",
    description: "The writing uses relevant examples, details, and explanation.",
    points: 5,
  },
  {
    id: "criterion_organization",
    name: "Organization",
    description: "The writing has a clear structure, logical flow, and coherence.",
    points: 5,
  },
  {
    id: "criterion_language",
    name: "Language & Style",
    description: "The writing uses appropriate grammar, vocabulary, and tone.",
    points: 5,
  },
];

export const DEFAULT_AI_SUPPORT_SETTINGS = {
  aiIdeasCoach: true,

  // Restored meaning: 0 = unlimited active Coach time.
  coachTimeLimitMinutes: 0,

  ideaRequestLimit: 0,
  feedbackRequestLimit: 2,
  autoBuildOutlineFromCoach: true,

  // Compatibility value derived from feedbackRequestLimit.
  aiDraftFeedback: true,
};
