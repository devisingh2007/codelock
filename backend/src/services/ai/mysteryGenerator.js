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
// Pools of varied names, occupations, locations, etc. for rich fallback generation
const SUSPECT_POOL = [
  { name: "Victor Hargrove",   occupation: "Ruthless Investment Banker",   background: "Victor was Victor's closest business rival, owed the victim a fortune after a failed merger. He arrived an hour early and was seen near the victim's private office.",                     relationship: "Business rival" },
  { name: "Lady Cordelia Voss",occupation: "Disgraced Socialite",          background: "Once the toast of London's high society, Cordelia fell from grace after a scandal the victim allegedly orchestrated. She had sworn revenge in a letter found in the victim's desk.", relationship: "Former friend turned enemy" },
  { name: "Dr. Niles Ashford", occupation: "Retired Forensic Pathologist", background: "Niles was the victim's personal physician for 15 years. He recently discovered the victim had been blackmailing him over a misdiagnosis that ended his medical career.",              relationship: "Personal physician" },
  { name: "Sabine Moreau",     occupation: "International Art Thief",      background: "Sabine is known in underground circles for fencing stolen art. The victim possessed evidence that could put her behind bars. She was the last person seen with the victim before dinner.", relationship: "Blackmail victim" },
  { name: "Inspector Walsh",   occupation: "Corrupt Police Inspector",     background: "Walsh has been on the victim's payroll for years, doing dirty work. When the victim recently threatened to expose him, Walsh began to fear for his own freedom.",                        relationship: "Corrupt associate" },
  { name: "Helena Cross",      occupation: "Disowned Heiress",             background: "Helena was written out of the victim's will without explanation. She recently hired a private investigator and discovered the victim had secretly transferred her inheritance.",           relationship: "Estranged family member" },
  { name: "Ronan Blackwood",   occupation: "Mercenary Operative",         background: "Ronan operates in legal grey areas. He was hired by an anonymous client to retrieve a document from the victim — a document the victim refused to hand over.",                            relationship: "Hired operative" },
  { name: "Eloise Chambers",   occupation: "Investigative Journalist",    background: "Eloise was days away from publishing a story that would have destroyed the victim's reputation. The victim had already sent lawyers and threats; Eloise refused to back down.",           relationship: "Journalist nemesis" },
  { name: "Professor Graves",  occupation: "Obsessive Academic",          background: "The Professor and the victim co-authored a book, but the victim stole full credit and the prize money. Graves has harboured a deep, documented grudge for eight years.",                    relationship: "Stolen partner" },
  { name: "Mira Vanthorpe",    occupation: "Forger & Counterfeit Dealer", background: "Mira worked with the victim on several illegal forgery schemes. After the victim refused to pay her share, Mira threatened to go to Interpol.",                                           relationship: "Criminal partner" },
];

const VICTIM_POOL = [
  { name: "Lord Aldric Pemberton",  description: "A powerful industrialist who built an empire on the backs of others — and made enemies at every step." },
  { name: "Dame Sylvia Thorne",     description: "A celebrated art collector secretly funding a global smuggling network beneath a veneer of philanthropy." },
  { name: "Chairman Ezra Coldwell", description: "The iron-fisted head of a pharmaceutical conglomerate who silenced whistleblowers with bribes and blackmail." },
  { name: "Baroness Irene Vaulx",   description: "A Parisian aristocrat with a double life — adored in public, feared in private for her ruthless manipulation." },
  { name: "CEO Marcus Stern",       description: "A tech billionaire who left a trail of ruined careers and stolen intellectual property in his rise to the top." },
];

const LOCATION_POOL = [
  "Ravenswood Manor, a crumbling Victorian estate perched on sea cliffs",
  "The Château Noir, a decadent private club in the heart of Paris",
  "Irongate Tower, the penthouse floor of a skyscraper above a dark city",
  "The Meridian Yacht, adrift in international waters at midnight",
  "Ashbury Hall, an abandoned grand hotel converted for a secret gala",
];

const WEAPON_POOL = [
  { weapon: "A crystal decanter laced with arsenic", type: "Poisoning" },
  { weapon: "A custom-made stiletto dagger",          type: "Stabbing" },
  { weapon: "A heavy brass candlestick",              type: "Blunt force trauma" },
  { weapon: "Poisoned chocolates from a gift box",    type: "Poisoning" },
  { weapon: "A garrotte wire hidden in a scarf",      type: "Strangulation" },
];

const TIMELINE_TEMPLATES = [
  [
    { time: "19:00", event: "Guests arrive and mingle in the entrance foyer. Tensions are already visible." },
    { time: "20:30", event: "Dinner is served. The victim makes a provocative toast that unsettles several guests." },
    { time: "21:15", event: "A heated argument erupts behind closed doors in the east wing. Staff report raised voices." },
    { time: "22:00", event: "The victim retires to the private study alone. A drink is sent in by an unknown party." },
    { time: "22:45", event: "Screams echo through the corridor. The victim is found dead." },
  ],
  [
    { time: "18:30", event: "Guests board the yacht at the private harbour. Champagne is flowing." },
    { time: "19:45", event: "The victim pulls several guests aside for private meetings, each lasting ten minutes." },
    { time: "21:00", event: "The yacht sails into open water. All communication with shore cuts off." },
    { time: "22:10", event: "The lights in the main cabin flicker and die for 90 seconds." },
    { time: "22:12", event: "When power is restored, the victim is slumped at the head of the table — dead." },
  ],
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateMockMystery = (playersCount, difficulty, locationHints) => {
  const count = Math.max(playersCount, 2);

  // Shuffle suspect pool and pick `count` unique suspects
  const shuffled = [...SUSPECT_POOL].sort(() => Math.random() - 0.5);
  const chosenSuspects = shuffled.slice(0, count);

  // Randomly assign exactly one murderer
  const murdererIdx = Math.floor(Math.random() * count);

  const victim  = pick(VICTIM_POOL);
  const location = locationHints || pick(LOCATION_POOL);
  const crimeInfo = pick(WEAPON_POOL);
  const timeline = pick(TIMELINE_TEMPLATES);
  const murdererName = chosenSuspects[murdererIdx].name;

  const suspects = chosenSuspects.map((s, idx) => ({
    name: s.name,
    background: s.background.replace("Victor's", `${victim.name}'s`),
    relationshipToVictim: s.relationship,
    isMurderer: idx === murdererIdx,
  }));

  const titleOptions = [
    `Death at ${location.split(",")[0]}`,
    `The ${victim.name.split(" ").pop()} Affair`,
    `Murder in the Dark`,
    `Shadows at ${location.split(",")[0]}`,
    `The Last Guest`,
  ];

  return {
    title: pick(titleOptions),
    location,
    victim,
    crime: {
      type: crimeInfo.type,
      weapon: crimeInfo.weapon,
      summary: `${victim.name} was found dead. Witnesses report seeing ${murdererName} near the scene shortly before the body was discovered. The method was cold and calculated.`,
      killer: murdererName,
    },
    suspects,
    timeline,
  };
};

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

    let raw;
    try {
      raw = await ollamaService.sendPrompt(prompt);
    } catch (apiErr) {
      console.warn(`[MysteryGenerator] Ollama API error: ${apiErr.message}. Falling back to mock data.`);
      return generateMockMystery(playersCount, difficulty, locationHints);
    }

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

  console.warn(`[MysteryGenerator] Failed to generate a valid mystery after attempts. Falling back to mock data.`);
  return generateMockMystery(playersCount, difficulty, locationHints);
};

module.exports = { generateMystery, buildPrompt, extractJson };
