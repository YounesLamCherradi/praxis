const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");

const moduleUrl = pathToFileURL(
  path.join(
    __dirname,
    "../frontend/src/utils/replayTimeline.js"
  )
).href;

test("continuous keystrokes become one readable timeline activity", async () => {
  const { buildReplayTimeline } = await import(moduleUrl);
  const events = Array.from({ length: 70 }, (_, index) => ({
    id: `event-${index}`,
    __replayKey: `event-${index}`,
    type: "insert",
    insertedText: "x",
    timestamp: new Date(1000 + index * 50).toISOString(),
  }));

  const timeline = buildReplayTimeline(events);

  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].timelineLabel, "Continuous writing session");
  assert.match(timeline[0].timelinePreview, /70 characters typed/);
  assert.match(timeline[0].timelinePreview, /70 edits/);
});

test("deletion is summarized with its editing session and paste stays atomic", async () => {
  const { buildReplayTimeline } = await import(moduleUrl);
  const events = [
    {
      id: "insert",
      __replayKey: "insert",
      type: "insert",
      insertedText: "a",
      timestamp: new Date(1000).toISOString(),
    },
    {
      id: "delete",
      __replayKey: "delete",
      type: "delete",
      removedText: "a",
      timestamp: new Date(1100).toISOString(),
    },
    {
      id: "rewrite",
      __replayKey: "rewrite",
      type: "insert",
      insertedText: "b",
      timestamp: new Date(1200).toISOString(),
    },
    {
      id: "paste",
      __replayKey: "paste",
      type: "paste_insert",
      insertedText: "pasted paragraph",
      timestamp: new Date(1300).toISOString(),
    },
  ];

  const timeline = buildReplayTimeline(events);

  assert.equal(timeline.length, 2);
  assert.equal(timeline[0].timelineLabel, "Writing and revision session");
  assert.match(timeline[0].timelinePreview, /1 deleted/);
  assert.deepEqual(timeline[0].timelineEventKeys, [
    "insert",
    "delete",
    "rewrite",
  ]);
  assert.equal(timeline[1].timelineKind, "paste");
  assert.equal(timeline[1].timelineEvents.length, 1);
});
