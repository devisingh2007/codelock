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

const MURDERER_SECRETS = [
  "You slipped the poison into their drink during the distraction at 22:00. You knew exactly what you were doing.",
  "You used your knowledge of the estate's back passages to approach unseen. No one saw you enter the private room.",
  "You had practiced the plan for weeks. The weapon was concealed in your coat all evening.",
  "You waited until everyone was distracted by the argument in the east wing. Your hands were steady.",
];

const INNOCENT_SECRETS = [
  "You were secretly meeting with a private investigator that evening to gather evidence against the victim yourself — for entirely different reasons.",
  "You had been embezzling a small amount from a joint account with the victim. You were terrified they were about to expose you.",
  "You slipped out to make a call to your contact in Geneva at exactly 22:00. You cannot reveal who you were calling without blowing your cover.",
  "You took a valuable item from the victim's study earlier in the evening — not related to the murder, but deeply incriminating.",
  "You witnessed the argument between the victim and another guest but chose to say nothing to protect someone you care about.",
  "You overheard the victim speaking on the phone about a dangerous deal that would ruin several people in this very room.",
  "You have a second identity that the victim had just discovered. You were desperate to find out how much they had told others.",
];

const MURDERER_CLUES = [
  ["You were seen near the private study at 22:05 — but you claim you were in the drawing room.", "A faint residue matching the weapon was found near your seat at the table."],
  ["Your alibi for the critical window has a 15-minute gap you cannot explain.", "A staff member noticed you were unusually calm when the body was discovered."],
  ["You had private knowledge of the victim's evening schedule that only an insider would know.", "Your fingerprints were found on a glass that does not belong to your usual place setting."],
];

const INNOCENT_CLUES = [
  ["You noticed the victim received an unsigned note during dinner but thought nothing of it.", "You heard footsteps outside your door around 22:10 — heavy, deliberate steps."],
  ["You saw someone adjust their jacket suspiciously near the drinks cabinet before dinner.", "The victim appeared distracted and anxious all evening — unlike their usual demeanour."],
  ["A glass was moved from its original position near the victim's seat between the first and second course.", "You overheard a whispered argument in French near the entrance at approximately 21:30."],
  ["You found a torn piece of paper with partial coordinates near the fireplace — it was gone by morning.", "The victim's personal assistant left the room hurriedly and did not return for twenty minutes."],
  ["You noticed the victim checked their watch compulsively in the final hour — as if expecting something.", "One of the guests spent an unusually long time alone on the terrace despite the cold night air."],
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateMockCharacters = (story) => {
  const suspects = story.suspects || [];
  const victim = story.victim || {};
  const crime = story.crime || {};

  const usedInnocentSecrets = new Set();
  const usedInnocentClues = new Set();

  return suspects.map(s => {
    if (s.isMurderer) {
      return {
        roleName: String(s.name || "Unknown").trim().slice(0, 300),
        background: String(s.background || "A shadowy figure with much to hide.").trim().slice(0, 300),
        objective: `Survive the night. Deflect every accusation. Make sure ${victim.name || "the victim"} stays dead and you stay free.`,
        secret: pickRandom(MURDERER_SECRETS),
        clues: pickRandom(MURDERER_CLUES),
      };
    }

    // Pick a unique secret for each innocent suspect
    let secretIdx;
    do { secretIdx = Math.floor(Math.random() * INNOCENT_SECRETS.length); }
    while (usedInnocentSecrets.has(secretIdx) && usedInnocentSecrets.size < INNOCENT_SECRETS.length);
    usedInnocentSecrets.add(secretIdx);

    // Pick unique clues
    let clueIdx;
    do { clueIdx = Math.floor(Math.random() * INNOCENT_CLUES.length); }
    while (usedInnocentClues.has(clueIdx) && usedInnocentClues.size < INNOCENT_CLUES.length);
    usedInnocentClues.add(clueIdx);

    return {
      roleName: String(s.name || "Unknown").trim().slice(0, 300),
      background: String(s.background || "An enigmatic guest with a hidden past.").trim().slice(0, 300),
      objective: `Investigate the murder of ${victim.name || "the victim"}. You did NOT commit this crime — but you have your own secrets to protect. Find the real killer before they frame you.`,
      secret: INNOCENT_SECRETS[secretIdx],
      clues: INNOCENT_CLUES[clueIdx],
    };
  });
};

const generateCharacters = async (story) => {
  const MAX_ATTEMPTS = 3;
  let prompt = buildPrompt(story);
  let lastErrors = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(
      `[CharacterGenerator] Generating characters (attempt ${attempt}/${MAX_ATTEMPTS})`
    );

    let raw;
    try {
      raw = await ollamaService.sendPrompt(prompt);
    } catch (err) {
      console.warn(`[CharacterGenerator] Ollama API error on attempt ${attempt}: ${err.message}. Falling back to mock roles.`);
      return generateMockCharacters(story);
    }

    try {
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
      console.warn(`[CharacterGenerator] Parsing Attempt ${attempt} failed: ${err.message}`);
      lastErrors = [err.message];
      prompt = buildClarificationPrompt(story, [err.message]);
    }
  }

  console.warn(`[CharacterGenerator] Failed to generate valid character roles after ${MAX_ATTEMPTS} attempts. Falling back to mock data.`);
  return generateMockCharacters(story);
};

module.exports = {
  generateCharacters,
};
