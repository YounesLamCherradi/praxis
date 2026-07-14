import { getText, safeArray } from "./rubricUtils";

const MAX_INSTRUCTION_WORDS = 170;
const MAX_DESCRIPTION_WORDS = 28;

export function extractJsonFromText(text) {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // Continue below.
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s?/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function limitWords(text, maxWords) {
  const clean = stripMarkdown(text);
  const words = clean.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) return clean;

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function buildShortDescription(text) {
  const clean = stripMarkdown(text);
  const firstSentence = clean.match(/[^.!?]+[.!?]/)?.[0] || clean;

  return limitWords(firstSentence, MAX_DESCRIPTION_WORDS);
}

export function formatCriteriaForPrompt(criteria = []) {
  if (!Array.isArray(criteria) || criteria.length === 0) return "";

  return criteria
    .map((criterion, index) => {
      const bands = safeArray(criterion.bands || criterion.levels)
        .slice(0, 5)
        .map((band) => {
          const label = band.label || "Level";
          const points = band.points ?? band.score ?? 0;
          const description = limitWords(band.description || "", 22);

          return `   - ${label} (${points} pts): ${description}`;
        })
        .join("\n");

      const criterionDescription = limitWords(
        criterion.description || "No description",
        24
      );

      return `${index + 1}. ${criterion.name || `Criterion ${index + 1}`} (${
        criterion.points || criterion.maxScore || 0
      } pts): ${criterionDescription}${bands ? `\n${bands}` : ""}`;
    })
    .join("\n\n");
}

export function formatIntegritySettingsForPrompt(settings = {}) {
  const enabledRules = [];

  if (settings.pastePolicy) {
    enabledRules.push(`Paste policy: ${settings.pastePolicy}`);
  }

  if (settings.logPasteAttempts) {
    enabledRules.push("Log paste attempts");
  }

  if (settings.trackFocusLoss) {
    enabledRules.push("Track focus loss and tab switching");
  }

  if (settings.requireHonorConfirmation) {
    enabledRules.push("Require academic honor confirmation before submission");
  }

  if (settings.enforceWordCount) {
    enabledRules.push("Enforce word count before submission");
  }

  enabledRules.push("Lock editing after submission");

  return enabledRules.join("\n");
}

export function normalizeGeneratedAssignment(data) {
  const responseText = data?.response || data?.reply || data?.message || "";

  const parsed = extractJsonFromText(responseText);

  if (!parsed) {
    const cleanInstructions = limitWords(responseText, MAX_INSTRUCTION_WORDS);

    return {
      title: "",
      instructions: cleanInstructions,
      description: buildShortDescription(cleanInstructions),
      requirements: [],
      rawText: responseText,
    };
  }

  const rawInstructions = getText(
    parsed.instructions ||
      parsed.studentInstructions ||
      parsed.prompt ||
      parsed.description ||
      ""
  );

  const cleanInstructions = limitWords(rawInstructions, MAX_INSTRUCTION_WORDS);

  const rawDescription = getText(
    parsed.description ||
      parsed.summary ||
      cleanInstructions ||
      ""
  );

  const requirements = Array.isArray(parsed.requirements)
    ? parsed.requirements
        .map(getText)
        .map((item) => limitWords(item, 14))
        .filter(Boolean)
        .slice(0, 4)
    : [];

  return {
    title: getText(parsed.title || parsed.assignmentTitle || ""),
    instructions: cleanInstructions,
    description: buildShortDescription(rawDescription),
    requirements,
    suggestedMinWords: parsed.minWords ?? parsed.suggestedMinWords ?? "",
    suggestedMaxWords: parsed.maxWords ?? parsed.suggestedMaxWords ?? "",
    rawText: responseText,
  };
}

export function buildAssignmentGenerationSystemPrompt() {
  return `
You are Praxis Assignment Builder, an assistant for teachers.

You help teachers create student-ready writing assignments.

Critical output rules:
- Create only assignment instructions, not a student answer.
- Do not write a sample essay.
- Do not complete the assignment for students.
- Keep the student instructions short: 120 to 160 words maximum.
- Keep the teacher-facing description to one short sentence.
- Do not use long section headings like "Introduction", "Body Paragraphs", "Conclusion", "Language and Style", or "Before you submit".
- Do not create a long checklist.
- Do not repeat the due date in the instructions unless it is necessary.
- Do not repeat the full word count checklist if the word count is already provided.
- Do not use markdown formatting such as **bold**, headings, or long bullet lists.
- Use clear student-friendly wording.
- Respect the teacher's selected English level, assignment type, word count, due date, AI support settings, and academic integrity settings.
- If AI support is disabled, do not mention AI support in the student instructions.
- If AI support is enabled, mention it in only one concise sentence.
- If academic integrity settings are included, mention them in only one concise sentence.
- If a rubric is provided, align the assignment with the rubric, but do not summarize the entire rubric.
- If auto-build outline from coach chat is enabled, describe it only as notes/outline support, not sentence generation.
- Do not tell students that AI will write paragraphs, sentences, or the assignment for them.
- The final assignment should feel like a clean prompt, not a full lesson document.

Return ONLY valid JSON with this exact shape:
{
  "title": "assignment title",
  "description": "one short teacher-facing summary sentence",
  "instructions": "student-facing instructions in 120 to 160 words maximum, no markdown",
  "requirements": ["short requirement 1", "short requirement 2", "short requirement 3"],
  "suggestedMinWords": 120,
  "suggestedMaxWords": 400
}
`;
}

export function buildAssignmentGenerationUserPrompt({
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
  integritySettings,
}) {
  const rubricText = includeRubricInPrompt
    ? [
        rubricTitle ? `Rubric title: ${rubricTitle}` : "",
        formatCriteriaForPrompt(criteria),
        uploadedRubricText
          ? `Uploaded rubric source text, use only for alignment and do not summarize it:\n${uploadedRubricText.slice(
              0,
              1800
            )}`
          : "",
      ]
        .filter(Boolean)
        .join("\n\n")
    : "Do not use rubric context.";

  const normalizedCoachLimit = Number(coachTimeLimitMinutes || 15);

  const aiSupportText = includeStudentAiSupportInPrompt
    ? [
        allowAI
          ? `AI ideas coach is enabled. Students can use it for up to ${normalizedCoachLimit} minutes for brainstorming and planning.`
          : "AI ideas coach is disabled. Do not mention AI brainstorming support.",

        allowAI && autoBuildOutlineFromCoach
          ? "Auto-build outline from coach chat is enabled. Mention only that students can convert their coach chat into a notes-only outline before drafting."
          : "Auto-build outline from coach chat is disabled.",

        aiFeedback
          ? `AI draft feedback is enabled. Students may request feedback up to ${feedbackChecks || 0} time(s).`
          : "AI draft feedback is disabled. Do not mention AI feedback support.",

        writingPlayback
          ? "Writing playback is enabled for teacher review. Do not explain this in detail to students."
          : "Writing playback is disabled.",
      ].join("\n")
    : "Do not mention platform AI support in the student-facing instructions.";

  const integrityText = includeIntegritySettingsInPrompt
    ? formatIntegritySettingsForPrompt({
        ...integritySettings,
        lockAfterSubmission: true,
      })
    : "Do not mention academic integrity settings in the student-facing instructions unless necessary.";

  return `
Teacher wants to create a writing assignment.

Topic / prompt idea:
${aiTopic || "No topic provided."}

Teacher brief:
${aiBrief || "No additional brief provided."}

Assignment type:
${assignmentType || "Not specified"}

Student English level:
${studentLevel || "Not specified"}

Word count:
Minimum words: ${minWords || "Not specified"}
Maximum words: ${maxWords || "Not specified"}

Feedback checks allowed:
${feedbackChecks || 0}

Due date:
${dueDate || "Not specified"}

Student AI support settings:
${aiSupportText}

Academic integrity settings:
${integrityText}

Rubric context:
${rubricText}

Now create a clean student-ready assignment draft.

Very important:
- The instructions must be short.
- Maximum 160 words.
- No markdown.
- No long headings.
- No long checklist.
- Mention essay structure in one sentence only.
- Mention AI support in one concise sentence only if enabled.
- Mention integrity/submission rules in one concise sentence only if included.
- The requirements array should contain only 3 or 4 short items.
`;
}