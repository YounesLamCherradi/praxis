const DEFAULT_SESSION_GAP_MS = 8000;

function eventTime(event) {
  const value = Date.parse(event?.timestamp || event?.createdAt || "");
  return Number.isFinite(value) ? value : null;
}

function isPasteEvent(event) {
  const type = String(
    event?.type || event?.action || event?.eventGroup || ""
  ).toLowerCase();

  return type.includes("paste");
}

function summarizeEditingGroup(events) {
  const addedChars = events.reduce(
    (sum, event) =>
      sum +
      Number(
        event?.addedChars ??
          String(event?.insertedText || "").length
      ),
    0
  );
  const deletedChars = events.reduce(
    (sum, event) =>
      sum +
      Number(
        event?.deletedChars ??
          String(event?.removedText || "").length
      ),
    0
  );
  const first = events[0];

  return {
    ...first,
    timelineKind: "editing",
    timelineLabel:
      deletedChars > 0
        ? "Writing and revision session"
        : "Continuous writing session",
    timelinePreview: [
      `${addedChars} character${addedChars === 1 ? "" : "s"} typed`,
      deletedChars > 0
        ? `${deletedChars} deleted`
        : null,
      `${events.length} edit${events.length === 1 ? "" : "s"}`,
    ]
      .filter(Boolean)
      .join(" · "),
    timelineEvents: events,
    timelineEventKeys: events.map((event) =>
      String(event?.__replayKey || event?.id || "")
    ),
  };
}

/**
 * Raw keystrokes are retained for exact replay, but the teacher-facing
 * activity list groups uninterrupted editing into readable sessions.
 * Paste operations remain individual evidence items.
 */
export function buildReplayTimeline(
  events = [],
  sessionGapMs = DEFAULT_SESSION_GAP_MS
) {
  const timeline = [];
  let editingGroup = [];

  function flushEditingGroup() {
    if (editingGroup.length === 0) return;
    timeline.push(summarizeEditingGroup(editingGroup));
    editingGroup = [];
  }

  events.forEach((event) => {
    if (!event) return;

    if (isPasteEvent(event)) {
      flushEditingGroup();
      timeline.push({
        ...event,
        timelineKind: "paste",
        timelineLabel: "Text pasted",
        timelinePreview:
          event.preview ||
          `${String(event.insertedText || event.text || "").length} characters pasted`,
        timelineEvents: [event],
        timelineEventKeys: [
          String(event.__replayKey || event.id || ""),
        ],
      });
      return;
    }

    const previous = editingGroup.at(-1);
    const previousTime = eventTime(previous);
    const currentTime = eventTime(event);
    const exceedsGap =
      editingGroup.length > 0 &&
      Number.isFinite(previousTime) &&
      Number.isFinite(currentTime) &&
      currentTime - previousTime > sessionGapMs;

    if (exceedsGap) flushEditingGroup();
    editingGroup.push(event);
  });

  flushEditingGroup();
  return timeline;
}
