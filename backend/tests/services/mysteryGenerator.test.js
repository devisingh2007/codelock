"use strict";

/**
 * @file tests/services/mysteryGenerator.test.js
 * Unit tests for mysteryGenerator.
 *
 * The Ollama HTTP client (ollamaService) is fully mocked so these tests
 * run without any network access.
 *
 * Covers:
 *  - buildPrompt embeds the correct parameters
 *  - extractJson handles direct JSON, markdown fences, and noisy preamble
 *  - extractJson throws on completely invalid input
 *  - generateMystery returns a validated mystery on the first attempt
 *  - generateMystery retries with a clarification prompt on parse failure
 *  - generateMystery retries when validation fails
 *  - generateMystery throws after exhausting all retries
 */

// Mock ollamaService before loading mysteryGenerator
jest.mock("../../src/services/ai/ollamaService", () => ({
  sendPrompt: jest.fn(),
}));

const ollamaService = require("../../src/services/ai/ollamaService");
const {
  generateMystery,
  buildPrompt,
  extractJson,
} = require("../../src/services/ai/mysteryGenerator");

// Silence noise
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ── Fixture ────────────────────────────────────────────────────────────────────
const VALID_MYSTERY = {
  title: "The Clock Tower Conspiracy",
  location: "Victorian Clock Tower, London",
  victim: {
    name: "Sir Edmund Blackwell",
    description: "Retired admiral with a turbulent past.",
  },
  crime: {
    type: "stabbing",
    weapon: "Ornate letter opener",
    summary:
      "Sir Edmund was found stabbed in his office after the midnight chime.",
    killer: "Lady Constance Wren",
  },
  suspects: [
    {
      name: "Lady Constance Wren",
      background: "Socialite with a hidden vendetta.",
      relationshipToVictim: "Former fiancée",
      isMurderer: true,
    },
    {
      name: "Professor Aldous Finch",
      background: "Historian obsessed with the admiral's journal.",
      relationshipToVictim: "Academic rival",
      isMurderer: false,
    },
    {
      name: "Thomas Grint",
      background: "The admiral's loyal but underpaid butler.",
      relationshipToVictim: "Servant",
      isMurderer: false,
    },
  ],
  timeline: [
    { time: "22:00", event: "Guests arrive at the tower." },
    { time: "23:30", event: "Admiral retires to his office." },
    { time: "00:00", event: "Midnight chime sounds." },
    { time: "00:15", event: "Body discovered by butler." },
  ],
};

// ══════════════════════════════════════════════════════════════════════════════
describe("buildPrompt", () => {
  test("embeds playersCount, difficulty, and locationHints in the prompt", () => {
    const prompt = buildPrompt({
      playersCount: 5,
      difficulty: "hard",
      locationHints: "Abandoned lighthouse",
    });

    expect(prompt).toContain("5 players");
    expect(prompt).toContain("hard");
    expect(prompt).toContain("Abandoned lighthouse");
  });

  test("uses default location text when no locationHints provided", () => {
    const prompt = buildPrompt({ playersCount: 3, difficulty: "easy", locationHints: "" });
    expect(prompt).toContain("Choose a dramatic");
  });

  test("instructs model to return only JSON", () => {
    const prompt = buildPrompt({ playersCount: 2, difficulty: "medium", locationHints: "" });
    expect(prompt.toLowerCase()).toContain("json");
    expect(prompt).toContain("Return ONLY the raw JSON object");
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("extractJson", () => {
  test("parses a raw JSON string directly", () => {
    const raw = JSON.stringify(VALID_MYSTERY);
    const parsed = extractJson(raw);
    expect(parsed.title).toBe(VALID_MYSTERY.title);
  });

  test("strips markdown triple-backtick fences (```json ... ```)", () => {
    const raw = "Here is the mystery:\n```json\n" + JSON.stringify(VALID_MYSTERY) + "\n```";
    const parsed = extractJson(raw);
    expect(parsed.location).toBe(VALID_MYSTERY.location);
  });

  test("strips generic triple-backtick fences (``` ... ```)", () => {
    const raw = "```\n" + JSON.stringify(VALID_MYSTERY) + "\n```";
    const parsed = extractJson(raw);
    expect(parsed.victim.name).toBe(VALID_MYSTERY.victim.name);
  });

  test("extracts JSON from noisy preamble text", () => {
    const raw =
      "Sure thing! " + JSON.stringify(VALID_MYSTERY) + " Hope that helps!";
    const parsed = extractJson(raw);
    expect(parsed.crime.weapon).toBe(VALID_MYSTERY.crime.weapon);
  });

  test("throws SyntaxError on completely non-JSON input", () => {
    expect(() => extractJson("This is not JSON at all.")).toThrow(SyntaxError);
  });

  test("throws SyntaxError on empty string", () => {
    expect(() => extractJson("")).toThrow(SyntaxError);
  });

  test("throws SyntaxError on truncated JSON", () => {
    expect(() => extractJson('{"title": "incomplete')).toThrow(SyntaxError);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
describe("generateMystery", () => {
  test("returns a validated mystery object on first successful attempt", async () => {
    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    const result = await generateMystery({ playersCount: 3, difficulty: "medium" });

    expect(result.title).toBe(VALID_MYSTERY.title);
    expect(result.suspects).toHaveLength(3);
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(1);
  });

  test("retries with clarification prompt when first response is unparseable", async () => {
    ollamaService.sendPrompt
      .mockResolvedValueOnce("I cannot generate that.") // bad first response
      .mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY)); // success on retry

    const result = await generateMystery({ playersCount: 3, difficulty: "easy" });

    expect(result.title).toBe(VALID_MYSTERY.title);
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(2);

    // Second call should contain a clarification message
    const secondPrompt = ollamaService.sendPrompt.mock.calls[1][0];
    expect(secondPrompt.toLowerCase()).toContain("valid");
  });

  test("retries when validation fails on first response and succeeds on second", async () => {
    // First response: missing required fields (fails validation)
    const invalidMystery = { title: "Incomplete", location: "Nowhere" };
    ollamaService.sendPrompt
      .mockResolvedValueOnce(JSON.stringify(invalidMystery))
      .mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    const result = await generateMystery({ playersCount: 3, difficulty: "medium" });
    expect(result.title).toBe(VALID_MYSTERY.title);
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(2);
  });

  test("throws after exhausting all parse retries", async () => {
    ollamaService.sendPrompt.mockResolvedValue("definitely not json");

    await expect(
      generateMystery({ playersCount: 2, difficulty: "easy" })
    ).rejects.toThrow(/Failed to generate a valid mystery/i);

    // MAX_PARSE_RETRIES = 2, so 3 total calls (attempt 0, 1, 2)
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(3);
  });

  test("throws after exhausting all retries due to persistent validation failure", async () => {
    const badMystery = {
      title: "",
      location: "",
      victim: { name: "", description: "" },
      crime: { type: "", weapon: "", summary: "" },
      suspects: [],
      timeline: [],
    };
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(badMystery));

    await expect(
      generateMystery({ playersCount: 2, difficulty: "medium" })
    ).rejects.toThrow(/Failed to generate a valid mystery/i);
  });

  test("uses default parameters when none provided", async () => {
    // Default playersCount=4 means the validator requires at least 4 suspects.
    // Build a mystery with 4 suspects so it passes validation.
    const mystery4 = {
      ...VALID_MYSTERY,
      suspects: [
        ...VALID_MYSTERY.suspects,
        {
          name: "Eleanor Hatch",
          background: "Rival scholar.",
          relationshipToVictim: "Academic peer",
          isMurderer: false,
        },
      ],
    };

    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(mystery4));

    const result = await generateMystery(); // no args → defaults
    expect(result).toBeDefined();
    expect(result.suspects).toHaveLength(4);
    // Verify prompt was built with default playersCount=4
    const [calledPrompt] = ollamaService.sendPrompt.mock.calls[0];
    expect(calledPrompt).toContain("4 players");
  });
});
