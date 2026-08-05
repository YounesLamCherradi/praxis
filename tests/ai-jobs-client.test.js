const test = require("node:test");
const assert = require("node:assert/strict");

let runAiJob;

test.before(async () => {
  ({ runAiJob } = await import("../frontend/src/services/aiJobs.js"));
});

test("runAiJob submits once and polls until the result is complete", async () => {
  const originalFetch = global.fetch;
  const calls = [];
  const responses = [
    new Response(JSON.stringify({ jobId: "job-1", status: "processing" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({ status: "processing" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({
      status: "complete",
      result: { response: "Finished feedback" },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ];

  global.fetch = async (path, options) => {
    calls.push({ path, options });
    return responses.shift();
  };

  try {
    const result = await runAiJob(
      "generate",
      { prompt: "Review this" },
      { timeoutMs: 1_000, pollIntervalMs: 0 }
    );

    assert.deepEqual(result, { response: "Finished feedback" });
    assert.equal(calls.length, 3);
    assert.equal(calls[0].path, "/api/ai-jobs");
    assert.deepEqual(JSON.parse(calls[0].options.body), {
      target: "generate",
      payload: { prompt: "Review this" },
    });
    assert.equal(calls[1].path, "/api/ai-jobs/job-1");
  } finally {
    global.fetch = originalFetch;
  }
});

test("runAiJob preserves retryable failures from the completed job", async () => {
  const originalFetch = global.fetch;
  const responses = [
    new Response(JSON.stringify({ jobId: "job-2", status: "processing" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    }),
    new Response(JSON.stringify({
      error: "AI is busy right now.",
      retryable: true,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    }),
  ];

  global.fetch = async () => responses.shift();

  try {
    await assert.rejects(
      runAiJob("generate", {}, { timeoutMs: 1_000, pollIntervalMs: 0 }),
      (error) => {
        assert.equal(error.message, "AI is busy right now.");
        assert.equal(error.status, 429);
        assert.equal(error.retryable, true);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});
