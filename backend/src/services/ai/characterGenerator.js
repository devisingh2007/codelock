/**
 * @module characterGenerator
 * Service layer for AI-driven character role and secret generation.
 */

"use strict";

const ollamaService = require("./ollamaService");

/**
 * Extracts and parses JSON from raw LLM output.
 *
 * @param {string} raw - Raw text from the LLM.
 * @returns {object} Parsed JSON object.
 * @throws {SyntaxError} If JSON extraction/parsing fails.
 */
const extractJson = (raw) => {
  if (!raw) {
    throw new SyntaxError("Empty AI response.");
  }

  // 1. Try direct parse
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

/**
 * Builds the LLM prompt for role generation based on the story.
 *
 * @param {object} story - GameState.story object.
 * @returns {string} Prompt string.
 */
const buildPrompt = (story) => {
  const suspects = story.suspects || [];
  const suspectsList = suspects
    .map(
      (s) =>
        `- ${s.name}: ${s.background || ""} (Relationship: ${s.relationshipToVictim || ""})${
          s.isMurderer ? " [Murderer]" : ""
        }`
    )
    .join("\n");

  return `You are a professional game designer creating secret roles for a murder mystery game.
Based on the mystery story details below, create a secret role assignment for each of the suspects.
You must generate exactly one role for each suspect listed below.

Story Context:
Title: ${story.title || "Unknown"}
Location: ${story.location || "Unknown"}
Victim: ${story.victim?.name || "Unknown"} - ${story.victim?.description || ""}
Crime: ${story.crime?.summary || ""}
Murderer: ${story.crime?.killer || ""}

Suspects list to generate roles for:
${suspectsList}

You must return a JSON object with a single top-level key "roles".
Each role object in the "roles" array must have the following fields:
- "roleName": (must match the name of the suspect from the list exactly, e.g. if the suspect is named "Bob", roleName must be "Bob")
- "background": (the suspect's background, max 300 characters)
- "objective": (the suspect's secret objective in the game, max 300 characters)
- "secret": (a deep private secret or clue that only they know, max 300 characters)
- "clues": (an array of strings containing clues or rumors this suspect has heard, each clue max 300 characters)

JSON Schema to return:
{
  "roles": [
    {
      "roleName": "Suspect Name",
      "background": "Detailed background...",
      "objective": "Objective in the game...",
      "secret": "A secret only they know...",
      "clues": ["Clue 1", "Clue 2"]
    }
  ]
}

Ensure all fields are filled, non-empty, and under 300 characters.
Return ONLY the raw JSON block. No markdown formatting, no conversational text, no preambles, and no postambles.`;
};

/**
 * Builds a prompt for clarifying errors to correct invalid LLM responses.
 *
 * @param {object} story - GameState.story object.
 * @param {string[]} errors - List of validation errors from the last attempt.
 * @returns {string} Clarification prompt string.
 */
const buildClarificationPrompt = (story, errors) => {
  return `${buildPrompt(story)}

WARNING: Your previous attempt failed validation with the following errors:
${errors.map((e) => `- ${e}`).join("\n")}

Please correct these errors. Make sure all fields (roleName, background, objective, secret) are present, non-empty, under 300 characters, and that the role names match the suspects in the story exactly. Return ONLY valid JSON.`;
};

/**
 * Generates character roles using the Ollama LLM based on the game story.
 *
 * @param {object} story - GameState.story object.
 * @returns {Promise<object[]>} Array of sanitized and trimmed role objects.
 * @throws {Error} If all generation attempts fail.
 */
const generateCharacters = async (story) => {
  const MAX_ATTEMPTS = 3;
  let prompt = buildPrompt(story);
  let lastErrors = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(
      `[CharacterGenerator] Generating characters (attempt ${attempt}/${MAX_ATTEMPTS})`
    );

    try {
      const raw = await ollamaService.sendPrompt(prompt);
      const parsed = extractJson(raw);

      if (!parsed || !Array.isArray(parsed.roles)) {
        throw new Error("Missing 'roles' array in parsed JSON.");
      }

      // Map, sanitize, trim, and truncate fields to 300 characters max
      const sanitizedRoles = parsed.roles.map((role) => {
        // Map publicClues or clues to clues key
        const rawClues = role.clues || role.publicClues || [];
        const clues = (Array.isArray(rawClues) ? rawClues : [rawClues])
          .map((c) => String(c).trim().slice(0, 300))
          .filter(Boolean);

        return {
          roleName: String(role.roleName || "").trim().slice(0, 300),
          background: String(role.background || "").trim().slice(0, 300),
          objective: String(role.objective || "").trim().slice(0, 300),
          secret: String(role.secret || "").trim().slice(0, 300),
          clues,
        };
      });

      // Basic structure validation: check non-empty fields
      const validationErrors = [];
      sanitizedRoles.forEach((role, idx) => {
        if (!role.roleName) validationErrors.push(`roleName at index ${idx} is empty.`);
        if (!role.background) validationErrors.push(`background at index ${idx} is empty.`);
        if (!role.objective) validationErrors.push(`objective at index ${idx} is empty.`);
        if (!role.secret) validationErrors.push(`secret at index ${idx} is empty.`);
      });

      if (validationErrors.length === 0) {
        console.log(`[CharacterGenerator] ✓ Successfully generated ${sanitizedRoles.length} roles.`);
        return sanitizedRoles;
      }

      console.warn(`[CharacterGenerator] Validation failed on attempt ${attempt}:`, validationErrors);
      lastErrors = validationErrors;
      prompt = buildClarificationPrompt(story, validationErrors);
    } catch (err) {
      console.warn(`[CharacterGenerator] Attempt ${attempt} failed: ${err.message}`);
      lastErrors = [err.message];
      prompt = buildClarificationPrompt(story, [err.message]);
    }
  }

  throw new Error(
    `[CharacterGenerator] Failed to generate valid character roles after ${MAX_ATTEMPTS} attempts. Last errors: ${lastErrors.join(
      "; "
    )}`
  );
};

module.exports = {
  generateCharacters,
};
