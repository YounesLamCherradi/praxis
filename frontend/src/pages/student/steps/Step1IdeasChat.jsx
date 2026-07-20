import React, { useEffect, useMemo, useRef, useState } from "react";
import { useStudentWorkspace } from "../../../contexts/StudentWorkspaceContext";
import {
  Send,
  ArrowRight,
  Bot,
  User,
  Loader2,
  ShieldAlert,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const AI_ENDPOINT = `${API_BASE_URL}/api/generate`;

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
4. Help the student organise their thinking by asking questions like: "What is the most important thing you want to say?", "Which idea would come first, and why?", "What example could you use to explain that?"
5. If the student asks you to write for them, gently redirect with a question instead.
6. Match your vocabulary to CEFR level ${languageLevel}; keep it simple and encouraging.
7. Never repeat the same question twice in a conversation.
8. After two or three useful student replies, briefly check whether they already have enough ideas to begin drafting. Ask a choice-style question such as: "Do you feel ready to draft now, or do you want one more planning question?"
9. If the student seems ready, tell them clearly to click the Next button to move into the draft area. Do not tell them to write sentences in the chat.
10. Do not accept vague ideas too quickly. If the student gives something broad like "ask the instructor" or "do research", ask a follow-up such as "What exactly would you ask?" or "Why would that help?" before moving on.
11. Before you move from one main idea or step to the next, ask whether the student feels satisfied with the current one or wants to develop it a little more.
12. If the student gives a weak first step, ask them to make it more specific before you accept it. For example, turn "ask the instructor" into one concrete question they could ask.
13. When the assignment is about process or steps, help the student improve each step before moving to the next one.
14. Never say "share it here" or ask the student to draft their first sentence in chat. The chat is only for planning.

Assignment title: "${assignmentTitle}"
Task: "${assignmentPrompt}"

Start by asking the student what topic or idea they are thinking about. If they struggle to answer, suggest they think about two or three possible ideas and pick the one they feel most confident about.`;
}

function buildOpeningCoachPrompt({
  assignmentTitle,
  assignmentPrompt,
  assignmentType,
  languageLevel,
  assignmentGuidelines,
  studentFocus,
  rubricText,
}) {
  return `Read this assignment and ask ONE short, specific planning question that challenges the student to make an important decision before drafting.

Rules:
- Ask only one question, with no greeting or explanation.
- Make it specific to this assignment. Never ask "What is your first idea?"
- Do not provide an answer, thesis, or wording the student could copy.
- For an argument, probe a position, counterargument, evidence choice, or consequence.
- For another task, probe its most important choice, detail, comparison, sequence, or interpretation.
- Use CEFR ${languageLevel} vocabulary and no more than 35 words.

Title: ${assignmentTitle}
Type: ${assignmentType}
Task: ${assignmentPrompt}
${assignmentGuidelines ? `Requirements: ${assignmentGuidelines}` : ""}
${studentFocus ? `Student focus:\n${studentFocus}` : ""}
${rubricText ? `Rubric:\n${rubricText}` : ""}`;
}

function buildOpeningCoachMessage({
  assignmentTitle,
  assignmentPrompt,
  assignmentType,
}) {
  const cleanPrompt = getText(assignmentPrompt);
  const type = String(assignmentType || "").toLowerCase();
  let text;

  if (type === "argument" || /argu|position|agree|disagree/i.test(cleanPrompt)) {
    text = `What is the strongest reason someone might disagree with your position on “${assignmentTitle},” and what evidence could help you answer them?`;
  } else if (type === "narrative") {
    text = `Which specific moment would best reveal why “${assignmentTitle}” matters, and what detail would make that moment clear to a reader?`;
  } else if (type === "compare") {
    text = `Which difference matters most in “${assignmentTitle},” and what example would prove its importance?`;
  } else if (type === "process") {
    text = `Which step in “${assignmentTitle}” is most likely to confuse a reader, and what detail would make it easier to follow?`;
  } else {
    const taskFocus = cleanPrompt.replace(/\s+/g, " ").slice(0, 110);
    text = `The task asks you to consider “${taskFocus || assignmentTitle}.” What decision must you make first, and what evidence will guide it?`;
  }

  return {
    role: "assistant",
    text,
    createdAt: new Date().toISOString(),
  };
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

  const [
    showCoachSkipConfirm,
    setShowCoachSkipConfirm,
  ] = useState(false);

  const chatEndRef = useRef(null);
  const requestInFlightRef = useRef(false);
  const openingRequestKeyRef = useRef("");

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

    const normalizedSavedMessages = savedPlanningMessages
      .map(normalizeChatMessage)
      .filter((message) => message.text);
    const hasStudentReply = normalizedSavedMessages.some(
      (message) => message.role === "user"
    );
    const hasNonGenericCoachOpening = normalizedSavedMessages.some(
      (message) =>
        message.role === "assistant" &&
        !/welcome to your planning dashboard|what is your first idea/i.test(
          message.text
        )
    );

    if (
      normalizedSavedMessages.length > 0 &&
      (hasStudentReply || hasNonGenericCoachOpening)
    ) {
      setMessages(normalizedSavedMessages);
      setNowTick(Date.now());
      return;
    }

    if (aiAllowed) {
      const requestKey = String(assignmentId || assignmentTitle);
      if (openingRequestKeyRef.current === requestKey) return;

      openingRequestKeyRef.current = requestKey;
      setIsThinking(true);
      setCoachError("");

      const fallbackMessage = normalizeChatMessage(
        buildOpeningCoachMessage({
          assignmentTitle,
          assignmentPrompt,
          assignmentType,
        })
      );

      const generateOpeningQuestion = async () => {
        let openingMessage = fallbackMessage;

        try {
          const response = await fetch(AI_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system: buildOpeningCoachPrompt({
                assignmentTitle,
                assignmentPrompt,
                assignmentType,
                languageLevel,
                assignmentGuidelines,
                studentFocus,
                rubricText,
              }),
              messages: [
                {
                  role: "user",
                  content: "Ask the opening planning question now.",
                },
              ],
            }),
          });
          const contentType = response.headers.get("content-type") || "";
          const data = contentType.includes("application/json")
            ? await response.json()
            : { error: await response.text() };

          if (!response.ok) {
            throw new Error(data?.error || "Opening Coach request failed.");
          }

          const generatedText = getText(
            data.response || data.reply || data.message
          );

          if (generatedText) {
            openingMessage = normalizeChatMessage({
              role: "assistant",
              text: generatedText,
              createdAt: new Date().toISOString(),
            });
          }
        } catch (error) {
          console.error("AI Coach opening question error:", error);
        } finally {
          setMessages([openingMessage]);
          setIsThinking(false);

          if (assignmentId && typeof saveDraftProgress === "function") {
            saveDraftProgress(assignmentId, {
              chatHistory: [openingMessage],
              planningChatMessages: [openingMessage],
              planningCoachHistory: [openingMessage],
              planningChatUpdatedAt: new Date().toISOString(),
              coachOpeningGeneratedFromAssignment: true,
            });
          }
        }
      };

      generateOpeningQuestion();
    } else {
      setMessages([]);
    }

    setNowTick(Date.now());
  }, [
    activeSubmission?.id,
    activeSubmission?.assignmentId,
    activeAssignment?.id,
    aiAllowed,
    assignmentId,
    assignmentTitle,
    assignmentPrompt,
    assignmentType,
    languageLevel,
    assignmentGuidelines,
    studentFocus,
    rubricText,
    saveDraftProgress,
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
            `Coach request failed with status ${response.status}.`
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
      console.error("Claude Coach error:", error);

      const errorText =
        error?.message ||
        "The Coach could not respond right now. Please try again.";

      setCoachError(errorText);

      const errorMessage = {
        role: "assistant",
        text:
          "I could not connect to the Coach right now. Please check the backend and try again.",
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
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3">

        <section className="flex min-h-[480px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-0">
          <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-700">
                  <Bot className="h-4 w-4" />
                </span>

                <div className="min-w-0">
                  <h3 className="text-xs font-bold text-slate-950">
                    Coach
                  </h3>

                  <p className="mt-0.5 truncate text-[10px] text-slate-500">
                    One planning question at a time - no submission-ready writing.
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

            {!aiAllowed && (
              <CompactAlert
                tone="amber"
                icon={ShieldAlert}
                title="Coach is disabled."
                message="Continue directly to drafting."
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
                      Coach is preparing a short reply...
                    </div>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center text-center">
                <div className="max-w-sm">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-100 bg-white text-blue-700 shadow-sm">
                    {isThinking ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Bot className="h-5 w-5" />
                    )}
                  </span>

                  <h3 className="mt-3 font-serif text-base font-bold text-slate-900">
                    {isThinking
                      ? "Coach is reading your assignment"
                      : "Coach will begin the conversation"}
                  </h3>

                  <p className="mt-1 text-xs leading-relaxed text-slate-500">
                    {isThinking
                      ? "Preparing one specific question to help you make an important planning decision."
                      : "Your first planning question will appear here automatically."}
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
                    ? "The Coach is disabled."
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
                aria-label="Send message to Coach"
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
                Your Coach conversation is saved automatically.
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
              Continue without using the Coach?
            </h3>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              You have not sent a planning message to the Coach yet.
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
