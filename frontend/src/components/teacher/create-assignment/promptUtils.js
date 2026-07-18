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

function normalizeAssignmentType(value) {
  const clean = getText(value).toLowerCase();

  if (clean.includes("compare")) return "Compare and Contrast";
  if (clean.includes("process")) return "Process Paragraph";
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

  if (clean.includes("MIXED")) return "Mixed level";

  const match = clean.match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return match?.[1] || "B1";
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
      minWords: 250,
      maxWords: 400,
      feedbackRequestLimit: 2,
      ideaRequestLimit: 3,
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

    minWords,
    maxWords,

    feedbackRequestLimit: toNumber(
      parsed.feedbackRequestLimit ??
        parsed.feedbackChecks,
      2,
      0,
      10
    ),

    ideaRequestLimit: toNumber(
      parsed.ideaRequestLimit ??
        parsed.ideaChecks,
      3,
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

A teacher will describe a writing assignment in one plain-English message.
Infer and create the complete assignment configuration.

Important rules:
- Create assignment instructions only. Never write a student answer or sample essay.
- Preserve every explicit teacher requirement.
- Infer sensible classroom defaults for omitted details.
- Use the teacher's wording as the source of truth.
- Keep student instructions clear, concise, and appropriate for the inferred CEFR level.
- Select only a course from the provided available-course list.
- If no course is mentioned, select the first available course.
- If no due date is mentioned, set it seven days after the provided current date at 23:59 local time.
- If no assignment type is clear, use "Response".
- If no level is stated, use "B1".
- If no word range is stated, use 250 to 400 words.
- If no feedback limit is stated, use 2. feedbackRequestLimit=0 disables AI draft feedback.
- If no idea-help limit is stated, use 3.
- ideaRequestLimit is independent from the conversational Ideas Coach. Do not set it to 0 merely because the Coach is disabled.
- Unless the teacher says otherwise, enable the Ideas Coach with unlimited active time (chatTimeLimit=0) and automatic outline.
- chatTimeLimit meanings: -1 disabled, 0 unlimited, positive number limited minutes.
- When the Ideas Coach is disabled, return ideasCoach=false, chatTimeLimit=-1, and autoOutlineFromChat=false. Keep ideaRequestLimit unchanged.
- Do not generate writing playback, focus tracking, large-insertion detection, honor confirmation, paste policy, submission locking, or other integrity fields. They are not assignment-level fields in the restored old Praxis model.
- Align the task with the provided rubric when a rubric is present.
- Return ONLY valid JSON. No markdown and no commentary.

Return this exact JSON shape:
{
  "title": "assignment title",
  "description": "short teacher-facing summary",
  "instructions": "student-facing instructions",
  "requirements": ["requirement 1", "requirement 2"],
  "assignmentType": "Response | Definition | Argument | Narrative | Compare and Contrast | Process Paragraph | Reflection | Summary | Analysis | Other",
  "languageLevel": "A1 | A2 | B1 | B2 | C1 | C2 | Mixed level",
  "minWords": 250,
  "maxWords": 400,
  "feedbackRequestLimit": 2,
  "ideaRequestLimit": 3,
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
    "Teacher's plain-English assignment description:",
    `"""${getText(teacherRequest)}"""`,
    "",
    rubricContext
      ? `Rubric context:\n${rubricContext}`
      : "Rubric context: no rubric details were provided.",
    "",
    "Build the complete assignment configuration now.",
  ].join("\n");
}