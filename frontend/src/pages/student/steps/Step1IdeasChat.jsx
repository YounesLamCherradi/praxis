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
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const AI_ENDPOINT = `${API_BASE_URL}/api/generate`;

const STARTER_PROMPTS = [
  "Understand the prompt",
  "Choose a topic",
  "Organize my ideas",
  "Find useful examples",
];

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

  return cleaned.slice(-10);
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

  if (words.length <= limit) return words.join(" ");

  return words.slice(0, limit).join(" ");
}

function limitCoachReply(text, maxSentences = 2, maxWords = 55) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) return "";

  const sentenceMatches = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];
  const limitedSentences = sentenceMatches
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, maxSentences)
    .join(" ");

  const words = limitedSentences.split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) return limitedSentences;

  return `${words.slice(0, maxWords).join(" ").replace(/[,:;\-]+$/, "")}.`;
}

function buildNotesOnlyOutline(messages, assignmentTitle) {
  const sourceLines = messages
    .filter((msg) => msg.text && !msg.isError)
    .flatMap((msg) => String(msg.text).split(/\n|;/))
    .map((line) => truncateWords(line, 12))
    .filter((line) => line.length >= 4);

  const uniqueNotes = [];

  sourceLines.forEach((line) => {
    const key = line.toLowerCase();

    if (!uniqueNotes.some((item) => item.toLowerCase() === key)) {
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
    title: assignmentTitle || "Planning outline",
    generatedAt: new Date().toISOString(),
    notes,
    sections: [
      {
        id: "main_ideas",
        title: "Main ideas",
        items: notes.slice(0, 4),
      },
      {
        id: "details_examples",
        title: "Details and examples",
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
  assignmentGuidelines,
  studentFocus,
  rubricText,
  minWords,
  maxWords,
  coachTimeLimitMinutes,
  autoBuildOutlineFromCoach,
}) {
  return `
You are the Praxis Ideas Coach inside a student writing platform.

You are helping the student in Step 1: Ideation and Brainstorming.

Your role:
- Help the student understand the assignment prompt.
- Help the student brainstorm possible ideas.
- Ask useful guiding questions.
- Help the student organize thoughts before drafting.
- Suggest possible thesis directions.
- Suggest outline structures.
- Encourage the student to make their own choices.

Strict rules:
- Do not write the full essay.
- Do not write final submission paragraphs.
- Do not complete the assignment for the student.
- Do not produce a ready-to-submit answer.
- Do not ask the student to write the full essay inside the chat.
- Keep the support focused on planning, brainstorming, organization, and reflection.
- Every reply must contain no more than 2 sentences total.
- Keep each reply under 55 words.
- Use one short paragraph only; do not use long bullet lists.
- Ask only one guiding question at a time.
- Do not give long explanations.
- Do not generate long outlines.
- Do not repeat the full assignment instructions.
- Base every reply directly on this assignment's prompt, requirements, and rubric criteria.
- Prioritize the rubric criterion most relevant to the student's latest message.
- Use notes, questions, and planning guidance.
- Do not write polished sentences that can be copied directly into the final draft.
- If giving an outline, keep it as short notes only.
- Never exceed 2 sentences, even when the student asks for more detail.

Assignment context:
Title: ${assignmentTitle || "Untitled Assignment"}

Prompt / Description / Instructions:
${assignmentPrompt || "No instructions provided."}

Guidelines / Requirements:
${assignmentGuidelines || "No additional guidelines provided."}

Student focus points:
${studentFocus || "No specific focus points provided."}

Rubric / Evaluation criteria:
${rubricText || "No rubric provided."}

Word limits:
Minimum words: ${minWords || "Not specified"}
Maximum words: ${maxWords || "Not specified"}

Coach time limit:
${coachTimeLimitMinutes || 15} minutes

Auto-build outline from coach chat:
${
  autoBuildOutlineFromCoach
    ? "Enabled. The chat may later become a notes-only outline before drafting."
    : "Disabled."
}

When the student seems ready, tell them they can continue to the draft phase.
`;
}

export default function Step1IdeasChat() {
  const {
    activeAssignment,
    activeSubmission,
    setStudentStep,
    saveDraftProgress,
  } = useStudentWorkspace();

  const [chatInput, setChatInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [coachError, setCoachError] = useState("");

  const [coachStartedAt, setCoachStartedAt] = useState(null);
  const [coachEndedAt, setCoachEndedAt] = useState(null);
  const [coachTimeUsedSeconds, setCoachTimeUsedSeconds] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());

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

  const aiAllowed =
    Boolean(
      assignment?.aiIdeasCoach ??
        assignment?.allowAI ??
        assignment?.ideationAI ??
        true
    ) && assignment?.disableChatbot !== true;

  const coachTimeLimitMinutes = Number(
    assignment?.coachTimeLimitMinutes ||
      assignment?.aiCoachTimeLimitMinutes ||
      assignment?.chatTimeLimit ||
      15
  );

  const totalLimitSeconds = Math.max(60, coachTimeLimitMinutes * 60);

  const autoBuildOutlineFromCoach = Boolean(
    aiAllowed &&
      (assignment?.autoBuildOutlineFromCoach ??
        assignment?.generateOutlineFromCoach ??
        false)
  );

  const liveElapsedSeconds =
    coachStartedAt && !coachEndedAt
      ? Math.max(
          0,
          Math.floor(
            (nowTick - new Date(coachStartedAt).getTime()) / 1000
          )
        )
      : 0;

  const totalUsedSeconds = Math.min(
    totalLimitSeconds,
    Number(coachTimeUsedSeconds || 0) + liveElapsedSeconds
  );

  const remainingSeconds = Math.max(0, totalLimitSeconds - totalUsedSeconds);

  const coachTimeExpired = aiAllowed && remainingSeconds <= 0;
  const chatAvailable = aiAllowed && !coachTimeExpired;
  const hasUserMessages = messages.some((msg) => msg.role === "user");

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
    if (!chatAvailable || coachStartedAt || coachEndedAt) {
      return {};
    }

    const startedAt = new Date().toISOString();

    setCoachStartedAt(startedAt);
    setNowTick(Date.now());

    return {
      coachStartedAt: startedAt,
      coachEndedAt: null,
      coachTimeUsedSeconds: Number(coachTimeUsedSeconds || 0),
    };
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

    setCoachStartedAt(activeSubmission?.coachStartedAt || null);
    setCoachEndedAt(activeSubmission?.coachEndedAt || null);
    setCoachTimeUsedSeconds(
      Number(activeSubmission?.coachTimeUsedSeconds || 0)
    );
    setNowTick(Date.now());
  }, [
    activeSubmission?.id,
    activeSubmission?.assignmentId,
    activeAssignment?.id,
  ]);

  useEffect(() => {
    if (!coachStartedAt || coachEndedAt || !aiAllowed) return undefined;

    const intervalId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [coachStartedAt, coachEndedAt, aiAllowed]);

  useEffect(() => {
    if (!aiAllowed || !assignmentId || coachEndedAt) return;
    if (remainingSeconds > 0) return;

    const endedAt = new Date().toISOString();

    setCoachStartedAt(null);
    setCoachEndedAt(endedAt);
    setCoachTimeUsedSeconds(totalLimitSeconds);

    if (typeof saveDraftProgress === "function") {
      saveDraftProgress(assignmentId, {
        coachStartedAt: null,
        coachEndedAt: endedAt,
        coachTimeUsedSeconds: totalLimitSeconds,
      });
    }
  }, [
    aiAllowed,
    assignmentId,
    coachEndedAt,
    remainingSeconds,
    totalLimitSeconds,
    saveDraftProgress,
  ]);

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
            assignmentGuidelines,
            studentFocus,
            rubricText,
            minWords,
            maxWords,
            coachTimeLimitMinutes,
            autoBuildOutlineFromCoach,
          }),
          messages: claudeMessages.length
            ? claudeMessages
            : [{ role: "user", content: cleanMessage }],
          maxTokens: 120,
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
        text: limitCoachReply(rawCoachReply, 2, 55),
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

  function handleContinueToDraft() {
    const now = new Date().toISOString();

    const normalizedPlanningMessages = messages
      .map(normalizeChatMessage)
      .filter((message) => message.text);

    const patch = {
      chatHistory: normalizedPlanningMessages,
      planningChatMessages: normalizedPlanningMessages,
      planningCoachHistory: normalizedPlanningMessages,
      planningChatCompletedAt: now,
      planningAssignmentContext: {
        assignmentId,
        title: assignmentTitle,
        prompt: assignmentPrompt,
        guidelines: assignmentGuidelines,
        rubricText,
      },
      coachStartedAt: null,
      coachTimeUsedSeconds: totalUsedSeconds,
    };

    if (coachTimeExpired) {
      patch.coachEndedAt = coachEndedAt || now;
    } else {
      patch.coachEndedAt = null;
    }

    if (autoBuildOutlineFromCoach && hasUserMessages) {
      patch.outline = buildNotesOnlyOutline(normalizedPlanningMessages, assignmentTitle);
      patch.outlineGeneratedAt = now;
    }

    if (assignmentId && typeof saveDraftProgress === "function") {
      saveDraftProgress(assignmentId, patch);
    }

    setStudentStep(2);
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      {(chatAvailable && !hasUserMessages) || !aiAllowed || coachTimeExpired ? (
        <div className="shrink-0 space-y-2">
          {chatAvailable && !hasUserMessages && (
            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleStarterPrompt(prompt)}
                  disabled={isThinking || requestInFlightRef.current}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-[#F8FAFC] px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-3 h-3" />
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {!aiAllowed && (
            <CompactAlert
              tone="amber"
              icon={ShieldAlert}
              title="AI ideas coach is disabled."
              message="You can still plan manually and continue to the draft."
            />
          )}

          {coachTimeExpired && (
            <CompactAlert
              tone="amber"
              icon={ShieldAlert}
              title="Coach time limit reached."
              message="Review the chat and continue to the draft."
            />
          )}
        </div>
      ) : null}

      <div className="flex-1 min-h-[260px] overflow-y-auto border border-slate-200 bg-[#F8FAFC] p-4 rounded-2xl space-y-4 shadow-inner">
        {messages.length > 0 ? (
          <>
            {messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              const isError = msg.isError;

              return (
                <div
                  key={`${msg.createdAt || "msg"}-${idx}`}
                  className={`flex gap-3 max-w-[85%] ${
                    isUser ? "ml-auto flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border ${
                      isUser
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isError
                        ? "bg-red-50 border-red-200 text-red-700"
                        : "bg-white border-blue-100 text-blue-700"
                    }`}
                  >
                    {isUser ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>

                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed font-sans whitespace-pre-line ${
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-none shadow-sm shadow-blue-600/20"
                        : isError
                        ? "bg-red-50 border border-red-200 text-red-800 shadow-sm rounded-tl-none"
                        : "bg-white border border-blue-100 text-slate-800 shadow-sm rounded-tl-none"
                    }`}
                  >
                    {msg.text || msg.content}
                  </div>
                </div>
              );
            })}

            {isThinking && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-sm border bg-white border-blue-100 text-blue-700">
                  <Bot className="w-4 h-4" />
                </div>

                <div className="p-3 rounded-2xl text-xs leading-relaxed font-sans bg-white border border-blue-100 text-slate-600 shadow-sm rounded-tl-none flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  Ideas Coach is preparing a short reply...
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-center">
            <div className="max-w-sm">
              <div className="w-11 h-11 mx-auto rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center mb-3">
                <Bot className="w-5 h-5" />
              </div>

              <h3 className="font-serif text-base font-bold text-slate-900">
                Start with one planning question
              </h3>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Ask for ideas, structure, examples, or clarification.
              </p>
            </div>
          </div>
        )}
      </div>

      {coachError && (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 font-semibold flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{coachError}</span>
        </div>
      )}

      <div className="shrink-0 border-t border-slate-100 pt-3 space-y-3">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            disabled={!chatAvailable || isThinking || requestInFlightRef.current}
            placeholder={
              !aiAllowed
                ? "AI ideas coach is disabled."
                : coachTimeExpired
                ? "Coach time is finished. Continue to the draft."
                : isThinking
                ? "Please wait for the coach to reply..."
                : "Ask for structure, ideas, or planning help..."
            }
            className="flex-1 bg-[#F8FAFC] border border-slate-200 rounded-xl px-4 py-3 text-xs font-sans text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          />

          <button
            type="submit"
            disabled={!chatAvailable || isThinking || requestInFlightRef.current || !chatInput.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white w-11 h-11 rounded-xl flex items-center justify-center transition-colors shadow-sm shadow-blue-600/20"
          >
            {isThinking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </form>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Continue when you are ready to draft.
          </p>

          <button
            type="button"
            onClick={handleContinueToDraft}
            className="inline-flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-100 hover:border-blue-600 text-xs font-bold px-5 py-3 rounded-xl transition-all"
          >
            Continue to Draft
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
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