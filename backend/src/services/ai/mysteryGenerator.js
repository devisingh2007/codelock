"use strict";

/**
 * @module mysteryGenerator
 * Generates a murder-mystery JSON document using the Ollama LLM.
 *
 * Usage:
 *   const { generateMystery } = require('./mysteryGenerator');
 *   const mystery = await generateMystery({ playersCount: 4, difficulty: 'medium', locationHints: 'Victorian manor' });
 */

const ollamaService = require("./ollamaService");
const { validateMystery } = require("../../utils/mysteryValidator");

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Builds the primary prompt for the LLM.
 *
 * @param {object} params
 * @param {number} params.playersCount    – Number of players (= number of suspects required)
 * @param {string} params.difficulty      – "easy" | "medium" | "hard"
 * @param {string} [params.locationHints] – Optional location flavour text
 * @returns {string}
 */
const buildPrompt = ({ playersCount, difficulty, locationHints }) => {
  const location = locationHints
    ? `The setting is: ${locationHints}.`
    : "Choose a dramatic and fitting location.";

  return `Generate a murder mystery for ${playersCount} players (difficulty: ${difficulty}). ${location}

The output MUST be a single valid JSON object with EXACTLY these keys: "title", "location", "victim", "crime", "suspects", "timeline".
Do NOT include any explanatory text, markdown, code fences, or any characters outside the JSON object.

Required schema:
{
  "title": "A creative title for the mystery",
  "location": "Specific location name and brief description",
  "victim": {
    "name": "Full name of the victim",
    "description": "Short background about the victim"
  },
  "crime": {
    "type": "Type of crime (e.g. poisoning, stabbing, strangulation)",
    "weapon": "The murder weapon",
    "summary": "Two to three sentences describing how the crime occurred",
    "killer": "Full name of the murderer (must exactly match one suspect name)"
  },
  "suspects": [
    {
      "name": "Suspect full name",
      "background": "Brief backstory",
      "relationshipToVictim": "How they knew the victim",
      "isMurderer": false
    }
  ],
  "timeline": [
    { "time": "HH:MM", "event": "What happened at this time" }
  ]
}

Rules:
- Provide EXACTLY ${playersCount} suspects.
- Exactly ONE suspect must have "isMurderer": true; all others must have "isMurderer": false.
- The "crime.killer" field must exactly match the "name" of the suspect where "isMurderer" is true.
- The "timeline" must have at least 4 entries covering the evening of the murder.
- Return ONLY the raw JSON object. No markdown, no code blocks, no extra text.`;
};

/**
 * Builds a follow-up clarification prompt when the first attempt returned
 * invalid or un-parseable output.
 *
 * @param {number} playersCount
 * @param {string[]} validationErrors – Errors from the previous attempt
 * @returns {string}
 */
const buildClarificationPrompt = (playersCount, validationErrors) => {
  const errorList = validationErrors.map((e) => `  - ${e}`).join("\n");
  return `Your previous response was not valid JSON or failed validation with these errors:\n${errorList}\n\n` +
    `Return ONLY valid JSON matching the required schema. Fix all errors listed above.\n` +
    `Provide exactly ${playersCount} suspects, exactly one with "isMurderer": true.\n` +
    `Output ONLY the raw JSON object with no extra text, no markdown, no code fences.`;
};

// ─── JSON extractor ───────────────────────────────────────────────────────────

/**
 * Attempts to extract a JSON object from a raw LLM response string.
 * Models sometimes wrap JSON in markdown code fences or add preamble text.
 *
 * @param {string} raw – Raw LLM response text.
 * @returns {object} Parsed JSON object.
 * @throws {SyntaxError} If no valid JSON object can be found.
 */
const extractJson = (raw) => {
  // 1. Try direct parse first (ideal case)
  try {
    return JSON.parse(raw.trim());
  } catch (_) {
    /* fall through */
  }

  // 2. Strip markdown code fences: ```json ... ``` or ``` ... ```
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch (_) {
      /* fall through */
    }
  }

  // 3. Find the first { … } block
  const braceStart = raw.indexOf("{");
  const braceEnd = raw.lastIndexOf("}");
  if (braceStart !== -1 && braceEnd > braceStart) {
    try {
      return JSON.parse(raw.slice(braceStart, braceEnd + 1));
    } catch (_) {
      /* fall through */
    }
  }

  throw new SyntaxError("Could not extract a valid JSON object from AI response.");
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a murder-mystery scenario using the Ollama LLM.
 * Automatically retries up to 2 additional times with a clarified prompt
 * if the response is not valid JSON or fails validation.
 *
 * @param {object} params
 * @param {number} [params.playersCount=4]       – Number of players / suspects.
 * @param {string} [params.difficulty="medium"]  – Difficulty tier.
 * @param {string} [params.locationHints=""]     – Optional location flavour.
 * @returns {Promise<object>} Validated mystery object ready to save to DB.
 * @throws {Error} If all attempts fail.
 */
const generateMystery = async ({
  playersCount = 4,
  difficulty = "medium",
  locationHints = "",
} = {}) => {
  const MAX_PARSE_RETRIES = 2;

  let prompt = buildPrompt({ playersCount, difficulty, locationHints });
  let lastErrors = [];

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    console.log(
      `[MysteryGenerator] Generating mystery (parse attempt ${attempt + 1}/${MAX_PARSE_RETRIES + 1}) ` +
        `| players=${playersCount} | difficulty=${difficulty}`
    );

    const raw = await ollamaService.sendPrompt(prompt);

    // Try to parse
    let parsed;
    try {
      parsed = extractJson(raw);
    } catch (parseErr) {
      console.warn(`[MysteryGenerator] JSON parse failed: ${parseErr.message}`);
      lastErrors = [`JSON parse error: ${parseErr.message}`];

      if (attempt < MAX_PARSE_RETRIES) {
        prompt = buildClarificationPrompt(playersCount, lastErrors);
        continue;
      }
      break;
    }

    // Validate structure
    const validationErrors = validateMystery(parsed, playersCount);

    if (validationErrors.length === 0) {
      console.log("[MysteryGenerator] ✓ Mystery generated and validated successfully.");
      return parsed;
    }

    console.warn(
      `[MysteryGenerator] Validation failed (attempt ${attempt + 1}):`,
      validationErrors
    );
    lastErrors = validationErrors;

    if (attempt < MAX_PARSE_RETRIES) {
      prompt = buildClarificationPrompt(playersCount, validationErrors);
    }
  }

  // All attempts exhausted
  throw new Error(
    `[MysteryGenerator] Failed to generate a valid mystery after ${MAX_PARSE_RETRIES + 1} attempts. ` +
      `Last errors: ${lastErrors.join("; ")}`
  );
};

module.exports = { generateMystery, buildPrompt, extractJson };
