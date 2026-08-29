function getText(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function extractJsonFromText(text) {
  const raw = String(text || "").trim();

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    // Continue below.
  }

  const withoutFence = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch {
    // Continue below.
  }

  const firstBrace = withoutFence.indexOf("{");
  const lastBrace = withoutFence.lastIndexOf("}");

  if (
    firstBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    try {
      return JSON.parse(
        withoutFence.slice(firstBrace, lastBrace + 1)
      );
    } catch {
      return null;
    }
  }

  return null;
}

function toBoolean(value, fallback) {
  if (typeof value === "boolean") return value;

  const clean = String(value ?? "")
    .trim()
    .toLowerCase();

  if (["true", "yes", "on", "enabled", "1"].includes(clean)) {
    return true;
  }

  if (["false", "no", "off", "disabled", "0"].includes(clean)) {
    return false;
  }

  return fallback;
}

function toNumber(value, fallback, minimum = null, maximum = null) {
  const parsed = Number(value);
  let result = Number.isFinite(parsed) ? parsed : fallback;

  if (minimum !== null) {
    result = Math.max(minimum, result);
  }

  if (maximum !== null) {
    result = Math.min(maximum, result);
  }

  return result;
}

function toInteger(value, fallback, minimum = null, maximum = null) {
  const normalized = toNumber(
    value,
    fallback,
    minimum,
    maximum
  );

  return Math.floor(normalized);
}

function normalizeAssignmentType(value) {
  const clean = getText(value).toLowerCase();

  if (clean.includes("compare")) return "Compare and Contrast";
  if (clean.includes("process")) return "Process";
  if (clean.includes("narrative")) return "Narrative";
  if (clean.includes("argument")) return "Argument";
  if (clean.includes("definition")) return "Definition";
  if (clean.includes("reflection")) return "Reflection";
  if (clean.includes("summary")) return "Summary";
  if (clean.includes("analysis")) return "Analysis";
  if (clean.includes("response")) return "Response";
  if (clean.includes("other")) return "Other";

  return "Response";
}

function normalizeLanguageLevel(value) {
  const clean = getText(value).toUpperCase();

  const match = clean.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return match?.[1] || "B1";
}

export function inferYearlessDueDate(value, currentDate = new Date()) {
  const text = getText(value);
  if (!text) return "";

  const match = text.match(
    /(?:^|\D)(\d{1,2})\s*[\/.\-]\s*(\d{1,2})(?!\s*[\/.\-]\s*\d)(?:\s+(?:at\s*)?(\d{1,2})(?::(\d{2}))?)?/i
  );
  if (!match) return "";

  const day = Number(match[1]);
  const month = Number(match[2]);
  const hour = match[3] === undefined ? 23 : Number(match[3]);
  const minute = match[4] === undefined ? 59 : Number(match[4]);
  const now = new Date(currentDate);

  if (
    Number.isNaN(now.getTime()) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return "";
  }

  let year = now.getFullYear();
  let resolved = new Date(year, month - 1, day, hour, minute, 0, 0);

  if (
    resolved.getMonth() !== month - 1 ||
    resolved.getDate() !== day
  ) {
    return "";
  }

  if (resolved.getTime() < now.getTime()) {
    year += 1;
    resolved = new Date(year, month - 1, day, hour, minute, 0, 0);
  }

  const pad = (number) => String(number).padStart(2, "0");
  return `${resolved.getFullYear()}-${pad(resolved.getMonth() + 1)}-${pad(resolved.getDate())}T${pad(resolved.getHours())}:${pad(resolved.getMinutes())}`;
}

function normalizeDueDate(value) {
  const clean = getText(value);

  if (!clean) return "";

  const date = new Date(clean);

  if (Number.isNaN(date.getTime())) {
    return clean.slice(0, 16);
  }

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000
  );

  return local.toISOString().slice(0, 16);
}

function formatCriteriaForPrompt(criteria = []) {
  return safeArray(criteria)
    .map((criterion, index) => {
      const bands = safeArray(
        criterion?.bands || criterion?.levels
      )
        .map((band) => {
          const label =
            band?.label ||
            band?.name ||
            "Level";

          const points =
            band?.points ??
            band?.score ??
            "";

          const description =
            band?.description ||
            band?.descriptor ||
            "";

          return `  - ${label}${
            points !== "" ? ` (${points} pts)` : ""
          }: ${description}`;
        })
        .filter(Boolean)
        .join("\n");

      return `${index + 1}. ${
        criterion?.name ||
        criterion?.title ||
        `Criterion ${index + 1}`
      } (${criterion?.points ?? criterion?.maxPoints ?? 0} pts): ${
        criterion?.description || ""
      }${bands ? `\n${bands}` : ""}`;
    })
    .join("\n\n");
}

function formatCourses(courses = []) {
  const list = safeArray(courses);

  if (!list.length) {
    return "No courses are available.";
  }

  return list
    .map((course) => {
      const code =
        course?.code ||
        course?.classCode ||
        "";

      const name =
        course?.name ||
        course?.title ||
        "";

      return `- id=${course?.id ?? ""}; code=${code}; name=${name}`;
    })
    .join("\n");
}

export function normalizeGeneratedAssignment(data) {
  const responseText =
    data?.response ||
    data?.reply ||
    data?.message ||
    data?.content?.[0]?.text ||
    data?.content ||
    "";

  const parsed =
    typeof responseText === "object"
      ? responseText
      : extractJsonFromText(responseText);

  if (!parsed || typeof parsed !== "object") {
    return {
      title: "",
      description: getText(responseText),
      instructions: getText(responseText),
      requirements: [],
      assignmentType: "Response",
      languageLevel: "B1",
      gradeScale: 20,
      minWords: 250,
      maxWords: 400,
      feedbackRequestLimit: 2,
      ideaRequestLimit: 0,
      dueDate: "",
      classCode: "",
      aiSupport: {
        ideasCoach: true,
        chatTimeLimit: 0,
        autoOutlineFromChat: true,
      },
      rawText: getText(responseText),
    };
  }

  const minWords = toNumber(
    parsed.minWords ??
      parsed.suggestedMinWords ??
      parsed.wordCountMin,
    250,
    1
  );

  const maxWords = Math.max(
    minWords,
    toNumber(
      parsed.maxWords ??
        parsed.suggestedMaxWords ??
        parsed.wordCountMax,
      400,
      1
    )
  );

  const support =
    parsed.aiSupport ||
    parsed.studentAiSupport ||
    parsed.aiSettings ||
    {};


  return {
    title: getText(
      parsed.title ||
      parsed.assignmentTitle
    ),

    description: getText(
      parsed.description ||
      parsed.summary ||
      parsed.instructions ||
      parsed.studentInstructions
    ),

    instructions: getText(
      parsed.instructions ||
      parsed.studentInstructions ||
      parsed.prompt ||
      parsed.description
    ),

    requirements: safeArray(parsed.requirements)
      .map(getText)
      .filter(Boolean),

    assignmentType: normalizeAssignmentType(
      parsed.assignmentType ||
      parsed.type
    ),

    languageLevel: normalizeLanguageLevel(
      parsed.languageLevel ||
      parsed.studentLevel ||
      parsed.level
    ),

    gradeScale: toInteger(
      parsed.gradeScale ??
        parsed.rubricTotalPoints ??
        parsed.maxGrade,
      20,
      1,
      500
    ),

    minWords,
    maxWords,

    feedbackRequestLimit: toInteger(
      parsed.feedbackRequestLimit ??
        parsed.feedbackChecks,
      2,
      0,
      10
    ),

    ideaRequestLimit: toInteger(
      parsed.ideaRequestLimit ??
        parsed.ideaChecks,
      0,
      0,
      10
    ),

    dueDate: normalizeDueDate(
      parsed.dueDate ||
      parsed.deadline ||
      parsed.dueAt
    ),

    classId: parsed.classId ?? "",
    classCode: getText(
      parsed.classCode ||
      parsed.courseCode
    ),
    className: getText(
      parsed.className ||
      parsed.courseName
    ),

    aiSupport: {
      ideasCoach: toBoolean(
        support.ideasCoach ??
          support.aiIdeasCoach ??
          parsed.allowAI,
        true
      ),

      chatTimeLimit: toNumber(
        support.chatTimeLimit ??
          support.coachTimeLimitMinutes ??
          parsed.chatTimeLimit,
        0,
        -1,
        120
      ),

      autoOutlineFromChat: toBoolean(
        support.autoOutlineFromChat ??
          support.autoBuildOutlineFromCoach,
        true
      ),
    },

    rawText: getText(responseText),
  };
}

export function buildAssignmentGenerationSystemPrompt() {
  return `You are Praxis Assignment Builder.

An instructor will describe a writing assignment in one plain-English message.
Infer and create the complete assignment configuration.

Important rules:
- Create assignment instructions only. Never write a student answer or sample essay.
- Preserve every explicit instructor requirement.
- Infer sensible classroom defaults for omitted details.
- Use the instructor's wording as the source of truth.
- Keep student instructions clear, concise, and appropriate for the inferred CEFR level.
- The course is selected separately by the instructor in the Praxis interface.
- Never choose, infer, replace, or change the course.
- If the response format contains course/class fields, leave those fields empty unless required by the response schema.
- If no due date is mentioned, set it seven days after the provided current date at 23:59 local time.
- Interpret yearless numeric dates as DD/MM. Infer the current year when the date is still upcoming; otherwise use the next year. Example: after July 14, "14/07" means July 14 of the next year.
- If no assignment type is clear, use "Response".
- If no level is stated, use "B1".
- If no grade scale is stated, use 20.
- If no word range is stated, use 250 to 400 words.
- If no feedback limit is stated, use 2. feedbackRequestLimit=0 disables AI draft feedback.
- Set ideaRequestLimit to 0 because separate planning-note requests are out of scope.
- Unless the instructor says otherwise, enable Coach with unlimited active time (chatTimeLimit=0) and automatic outline.
- chatTimeLimit meanings: -1 disabled, 0 unlimited, positive number limited minutes.
- When Coach is disabled, return ideasCoach=false, chatTimeLimit=-1, and autoOutlineFromChat=false.
- Do not generate writing playback, focus tracking, large-insertion detection, honor confirmation, paste policy, submission locking, or other integrity fields. They are not assignment-level fields in the restored old Praxis model.
- Align the task with the provided rubric when a rubric is present.
- Return ONLY valid JSON. No markdown and no commentary.

Return this exact JSON shape:
{
  "title": "assignment title",
  "description": "short instructor-facing summary",
  "instructions": "student-facing instructions",
  "requirements": ["requirement 1", "requirement 2"],
  "assignmentType": "Response | Definition | Argument | Narrative | Compare and Contrast | Process Paragraph | Reflection | Summary | Analysis | Other",
  "languageLevel": "A1 | A2 | B1 | B2 | C1 | C2",
  "gradeScale": 20,
  "minWords": 250,
  "maxWords": 400,
  "feedbackRequestLimit": 2,
  "ideaRequestLimit": 0,
  "dueDate": "YYYY-MM-DDTHH:mm",
  "classId": "available course id",
  "classCode": "available course code",
  "className": "available course name",
  "aiSupport": {
    "ideasCoach": true,
    "chatTimeLimit": 0,
    "autoOutlineFromChat": true
  }
}`;
}

export function buildAssignmentGenerationUserPrompt({
  teacherRequest,
  availableCourses = [],
  currentDate,
  gradeScale = 20,
  rubricTitle,
  criteria = [],
  uploadedRubricText = "",
}) {
  const rubricContext = [
    rubricTitle
      ? `Rubric title: ${rubricTitle}`
      : "",
    formatCriteriaForPrompt(criteria),
    uploadedRubricText
      ? `Uploaded rubric source:\n${String(uploadedRubricText).slice(0, 4000)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    `Current date and time: ${currentDate || new Date().toISOString()}`,
    "",
    "Available courses:",
    formatCourses(availableCourses),
    "",
    "Instructor's plain-English assignment description:",
    `"""${getText(teacherRequest)}"""`,
    `Rubric maximum score selected in the form: ${toInteger(gradeScale, 20, 1, 500)} points. Use this unless the instructor explicitly requests a different score in the description.`,
    "",
    rubricContext
      ? `Rubric context:\n${rubricContext}`
      : "Rubric context: no rubric details were provided.",
    "",
    "Build the complete assignment configuration now.",
  ].join("\n");
}
