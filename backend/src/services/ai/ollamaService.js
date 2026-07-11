"use strict";

/**
 * @module ollamaService
 * Low-level HTTP client for the Ollama REST API.
 *
 * Features:
 *  - Configurable via src/config/ai.js (reads from env vars)
 *  - Optional Bearer-token auth header
 *  - Per-minute rate limiting using a token-bucket approach
 *  - Exponential-backoff retry (up to maxRetries) on HTTP 429 / network errors
 *  - Respects `Retry-After` header from the server
 *  - Structured console logging for every request/response
 */

const axios = require("axios");
const aiConfig = require("../../config/ai");

// ─── Token-bucket rate limiter ────────────────────────────────────────────────
// We keep a rolling window of request timestamps (last minute).
/** @type {number[]} timestamps of recent requests (epoch ms) */
const requestTimestamps = [];

/**
 * Waits (if necessary) so that the next request stays within the
 * `rateLimitPerMin` budget.  Mutates `requestTimestamps` in place.
 *
 * @returns {Promise<void>}
 */
const waitForRateLimit = async () => {
  const now = Date.now();
  const windowStart = now - 60_000; // 1-minute rolling window

  // Drop timestamps outside the window
  while (requestTimestamps.length > 0 && requestTimestamps[0] < windowStart) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= aiConfig.rateLimitPerMin) {
    // Calculate how long we must wait before the oldest slot expires
    const waitMs = requestTimestamps[0] - windowStart + 10; // +10ms safety buffer
    console.log(
      `[OllamaService] Rate limit reached (${aiConfig.rateLimitPerMin} req/min). ` +
        `Waiting ${waitMs}ms before next request…`
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    // Recurse in case the window shifted during the wait
    return waitForRateLimit();
  }

  requestTimestamps.push(Date.now());
};

// ─── HTTP client factory ──────────────────────────────────────────────────────

/**
 * Builds the Axios request headers, optionally including Authorization.
 * @returns {Record<string, string>}
 */
const buildHeaders = () => {
  const headers = { "Content-Type": "application/json" };
  if (aiConfig.apiKey) {
    headers["Authorization"] = `Bearer ${aiConfig.apiKey}`;
  }
  return headers;
};

// ─── Core request function ────────────────────────────────────────────────────

/**
 * Sends a single prompt to the Ollama `/api/generate` endpoint and returns
 * the raw response string.
 *
 * @param {string} prompt - The full prompt text to send.
 * @param {object} [options]
 * @param {string} [options.model]   - Override the configured model.
 * @returns {Promise<string>} The model's text response.
 * @throws {Error} On non-retryable errors or when all retries are exhausted.
 */
const sendPrompt = async (prompt, options = {}) => {
  const model = options.model ?? aiConfig.model;
  const baseUrl = aiConfig.ollamaUrl;
  
  const isGroq = baseUrl.includes("groq.com");
  const isChatCompletions = baseUrl.endsWith("/chat/completions") || baseUrl.endsWith("/completions") || isGroq;

  let url = `${baseUrl}/api/generate`;
  let postBody;

  if (isChatCompletions) {
    url = baseUrl.endsWith("/chat/completions") ? baseUrl : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
    postBody = {
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 2048,
    };
  } else {
    postBody = {
      model,
      prompt,
      format: "json",
      stream: false, // We want the full response in one shot
      options: {
        temperature: 0.7,
        num_predict: 2048,
      },
    };
  }

  let attempt = 0;

  while (attempt <= aiConfig.maxRetries) {
    // Honour rate limit before every attempt
    await waitForRateLimit();

    attempt++;
    const attemptLabel = `attempt ${attempt}/${aiConfig.maxRetries + 1}`;

    console.log(
      `[OllamaService] → POST ${url} | model=${model} | ${attemptLabel} | ` +
        `prompt_length=${prompt.length}`
    );

    try {
      const response = await axios.post(
        url,
        postBody,
        {
          headers: buildHeaders(),
          timeout: aiConfig.timeoutMs,
        }
      );

      const text = isChatCompletions
        ? (response.data?.choices?.[0]?.message?.content ?? "")
        : (response.data?.response ?? "");

      console.log(
        `[OllamaService] ← 200 OK | ${attemptLabel} | response_length=${text.length}`
      );
      return text;
    } catch (err) {
      const status = err.response?.status;
      const isRateLimited = status === 429;
      // If there's no status, it's likely ECONNREFUSED. We shouldn't retry local network failures to allow fallbacks to kick in instantly.
      const isNetworkError = !status; 
      const isRetryable = isRateLimited; // Only retry on 429

      console.error(
        `[OllamaService] ✗ ${attemptLabel} failed | status=${status ?? "network"} | ` +
          `msg=${err.message} | data=${JSON.stringify(err.response?.data)}`
      );

      // If no more retries or non-retryable, throw immediately
      if (!isRetryable || attempt > aiConfig.maxRetries) {
        throw new Error(
          `OllamaService: request failed after ${attempt} attempt(s). ` +
            `Status: ${status ?? "network error"}. Message: ${err.message}`
        );
      }

      // Determine backoff delay
      let delayMs;
      if (isRateLimited && err.response?.headers?.["retry-after"]) {
        delayMs = parseInt(err.response.headers["retry-after"], 10) * 1000;
        console.log(
          `[OllamaService] Server requested Retry-After: ${delayMs}ms`
        );
      } else {
        // Exponential backoff: 1s, 2s, 4s …
        delayMs = Math.pow(2, attempt - 1) * 1_000;
      }

      console.log(
        `[OllamaService] Retrying in ${delayMs}ms (${attemptLabel})…`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should be unreachable, but satisfy the linter
  throw new Error("OllamaService: exhausted all retries.");
};

module.exports = { sendPrompt };
