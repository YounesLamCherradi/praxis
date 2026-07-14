const fs = require("node:fs");
const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const fetch = require("node-fetch");

const SYSTEM_PROMPT = `
You are an expert academic rubric parser.

Your job is to read raw rubric text, which may be messy, tab-separated, OCR'd, copied from a table, or extracted from a PDF/Word file.

Return a single valid JSON object that conforms EXACTLY to this schema:

{
  "title": string,
  "subtitle": string,
  "totalPoints": number,
  "notes": string[],
  "criteria": [
    {
      "id": string,
      "name": string,
      "minScore": number,
      "maxScore": number,
      "levels": [
        {
          "label": string,
          "score": number,
          "description": string
        }
      ]
    }
  ],
  "attribution": string
}

Rules:
- Output JSON only. No markdown fences. No explanation.
- Preserve the rubric's real criteria names.
- Preserve the rubric's real level labels.
- Keep levels ordered from highest score to lowest score.
- If a score range appears, use the higher score for that level, but keep minScore accurate.
- Put deduction rules, penalties, special instructions, or warnings into notes.
- Preserve meaningful wording from the source.
- Do not invent new criteria.
- Do not merge criteria that have their own point ranges.
- Rows with no criterion name and no point label are sub-parts of the criterion above them. Fold those descriptors into that criterion's level descriptions.
- For essay rubric patterns, criteria may include Task Response, Coherence and Cohesion, Vocabulary, Grammatical Accuracy, Organization, Sentence Variety, Grammar and Mechanics.
- If you see Task Response, Coherence and Cohesion, Vocabulary, and Grammatical Accuracy each with its own point label, return exactly 4 criteria.
- Always set totalPoints to the sum of criterion maxScore values.
- Never set totalPoints to 0 if criteria have points.
- If a field is missing, use an empty string or a sensible default.
`.trim();

function slugifyRubricId(value, fallback = "rubric-item") {
  const clean = String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return clean || fallback;
}

function roundToHalf(value) {
  return Math.round(Number(value || 0) * 2) / 2;
}

function getLevelTone(label = "", score = 0, maxScore = 0) {
  const lower = String(label || "").toLowerCase();
  const ratio = maxScore > 0 ? Number(score || 0) / maxScore : 0;

  if (lower.includes("excellent") || ratio >= 0.95) return "excellent";
  if (lower.includes("good") || ratio >= 0.8) return "good";
  if (lower.includes("satisfactory") || ratio >= 0.65) return "satisfactory";
  if (lower.includes("need") || lower.includes("improvement") || ratio >= 0.5) {
    return "needs-improvement";
  }

  return "unsatisfactory";
}

function normalizeLevel(level = {}, criterionId = "criterion", index = 0, maxScore = 0) {
  const label = String(level.label || "").trim() || `Level ${index + 1}`;
  const score = Number(level.score ?? level.points ?? 0);

  return {
    id:
      level.id ||
      `${slugifyRubricId(criterionId, "criterion")}-level-${index + 1}`,
    label,
    score,
    points: score,
    description: String(level.description || "").trim(),
    tone: getLevelTone(label, score, maxScore),
  };
}

function normalizeCriterion(criterion = {}, index = 0) {
  const rawLevels = Array.isArray(criterion.levels)
    ? criterion.levels
    : Array.isArray(criterion.bands)
    ? criterion.bands
    : [];

  const fallbackId = `criterion-${index + 1}`;
  const id = String(
    criterion.id ||
      slugifyRubricId(criterion.name || criterion.title || fallbackId, fallbackId)
  ).trim();

  const temporaryLevels = rawLevels
    .map((level, levelIndex) => ({
      label: String(level.label || "").trim() || `Level ${levelIndex + 1}`,
      score: Number(level.score ?? level.points ?? 0),
      description: String(level.description || "").trim(),
    }))
    .filter(
      (level) =>
        level.label ||
        level.description ||
        Number.isFinite(Number(level.score))
    )
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  const detectedMaxScore =
    Number(criterion.maxScore ?? criterion.points ?? 0) ||
    Math.max(...temporaryLevels.map((level) => Number(level.score || 0)), 0);

  const detectedMinScore =
    Number(criterion.minScore ?? 0) ||
    Math.min(...temporaryLevels.map((level) => Number(level.score || 0)), detectedMaxScore);

  const levels = temporaryLevels.map((level, levelIndex) =>
    normalizeLevel(level, id, levelIndex, detectedMaxScore)
  );

  if (!levels.length) return null;

  return {
    id,
    name: String(criterion.name || criterion.title || `Criterion ${index + 1}`).trim(),
    description: String(criterion.description || "").trim(),
    minScore: Number.isFinite(detectedMinScore) ? detectedMinScore : 0,
    maxScore: Number.isFinite(detectedMaxScore) ? detectedMaxScore : 0,

    // Keep both names so old and new frontend code can use the same parsed rubric.
    points: Number.isFinite(detectedMaxScore) ? detectedMaxScore : 0,
    levels,
    bands: levels.map((level) => ({
      id: level.id,
      label: level.label,
      points: level.score,
      score: level.score,
      description: level.description,
      tone: level.tone,
    })),
  };
}

function normalizeRubricSchema(schema = {}, fileName = "Uploaded rubric") {
  const criteria = Array.isArray(schema.criteria)
    ? schema.criteria
        .map((criterion, index) => normalizeCriterion(criterion, index))
        .filter(Boolean)
    : [];

  const criteriaTotalPoints = criteria.reduce(
    (sum, criterion) => sum + Number(criterion.maxScore || criterion.points || 0),
    0
  );

  const declaredTotalPoints = Number(schema.totalPoints || 0);
  const totalPoints = Number(criteriaTotalPoints || declaredTotalPoints || 0);

  const totalMismatch =
    declaredTotalPoints > 0 &&
    totalPoints > 0 &&
    Math.abs(declaredTotalPoints - totalPoints) > 0.001;

  return {
    title: String(schema.title || fileName || "Uploaded rubric").trim(),
    subtitle: String(schema.subtitle || "").trim(),
    totalPoints: Number.isFinite(totalPoints) ? totalPoints : 0,
    declaredTotalPoints: totalMismatch ? declaredTotalPoints : null,
    criteriaTotalPoints: Number.isFinite(criteriaTotalPoints)
      ? criteriaTotalPoints
      : 0,
    notes: Array.isArray(schema.notes)
      ? schema.notes.map((note) => String(note || "").trim()).filter(Boolean)
      : [],
    criteria,
    attribution: String(schema.attribution || "").trim(),
    _normalized: true,
  };
}

function rubricCriterionToMatrixRow(criterion = {}) {
  const levels = Array.isArray(criterion.levels)
    ? criterion.levels
    : Array.isArray(criterion.bands)
    ? criterion.bands
    : [];

  return {
    id: criterion.id,
    criterionId: criterion.id,
    name: criterion.name,
    label: criterion.name,
    minScore: criterion.minScore,
    maxScore: criterion.maxScore,
    points: criterion.points || criterion.maxScore,
    cells: levels.map((level) => ({
      id: level.id,
      label: level.label,
      score: Number(level.score ?? level.points ?? 0),
      points: Number(level.score ?? level.points ?? 0),
      description: level.description || "",
      tone: level.tone || getLevelTone(level.label, level.score, criterion.maxScore),
    })),
  };
}

function rubricSchemaToMatrix(schema = {}, fileName = "Uploaded rubric") {
  const normalized = schema._normalized
    ? schema
    : normalizeRubricSchema(schema, fileName);

  if (!normalized.criteria.length) return null;

  const firstCriterion = normalized.criteria[0];

  return {
    kind: "matrix",
    name: normalized.title || fileName || "Uploaded rubric",
    title: normalized.title || fileName || "Uploaded rubric",
    totalPoints: normalized.totalPoints,
    headers: firstCriterion.levels.map((level) => ({
      label: level.label,
      score: level.score,
      points: level.score,
      tone: level.tone,
    })),
    notes: [
      normalized.subtitle,
      ...normalized.notes,
      normalized.attribution,
    ].filter(Boolean),
    rows: normalized.criteria.map(rubricCriterionToMatrixRow),
  };
}

async function extractTextFromBuffer(buffer, mimeType = "", fileName = "") {
  const lowerName = String(fileName || "").toLowerCase();

  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword" ||
    lowerName.endsWith(".docx") ||
    lowerName.endsWith(".doc")
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return String(result?.value || "").trim();
  }

  if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
    const result = await pdfParse(buffer);
    return String(result?.text || "").trim();
  }

  return buffer.toString("utf8").trim();
}

function cleanClaudeJson(raw = "") {
  const trimmed = String(raw || "").trim();

  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    const firstLineEnd = trimmed.indexOf("\n");

    if (firstLineEnd >= 0) {
      return trimmed.slice(firstLineEnd + 1, -3).trim();
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

async function parseWithClaude(rawText, fileName = "Uploaded rubric") {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is required to parse uploaded rubrics.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `File name: ${fileName}

Parse the following rubric text into the required JSON schema.

${rawText}`,
        },
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message || `Claude rubric parse failed (${response.status})`
    );
  }

  const raw = Array.isArray(data?.content)
    ? data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
    : "";

  let parsed;

  try {
    parsed = JSON.parse(cleanClaudeJson(raw));
  } catch (error) {
    throw new Error(`Claude returned invalid rubric JSON: ${error.message}`);
  }

  return normalizeRubricSchema(parsed, fileName);
}

function unreadableRubricError(message, cause) {
  const error = new Error(message);
  error.code = "RUBRIC_UNREADABLE";

  if (cause) {
    error.cause = cause;
  }

  return error;
}

async function parseRubricBuffer(
  buffer,
  mimeType = "",
  fileName = "Uploaded rubric"
) {
  let text;

  try {
    text = await extractTextFromBuffer(buffer, mimeType, fileName);
  } catch (extractError) {
    throw unreadableRubricError(
      "We couldn't read this file. It may be a scanned image, password-protected, or a damaged PDF. Try a text-based PDF / Word file, or paste the rubric text instead.",
      extractError
    );
  }

  if (text.replace(/\s+/g, "").length < 15) {
    throw unreadableRubricError(
      "We couldn't find readable text in this file. If it's a scanned or image-only PDF, upload a text-based PDF / Word file, or paste the rubric text instead."
    );
  }

  const schema = await parseWithClaude(text, fileName);

  return {
    text,
    schema,
    rubricData: rubricSchemaToMatrix(schema, fileName),
  };
}

async function parseRubricFile(filePath, mimeType = "") {
  const buffer = fs.readFileSync(filePath);

  return parseRubricBuffer(
    buffer,
    mimeType,
    filePath.split("/").pop() || "Uploaded rubric"
  );
}

async function parseRubricText(rawText, fileName = "Uploaded rubric") {
  const text = String(rawText || "").trim();

  if (text.replace(/\s+/g, "").length < 15) {
    throw unreadableRubricError("Please paste more rubric text before parsing.");
  }

  const schema = await parseWithClaude(text, fileName);

  return {
    text,
    schema,
    rubricData: rubricSchemaToMatrix(schema, fileName),
  };
}

module.exports = {
  extractTextFromBuffer,
  normalizeRubricSchema,
  parseRubricBuffer,
  parseRubricFile,
  parseRubricText,
  rubricCriterionToMatrixRow,
  rubricSchemaToMatrix,
  slugifyRubricId,
};