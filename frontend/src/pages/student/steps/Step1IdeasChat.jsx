import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStudentWorkspace } from "../../../contexts/StudentWorkspaceContext";
import {
  Send,
  ArrowRight,
  Bot,
  User,
  Sparkles,
  Loader2,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const AI_ENDPOINT = `${API_BASE_URL}/api/generate`;

const STARTER_PROMPTS = [];

function getText(value) {
  return String(value || "").trim();
}

function normalizeChatMessage(msg) {
  const role = msg?.role === "assistant" ? "assistant" : "user";

  return {
    role,
    text: getText(msg?.text || msg?.content || msg?.message),
    createdAt: msg?.createdAt || msg?.timestamp || new Date().toISOString(),
    isError: Boolean(msg?.isError),
  };
}

function buildClaudeMessages(messages) {
  const cleaned = messages
    .map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: getText(msg.text || msg.content),
    }))
    .filter((msg) => msg.content);

  while (cleaned.length > 0 && cleaned[0].role === "assistant") {
    cleaned.shift();
  }

  return cleaned;
}

function formatRubricForPrompt(rubric) {
  if (!Array.isArray(rubric) || rubric.length === 0) return "";

  return rubric
    .map((item, index) => {
      const name =
        item?.name ||
        item?.title ||
        item?.criterion ||
        `Criterion ${index + 1}`;

      const description =
        item?.description ||
        item?.details ||
        item?.expectation ||
        "";

      const points =
        item?.points ||
        item?.score ||
        item?.maxPoints ||
        "";

      return `${name}${points ? ` (${points} points)` : ""}: ${description}`;
    })
    .join("\n");
}

function formatStudentFocusForPrompt(studentFocus) {
  if (!Array.isArray(studentFocus) || studentFocus.length === 0) return "";
  return studentFocus.map((item) => `- ${item}`).join("\n");
}





function truncateWords(text, limit = 12) {
  const words = String(text || "")
    .replace(/\*\*/g, "")
    .replace(/^[-*•\d.)\s]+/g, "")
    .replace(/[.!?]+$/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= limit) {
    return words.join(" ");
  }

  return words.slice(0, limit).join(" ");
}

function buildNotesOnlyOutline(
  messages,
  assignmentTitle
) {
  const sourceLines = messages
    .filter(
      (message) =>
        message.text &&
        !message.isError
    )
    .flatMap((message) =>
      String(message.text).split(/\n|;/)
    )
    .map((line) =>
      truncateWords(line, 12)
    )
    .filter(
      (line) => line.length >= 4
    );

  const uniqueNotes = [];

  sourceLines.forEach((line) => {
    const key = line.toLowerCase();

    if (
      !uniqueNotes.some(
        (item) =>
          item.toLowerCase() === key
      )
    ) {
      uniqueNotes.push(line);
    }
  });

  const notes =
    uniqueNotes.length > 0
      ? uniqueNotes.slice(0, 10)
      : [
          "Main idea",
          "Important details",
          "Possible structure",
          "Personal reflection",
        ];

  return {
    type: "notes_only",
    source: "coach_chat",
    title:
      assignmentTitle ||
      "Planning outline",
    generatedAt:
      new Date().toISOString(),
    notes,
    sections: [
      {
        id: "main_ideas",
        title: "Main ideas",
        items: notes.slice(0, 4),
      },
      {
        id: "details_examples",
        title:
          "Details and examples",
        items: notes.slice(4, 8),
      },
      {
        id: "draft_plan",
        title: "Draft plan",
        items: notes.slice(8, 10),
      },
    ],
  };
}

function buildIdeasCoachSystemPrompt({
  assignmentTitle,
  assignmentPrompt,
  assignmentType,
  languageLevel,
}) {
  const typeGuide = {
    argument:
      "help the student identify a clear opinion, find one strong reason or example, and think about why it matters",
    narrative:
      "help the student identify one specific moment, recall sensory details, and think about why the moment matters to them",
    process:
      "help the student think through the steps in order, spot what might be unclear, and consider what the reader needs to know to follow along",
    definition:
      "help the student explain what the term really means, think of a concrete example, and consider why understanding it matters",
    compare:
      "help the student identify key features of both subjects, find meaningful similarities and differences, and decide which difference matters most",
    informational:
      "help the student identify their main idea, think of supporting facts or examples, and consider how to explain it clearly to a reader",
    response:
      "help the student fully understand the question, form a clear answer, and find support for their thinking",
    other:
      "help the student clarify what they want to say, find support for their ideas, and plan how to structure their response",
  };

  const focus = typeGuide[assignmentType] || typeGuide.other;

  return `You are a supportive writing coach helping a student plan their writing. Your role is to ${focus}.

RULES:
1. Ask ONE question at a time. Keep it short and friendly.
2. NEVER write text the student could copy into their assignment.
3. If a student seems stuck or says they don't know, don't keep pushing. Instead, offer a simple, structured prompt like: "What are your two or three main ideas?" or "Which of those ideas would make the most sense to write about first?"
4. Help the student organise their thinking by asking questions like: "What is the most important thing you want to say?", "Which idea would come first — and why?", "What example could you use to explain that?"
5. If the student asks you to write for them, gently redirect with a question instead.
6. Match your vocabulary to CEFR level ${languageLevel} — keep it simple and encouraging.
7. Never repeat the same question twice in a conversation.
8. After two or three useful student replies, briefly check whether they already have enough ideas to begin drafting. Ask a choice-style question such as: "Do you feel ready to draft now, or do you want one more planning question?"
9. If the student seems ready, tell them clearly to click the Next button to move into the draft area. Do not tell them to write sentences in the chat.
10. Do not accept vague ideas too quickly. If the student gives something broad like "ask the teacher" or "do research", ask a follow-up such as "What exactly would you ask?" or "Why would that help?" before moving on.
11. Before you move from one main idea or step to the next, ask whether the student feels satisfied with the current one or wants to develop it a little more.
12. If the student gives a weak first step, ask them to make it more specific before you accept it. For example, turn "ask the teacher" into one concrete question they could ask.
13. When the assignment is about process or steps, help the student improve each step before moving to the next one.
14. Never say "share it here" or ask the student to draft their first sentence in chat. The chat is only for planning.

Assignment title: "${assignmentTitle}"
Task: "${assignmentPrompt}"

Start by asking the student what topic or idea they are thinking about. If they struggle to answer, suggest they think about two or three possible ideas and pick the one they feel most confident about.`;
}

export default function Step1IdeasChat() {
  const {
    activeAssignment,
    activeSubmission,
    goToStudentStep,
    startCoachSession,
    pauseCoachSession,
    resumeCoachSession,
    saveDraftProgress,
  } = useStudentWorkspace();

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [coachError, setCoachError] = useState("");

  const [nowTick, setNowTick] = useState(Date.now());
  const [ideaResponses, setIdeaResponses] = useState([]);
  const [ideaLoading, setIdeaLoading] = useState(false);

  const [
    showCoachSkipConfirm,
    setShowCoachSkipConfirm,
  ] = useState(false);

  const chatEndRef = useRef(null);
  const requestInFlightRef = useRef(false);

  const assignment = useMemo(() => {
    return (
      activeAssignment ||
      activeSubmission?.assignment ||
      activeSubmission?.assignmentDetails ||
      {}
    );
  }, [activeAssignment, activeSubmission]);

  const assignmentId =
    activeAssignment?.id ||
    activeSubmission?.assignmentId ||
    assignment?.id ||
    null;

  const assignmentTitle =
    assignment?.title ||
    assignment?.assignmentTitle ||
    activeSubmission?.assignmentTitle ||
    activeSubmission?.title ||
    "Untitled Assignment";

  const assignmentPrompt =
    assignment?.prompt ||
    assignment?.instructions ||
    assignment?.description ||
    assignment?.assignmentPrompt ||
    assignment?.studentPrompt ||
    assignment?.objective ||
    assignment?.task ||
    activeSubmission?.prompt ||
    activeSubmission?.instructions ||
    activeSubmission?.description ||
    activeSubmission?.assignmentPrompt ||
    activeSubmission?.studentPrompt ||
    activeSubmission?.objective ||
    activeSubmission?.task ||
    "No instructions provided.";

  const assignmentType =
    assignment?.assignmentType ||
    assignment?.type ||
    activeSubmission?.assignmentType ||
    "other";

  const languageLevel =
    assignment?.languageLevel ||
    assignment?.level ||
    activeSubmission?.languageLevel ||
    "B1";

  const assignmentGuidelines =
    assignment?.guidelines ||
    assignment?.requirements ||
    assignment?.criteria ||
    activeSubmission?.guidelines ||
    activeSubmission?.requirements ||
    "";

  const studentFocus = formatStudentFocusForPrompt(
    assignment?.studentFocus ||
      assignment?.focusPoints ||
      assignment?.learningGoals ||
      []
  );

  const rubricText =
    formatRubricForPrompt(assignment?.rubric) ||
    formatRubricForPrompt(assignment?.rubricSchema?.criteria) ||
    formatRubricForPrompt(assignment?.rubricCriteria) ||
    "";

  const minWords =
    assignment?.wordCountMin ??
    assignment?.minWords ??
    assignment?.minRequired ??
    activeSubmission?.wordCountMin ??
    activeSubmission?.minWords ??
    null;

  const maxWords =
    assignment?.wordCountMax ??
    assignment?.maxWords ??
    assignment?.maxAllowed ??
    activeSubmission?.wordCountMax ??
    activeSubmission?.maxWords ??
    null;

  const rawChatTimeLimit = Number(
    assignment?.chatTimeLimit ??
      assignment?.coachTimeLimitMinutes ??
      assignment?.aiCoachTimeLimitMinutes ??
      0
  );

  const aiAllowed =
    Boolean(
      assignment?.aiIdeasCoach ??
        assignment?.allowAI ??
        assignment?.ideationAI ??
        true
    ) &&
    assignment?.disableChatbot !== true &&
    rawChatTimeLimit >= 0;

  const coachUnlimited = aiAllowed && rawChatTimeLimit === 0;
  const totalLimitMs = Math.max(0, rawChatTimeLimit * 60 * 1000);

  const resumedAt = activeSubmission?.chatResumedAt
    ? Date.parse(activeSubmission.chatResumedAt)
    : null;

  const liveElapsedMs =
    aiAllowed &&
    rawChatTimeLimit > 0 &&
    resumedAt &&
    !Number.isNaN(resumedAt)
      ? Math.max(0, nowTick - resumedAt)
      : 0;

  const totalUsedMs =
    Number(activeSubmission?.chatElapsedMs || 0) +
    liveElapsedMs;

  const remainingMs = coachUnlimited
    ? Infinity
    : Math.max(0, totalLimitMs - totalUsedMs);

  const remainingSeconds = coachUnlimited
    ? null
    : Math.ceil(remainingMs / 1000);

  const coachTimeExpired =
    aiAllowed &&
    !coachUnlimited &&
    remainingMs <= 0;

  const chatAvailable = aiAllowed && !coachTimeExpired;
  const hasUserMessages = messages.some((msg) => msg.role === "user");


  const ideaRequestLimit = Math.max(
    0,
    Number(assignment?.ideaRequestLimit ?? 3)
  );

  const ideasRemaining = Math.max(
    0,
    ideaRequestLimit - ideaResponses.length
  );

  const autoBuildOutlineFromCoach =
    Boolean(
      aiAllowed &&
        (
          assignment?.autoOutlineFromChat ??
          assignment?.autoBuildOutlineFromCoach ??
          assignment?.generateOutlineFromCoach ??
          assignment?.aiSupportSettings
            ?.autoOutlineFromChat ??
          assignment?.aiSupportSettings
            ?.autoBuildOutlineFromCoach ??
          false
        )
    );

  function persistMessages(nextMessages, extraPatch = {}) {
    const normalizedMessages = nextMessages
      .map(normalizeChatMessage)
      .filter((msg) => msg.text);

    setMessages(normalizedMessages);

    if (assignmentId && typeof saveDraftProgress === "function") {
      saveDraftProgress(assignmentId, {
        chatHistory: normalizedMessages,
        planningChatMessages: normalizedMessages,
        planningCoachHistory: normalizedMessages,
        planningChatUpdatedAt: new Date().toISOString(),
        planningAssignmentContext: {
          assignmentId,
          title: assignmentTitle,
          prompt: assignmentPrompt,
          guidelines: assignmentGuidelines,
          rubricText,
        },
        ...extraPatch,
      });
    }
  }

  function ensureCoachTimerStarted() {
    if (!chatAvailable) return {};

    const now = new Date().toISOString();

    if (!activeSubmission?.chatStartedAt) {
      startCoachSession?.();
      return {
        chatStartedAt: now,
        chatElapsedMs: Number(activeSubmission?.chatElapsedMs || 0),
        chatResumedAt: now,
        chatExpiredAt: null,
      };
    }

    if (!activeSubmission?.chatResumedAt) {
      resumeCoachSession?.();
      return {
        chatResumedAt: now,
      };
    }

    return {};
  }

  useEffect(() => {
    const savedPlanningMessages =
      activeSubmission?.planningChatMessages ||
      activeSubmission?.planningCoachHistory ||
      activeSubmission?.chatHistory ||
      [];

    if (savedPlanningMessages.length > 0) {
      setMessages(savedPlanningMessages.map(normalizeChatMessage));
    } else {
      setMessages([]);
    }

    setIdeaResponses(
      Array.isArray(activeSubmission?.ideaResponses)
        ? activeSubmission.ideaResponses
        : []
    );

    setNowTick(Date.now());
  }, [
    activeSubmission?.id,
    activeSubmission?.assignmentId,
    activeAssignment?.id,
  ]);

  useEffect(() => {
    if (
      !activeSubmission?.chatResumedAt ||
      !aiAllowed ||
      coachUnlimited ||
      coachTimeExpired
    ) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [
    activeSubmission?.chatResumedAt,
    aiAllowed,
    coachUnlimited,
    coachTimeExpired,
  ]);

  useEffect(() => {
    if (
      !aiAllowed ||
      coachUnlimited ||
      !assignmentId ||
      !coachTimeExpired ||
      activeSubmission?.chatExpiredAt
    ) {
      return;
    }

    saveDraftProgress(assignmentId, {
      chatElapsedMs: totalLimitMs,
      chatResumedAt: null,
      chatExpiredAt: new Date().toISOString(),
    });
  }, [
    aiAllowed,
    coachUnlimited,
    assignmentId,
    coachTimeExpired,
    activeSubmission?.chatExpiredAt,
    totalLimitMs,
  ]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.hidden) {
        pauseCoachSession?.();
      } else if (chatAvailable) {
        resumeCoachSession?.();
      }
    }

    function handleBeforeUnload() {
      pauseCoachSession?.();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [chatAvailable, activeSubmission?.chatResumedAt]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  function generateLocalIdeas() {
    const topic =
      assignmentTitle ||
      "the topic";

    const previousIdea =
      ideaResponses.at(-1)?.rewrittenIdea || "";

    if (assignmentType === "argument") {
      return [
        `Choose one clear opinion about ${topic}.`,
        `Think of one real example that supports your opinion about ${topic}.`,
        "Add one note that explains why the example matters.",
        previousIdea
          ? "Try a different reason so you have another option."
          : "Think of another reason as a backup idea.",
      ];
    }

    if (assignmentType === "narrative") {
      return [
        `Pick one moment connected to ${topic}.`,
        "Think about what you saw, heard, or felt.",
        "Decide how the moment begins and ends.",
        "Choose one small detail that helps the reader picture it.",
      ];
    }

    return [
      `Choose one main idea about ${topic}.`,
      "Think of one fact, example, or reason that fits.",
      "Explain the idea in a way a classmate would understand.",
      previousIdea
        ? "Try another angle if the first idea feels too broad."
        : "Keep the topic small and clear.",
    ];
  }

  async function handleIdeaRequest() {
    if (
      ideaLoading ||
      ideasRemaining <= 0 ||
      !assignmentId
    ) {
      return;
    }

    setIdeaLoading(true);
    setCoachError("");

    let aiBullets = [];

    try {
      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxTokens: 350,
          temperature: 0.3,
          system: `You are a writing coach helping a ${languageLevel} student generate planning ideas. Return ONLY a JSON array of up to 4 short ideas. Use note-form phrases, not complete sentences the student could copy. Do not write any part of the assignment.`,
          prompt: `Assignment title: ${assignmentTitle}\nAssignment type: ${assignmentType}\nTask: ${assignmentPrompt}\nStudent planning chat:\n${messages
            .map((message) => `${message.role === "assistant" ? "Coach" : "Student"}: ${message.text}`)
            .join("\n")}\n\nReturn short planning ideas as JSON.`,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Idea request failed.");

      const raw = String(data?.response || data?.reply || data?.message || "").trim();
      const start = raw.indexOf("[");
      const end = raw.lastIndexOf("]");
      const parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
      aiBullets = Array.isArray(parsed)
        ? parsed.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 4)
        : [];

      if (!aiBullets.length) throw new Error("No usable ideas returned.");
    } catch (error) {
      console.error("Idea help fallback:", error);
      aiBullets = generateLocalIdeas();
    }

    const nextResponses = [
      ...ideaResponses,
      {
        id: `idea_${Date.now()}`,
        requestedAt: new Date().toISOString(),
        aiBullets,
        rewrittenIdea: "",
        whyChosen: "",
      },
    ];

    setIdeaResponses(nextResponses);
    saveDraftProgress(assignmentId, {
      ideaResponses: nextResponses,
    });
    setIdeaLoading(false);
  }

  function updateIdeaResponse(index, field, value) {
    const nextResponses = ideaResponses.map((response, responseIndex) =>
      responseIndex === index
        ? { ...response, [field]: value }
        : response
    );

    setIdeaResponses(nextResponses);
    saveDraftProgress(assignmentId, {
      ideaResponses: nextResponses,
    });
  }

  async function sendMessageToCoach(messageText) {
    const cleanMessage = messageText.trim();

    if (!cleanMessage || isThinking || requestInFlightRef.current || !chatAvailable) return;

    requestInFlightRef.current = true;

    const timerPatch = ensureCoachTimerStarted();

    const userMessage = {
      role: "user",
      text: cleanMessage,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, userMessage];

    persistMessages(nextMessages, timerPatch);

    setChatInput("");
    setCoachError("");
    setIsThinking(true);

    try {
      const claudeMessages = buildClaudeMessages(nextMessages);

      const response = await fetch(AI_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          system: buildIdeasCoachSystemPrompt({
            assignmentTitle,
            assignmentPrompt,
            assignmentType,
            languageLevel,
          }),
          messages: claudeMessages.length
            ? claudeMessages
            : [{ role: "user", content: cleanMessage }],
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      const data = contentType.includes("application/json")
        ? await response.json()
        : { error: await response.text() };

      if (!response.ok) {
        throw new Error(
          data?.error ||
            `Ideas Coach request failed with status ${response.status}.`
        );
      }

      const rawCoachReply =
        data.response ||
        data.reply ||
        data.message ||
        "I received your message, but I could not generate a clear response.";

      const coachMessage = {
        role: "assistant",
        text: getText(rawCoachReply),
        createdAt: new Date().toISOString(),
      };

      persistMessages([...nextMessages, coachMessage]);
    } catch (error) {
      console.error("Claude Ideas Coach error:", error);

      const errorText =
        error?.message ||
        "The Ideas Coach could not respond right now. Please try again.";

      setCoachError(errorText);

      const errorMessage = {
        role: "assistant",
        text:
          "I could not connect to the Ideas Coach right now. Please check the backend and try again.",
        createdAt: new Date().toISOString(),
        isError: true,
      };

      persistMessages([...nextMessages, errorMessage]);
    } finally {
      requestInFlightRef.current = false;
      setIsThinking(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    await sendMessageToCoach(chatInput);
  }

  async function handleStarterPrompt(prompt) {
    if (isThinking || requestInFlightRef.current || !chatAvailable) return;
    await sendMessageToCoach(prompt);
  }

  function completeContinueToDraft({
    skippedCoach = false,
  } = {}) {
    const now =
      new Date().toISOString();

    const normalizedPlanningMessages =
      messages
        .map(normalizeChatMessage)
        .filter(
          (message) => message.text
        );

    pauseCoachSession?.();

    const patch = {
      chatHistory:
        normalizedPlanningMessages,
      planningChatMessages:
        normalizedPlanningMessages,
      planningCoachHistory:
        normalizedPlanningMessages,
      planningChatCompletedAt: now,
      planningAssignmentContext: {
        assignmentId,
        title: assignmentTitle,
        prompt: assignmentPrompt,
        guidelines:
          assignmentGuidelines,
        rubricText,
      },
      chatResumedAt: null,
      chatSkippedAt:
        skippedCoach ? now : null,
    };

    if (
      !skippedCoach &&
      autoBuildOutlineFromCoach &&
      hasUserMessages
    ) {
      patch.outline =
        buildNotesOnlyOutline(
          normalizedPlanningMessages,
          assignmentTitle
        );

      patch.outlineGeneratedAt = now;
    }

    if (
      assignmentId &&
      typeof saveDraftProgress ===
        "function"
    ) {
      saveDraftProgress(
        assignmentId,
        patch
      );
    }

    setShowCoachSkipConfirm(false);

    goToStudentStep(
      2,
      skippedCoach
        ? { force: true }
        : undefined
    );
  }

  function handleContinueToDraft() {
    if (
      aiAllowed &&
      !hasUserMessages
    ) {
      setShowCoachSkipConfirm(true);
      return;
    }

    completeContinueToDraft();
  }

  function confirmContinueWithoutCoach() {
    completeContinueToDraft({
      skippedCoach: true,
    });
  }


  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        className={`grid min-h-0 flex-1 gap-3 ${
          ideaRequestLimit > 0
            ? "grid-cols-1 lg:grid-cols-[minmax(300px,350px)_minmax(0,1fr)]"
            : "grid-cols-1"
        }`}
      >
        {ideaRequestLimit > 0 && (
          <aside className="flex min-h-[380px] flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-sm lg:min-h-0">
            <header className="relative z-20 shrink-0 border-b border-emerald-200 bg-white/80 px-4 py-3 backdrop-blur">
              <div className="group relative">
                <button
                  type="button"
                  onClick={handleIdeaRequest}
                  disabled={ideaLoading || ideasRemaining <= 0}
                  aria-describedby="idea-help-tooltip"
                  className="grid w-full grid-cols-[1fr_auto_1fr] items-center rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-[11px] font-bold text-emerald-800 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 focus:outline-none focus:ring-4 focus:ring-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="justify-self-start">
                    {ideaLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <span className="px-2 text-center">
                    {ideaLoading
                      ? "Preparing ideas..."
                      : ideasRemaining > 0
                      ? "Get Idea Help"
                      : "No requests remaining"}
                  </span>

                  <span className="justify-self-end rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[9px] font-bold text-emerald-700">
                    {ideasRemaining} left
                  </span>
                </button>

                <div
                  id="idea-help-tooltip"
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-[calc(100%+0.5rem)] z-40 w-[min(260px,calc(100vw-3rem))] -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-center text-[10px] font-medium leading-relaxed text-white opacity-0 shadow-xl transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
                >
                  Request short planning notes, then rewrite one in your own words.
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {ideaResponses.length > 0 ? (
                <div className="space-y-3">
                  {ideaResponses.map((response, index) => (
                    <article
                      key={response.id || index}
                      className="rounded-2xl border border-emerald-100 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-mono text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                          Idea set {index + 1}
                        </p>

                        {(response.rewrittenIdea || response.whyChosen) && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[8px] font-bold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            In progress
                          </span>
                        )}
                      </div>

                      <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-slate-700">
                        {Array.isArray(response.aiBullets) &&
                          response.aiBullets.map((idea, ideaIndex) => (
                            <li
                              key={`${idea}-${ideaIndex}`}
                              className="flex gap-2 rounded-lg bg-emerald-50/60 px-2.5 py-2"
                            >
                              <span className="mt-0.5 font-bold text-emerald-700">
                                •
                              </span>

                              <span>{idea}</span>
                            </li>
                          ))}
                      </ul>

                      <div className="mt-3 space-y-2">
                        <div>
                          <label
                            htmlFor={`rewritten-idea-${index}`}
                            className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500"
                          >
                            Rewrite one idea
                          </label>

                          <textarea
                            id={`rewritten-idea-${index}`}
                            value={response.rewrittenIdea || ""}
                            onChange={(event) =>
                              updateIdeaResponse(
                                index,
                                "rewrittenIdea",
                                event.target.value
                              )
                            }
                            rows={3}
                            placeholder="Write the idea in your own words."
                            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor={`idea-reason-${index}`}
                            className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-slate-500"
                          >
                            Why this idea?
                          </label>

                          <textarea
                            id={`idea-reason-${index}`}
                            value={response.whyChosen || ""}
                            onChange={(event) =>
                              updateIdeaResponse(
                                index,
                                "whyChosen",
                                event.target.value
                              )
                            }
                            rows={3}
                            placeholder="Explain why this idea fits your assignment."
                            className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
                          />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full min-h-[220px] items-center justify-center text-center">
                  <div className="max-w-[240px]">
                    <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
                      <Sparkles className="h-5 w-5" />
                    </span>

                    <h4 className="mt-3 text-xs font-bold text-slate-900">
                      Need a starting point?
                    </h4>

                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      Request short notes, choose one, and develop it in your own words.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}

        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                  <Bot className="h-4 w-4" />
                </span>

                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-950">
                    Ideas Coach
                  </h3>

                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    One planning question at a time—no submission-ready writing.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {autoBuildOutlineFromCoach && (
                  <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 font-mono text-[9px] font-bold text-violet-700">
                    Notes outline on
                  </span>
                )}

              </div>
            </div>

            {chatAvailable &&
              !hasUserMessages &&
              STARTER_PROMPTS.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() =>
                        handleStarterPrompt(prompt)
                      }
                      disabled={
                        isThinking ||
                        requestInFlightRef.current
                      }
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-bold text-slate-600 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles className="h-3 w-3" />
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

            {!aiAllowed && (
              <CompactAlert
                tone="amber"
                icon={ShieldAlert}
                title="AI Ideas Coach is disabled."
                message="Idea Help remains available according to its separate request limit."
              />
            )}

            {coachTimeExpired && (
              <CompactAlert
                tone="amber"
                icon={ShieldAlert}
                title="Coach time limit reached."
                message="Review the conversation and continue to the draft."
              />
            )}
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8FAFC] p-4">
            {messages.length > 0 ? (
              <div className="space-y-4">
                {messages.map((msg, idx) => {
                  const isUser =
                    msg.role === "user";
                  const isError =
                    msg.isError;

                  return (
                    <div
                      key={`${msg.createdAt || "msg"}-${idx}`}
                      className={`flex max-w-[88%] gap-3 ${
                        isUser
                          ? "ml-auto flex-row-reverse"
                          : ""
                      }`}
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm ${
                          isUser
                            ? "border-blue-600 bg-blue-600 text-white"
                            : isError
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-blue-100 bg-white text-blue-700"
                        }`}
                      >
                        {isUser ? (
                          <User className="h-4 w-4" />
                        ) : (
                          <Bot className="h-4 w-4" />
                        )}
                      </div>

                      <div
                        className={`whitespace-pre-line rounded-2xl p-3 text-xs leading-relaxed ${
                          isUser
                            ? "rounded-tr-none bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                            : isError
                            ? "rounded-tl-none border border-red-200 bg-red-50 text-red-800 shadow-sm"
                            : "rounded-tl-none border border-blue-100 bg-white text-slate-800 shadow-sm"
                        }`}
                      >
                        {msg.text || msg.content}
                      </div>
                    </div>
                  );
                })}

                {isThinking && (
                  <div className="flex max-w-[88%] gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-100 bg-white text-blue-700 shadow-sm">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-blue-100 bg-white p-3 text-xs text-slate-600 shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                      Ideas Coach is preparing a short reply...
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center text-center">
                <div className="max-w-sm">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-700 shadow-sm">
                    <Bot className="h-5 w-5" />
                  </span>

                  <h3 className="mt-3 font-serif text-base font-bold text-slate-900">
                    Start with one planning question
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    Ask about ideas, structure, examples, or anything unclear in the assignment.
                  </p>
                </div>
              </div>
            )}
          </div>

          <footer className="shrink-0 border-t border-slate-200 bg-white p-3">
            {coachError && (
              <div className="mb-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{coachError}</span>
              </div>
            )}

            <form
              onSubmit={handleSendMessage}
              className="flex gap-2"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(event) =>
                  setChatInput(
                    event.target.value
                  )
                }
                disabled={
                  !chatAvailable ||
                  isThinking ||
                  requestInFlightRef.current
                }
                placeholder={
                  !aiAllowed
                    ? "The Ideas Coach is disabled."
                    : coachTimeExpired
                    ? "Coach time is finished. Continue to the draft."
                    : isThinking
                    ? "Please wait for the Coach to reply..."
                    : "Ask a planning question..."
                }
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-4 py-3 text-xs text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              />

              <button
                type="submit"
                disabled={
                  !chatAvailable ||
                  isThinking ||
                  requestInFlightRef.current ||
                  !chatInput.trim()
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Send message to Ideas Coach"
              >
                {isThinking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>

            <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[10px] leading-relaxed text-slate-500">
                Your Idea Help notes and Coach conversation are saved automatically.
              </p>

              <button
                type="button"
                onClick={handleContinueToDraft}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-5 py-3 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-all hover:bg-blue-700"
              >
                Continue to Draft
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </section>
      </div>

      {showCoachSkipConfirm && (
        <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
              <ShieldAlert className="h-5 w-5" />
            </div>

            <h3 className="mt-4 font-serif text-lg font-bold text-slate-950">
              Continue without using the Ideas Coach?
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              You have not sent a planning message to the Coach. Your separate Idea Help notes, if any, will remain saved.
            </p>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() =>
                  setShowCoachSkipConfirm(false)
                }
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50"
              >
                Return to planning
              </button>

              <button
                type="button"
                onClick={confirmContinueWithoutCoach}
                className="rounded-xl bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700"
              >
                Continue to Draft
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CompactAlert({ tone = "amber", icon: Icon, title, message }) {
  const toneStyles = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
  };

  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2 flex items-start gap-2 ${
        toneStyles[tone] || toneStyles.amber
      }`}
    >
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />

      <p className="text-[11px] leading-relaxed">
        <span className="font-bold">{title}</span> {message}
      </p>
    </div>
  );
}