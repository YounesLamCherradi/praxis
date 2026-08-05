import { authenticatedFetch } from "./auth.js";

const AI_JOB_ENDPOINT = "/api/ai-jobs";
const DEFAULT_TIMEOUT_MS = 125_000;
const POLL_INTERVAL_MS = 1_000;

function wait(milliseconds) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) {
    const error = new Error(
      data.error || `AI request failed with status ${response.status}.`
    );
    error.status = response.status;
    error.retryable = data.retryable === true;
    throw error;
  }
  return data;
}

/**
 * Run a potentially slow AI request without holding the Netlify-to-Render
 * proxy connection open. Each HTTP request stays short while the browser polls
 * for the completed result.
 */
export async function runAiJob(target, payload, {
  timeoutMs = DEFAULT_TIMEOUT_MS,
  pollIntervalMs = POLL_INTERVAL_MS,
} = {}) {
  const initialResponse = await authenticatedFetch(AI_JOB_ENDPOINT, {
    method: "POST",
    body: JSON.stringify({ target, payload }),
    timeoutMs: 20_000,
    retryDelaysMs: [],
  });
  const initial = await readJson(initialResponse);
  const jobId = String(initial.jobId || "");
  if (!jobId) throw new Error("AI service did not return a job identifier.");

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await wait(pollIntervalMs);
    const response = await authenticatedFetch(
      `${AI_JOB_ENDPOINT}/${encodeURIComponent(jobId)}`,
      {
        method: "GET",
        timeoutMs: 20_000,
        // A non-2xx response can be the completed job's real outcome. Do not
        // replay this one-shot result request automatically.
        retryDelaysMs: [],
      }
    );
    const data = await readJson(response);
    if (data.status === "processing") continue;
    if (data.status === "complete") return data.result || {};
    throw new Error(data.error || "AI request failed.");
  }

  throw new Error("AI request is taking longer than expected. Please try again.");
}
