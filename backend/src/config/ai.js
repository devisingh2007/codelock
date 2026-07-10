/**
 * @module ai
 * Centralised configuration for the Ollama AI integration (Phase 6).
 * All values are read from environment variables so that no secrets are
 * ever hard-coded.
 *
 * Environment variables (add to .env):
 *   OLLAMA_URL              – Base URL of the Ollama server (default: http://localhost:11434)
 *   OLLAMA_MODEL            – Model name to use           (default: llama3)
 *   OLLAMA_API_KEY          – Optional Bearer token       (default: "")
 *   OLLAMA_RATE_LIMIT_PER_MIN – Max requests per minute   (default: 10)
 *   OLLAMA_TIMEOUT_MS       – Request timeout in ms       (default: 60000)
 *   OLLAMA_MAX_RETRIES      – Max retry attempts          (default: 3)
 */

"use strict";

const aiConfig = {
  /** Base URL of the running Ollama instance */
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",

  /** Ollama model identifier */
  model: process.env.OLLAMA_MODEL || "llama3",

  /**
   * Optional API key sent as "Authorization: Bearer <key>".
   * Leave empty / unset if the local Ollama does not require auth.
   */
  apiKey: process.env.OLLAMA_API_KEY || "",

  /**
   * Client-side rate limit: maximum number of requests per minute.
   * The service will queue/delay calls that would exceed this limit.
   */
  rateLimitPerMin: parseInt(process.env.OLLAMA_RATE_LIMIT_PER_MIN, 10) || 10,

  /** Axios request timeout in milliseconds */
  timeoutMs: parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || 60_000,

  /** Maximum number of retry attempts on failure */
  maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES, 10) || 3,

  /** Role assignment rate limit in seconds per room */
  roleAssignRateLimit: parseInt(process.env.ROLE_ASSIGN_RATE_LIMIT, 10) || 60,
};

module.exports = aiConfig;
