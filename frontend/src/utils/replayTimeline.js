function isPasteEvent(event) {
  const type = String(
    event?.type || event?.action || event?.eventGroup || ""
  ).toLowerCase();

  return type.includes("paste");
}

/**
 * Raw keystrokes remain available to the exact replay. The teacher-facing
 * activity list intentionally shows only paste operations, which are the
 * discrete events an instructor may need to inspect or jump to directly.
 */
export function buildReplayTimeline(events = []) {
  return events
    .filter(isPasteEvent)
    .map((event) => ({
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
      }));
}
