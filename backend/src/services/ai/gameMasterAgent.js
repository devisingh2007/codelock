"use strict";

/**
 * @module gameMasterAgent
 * AI agent that interacts with the Ollama API to generate game master actions (hints, events, clues).
 */

const ollamaService = require("./ollamaService");
const aiConfig = require("../../config/ai");

/**
 * Generates an action from the LLM based on the game status and the trigger rule.
 *
 * @param {object} params
 * @param {string} params.triggerType - The rule that triggered the intervention ('stuck' | 'false_accusation' | 'repeated_claims').
 * @param {string} params.reason - Explanation of why the rule triggered.
 * @param {object} params.story - The general mystery details.
 * @param {Array<{sender: string, message: string}>} params.recentMsgs - The list of recent messages.
 * @returns {Promise<{ actionType: 'hint' | 'event' | 'clue', content: string, recipient?: string, payload?: object }>}
 */
async function generateGMAction({ triggerType, reason, story, recentMsgs }) {
  const messagesContext = recentMsgs
    .map((m) => `${m.sender}: ${m.message}`)
    .join("\n");

  const prompt = `You are the AI Game Master (GM) for a multiplayer murder-mystery game.
The game location is: "${story.location}".
The victim is: "${story.victim?.name}" (${story.victim?.description}).
The true killer/murderer is: "${story.crime?.killer}".
The suspects are: ${JSON.stringify(story.suspects || [])}.

An intervention rule has been triggered:
Trigger Type: ${triggerType}
Reason: ${reason}

Recent chat messages from players:
${messagesContext}

As the Game Master, you must intervene to guide the players, resolve a false accusation, address repeated claims, or provide a hint/clue.
Your response MUST be a single valid JSON object with the following structure:
{
  "actionType": "hint" | "event" | "clue",
  "content": "The message or announcement from the Game Master to be shown to the players.",
  "recipient": "all" | "username_of_player",
  "payload": {
    "clueName": "Optional name of the clue if actionType is clue",
    "details": "Any optional extra details"
  }
}

Rules for actions:
1. If triggerType is "stuck", you should provide a "hint" or introduce an "event" to push the story forward.
2. If triggerType is "false_accusation", you should output a "hint" or "event" that subtly points away from the falsely accused suspect, or provides a new detail that clarifies things. Do NOT directly state who the real murderer is.
3. If triggerType is "repeated_claims", you should output a "hint" addressing the repeated claim, either confirming it, debunking it, or suggesting they look elsewhere.
4. Output ONLY valid JSON. No markdown, no code blocks (do not use \`\`\`json), no extra text.`;

  // Rate limiter / backoff wait
  // The ollamaService already has token-bucket rate limits, but we can respect GM specific backoff settings if needed.
  if (aiConfig.gmBackoffMs) {
    await new Promise((resolve) => setTimeout(resolve, 50)); // minor pause
  }

  const rawResponse = await ollamaService.sendPrompt(prompt);
  const action = parseAndValidateGMAction(rawResponse);
  return action;
}

/**
 * Extracts and validates the GM action JSON from the raw LLM response.
 *
 * @param {string} raw - The raw text response from Ollama.
 * @returns {object}
 * @throws {Error}
 */
function parseAndValidateGMAction(raw) {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "");
  }
  cleaned = cleaned.trim();

  // Find the first { and last }
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error("Could not find JSON object bounds in GM response.");
  }
  cleaned = cleaned.substring(startIdx, endIdx + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Failed to parse GM action JSON: ${err.message}`);
  }

  // Validate fields
  if (!parsed.actionType || !["hint", "event", "clue"].includes(parsed.actionType)) {
    throw new Error(`Invalid or missing actionType: ${parsed.actionType}`);
  }

  if (!parsed.content || typeof parsed.content !== "string") {
    throw new Error("Missing or invalid content field in GM action.");
  }

  parsed.recipient = parsed.recipient || "all";
  parsed.payload = parsed.payload || {};

  return parsed;
}

module.exports = {
  generateGMAction,
  parseAndValidateGMAction,
};
