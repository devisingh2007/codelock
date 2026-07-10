"use strict";

/**
 * @file ai.test.js
 * Phase 6 tests covering:
 *  1. mysteryValidator – field-level validation rules
 *  2. mysteryGenerator – JSON extraction and retry logic (Ollama mocked)
 *  3. POST /api/game/:roomCode/generate-mystery REST endpoint (Ollama mocked)
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { app } = require("../../server");
const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const { validateMystery } = require("../utils/mysteryValidator");
const { extractJson, buildPrompt } = require("../services/ai/mysteryGenerator");

jest.setTimeout(30000);

// ── Mock ollamaService so tests never hit a real Ollama server ────────────────
jest.mock("../services/ai/ollamaService", () => ({
  sendPrompt: jest.fn(),
}));
const ollamaService = require("../services/ai/ollamaService");

// ── Fixture: a fully valid mystery object ────────────────────────────────────
const VALID_MYSTERY = {
  title: "Death in the Manor",
  location: "Thornfield Estate, Yorkshire",
  victim: { name: "Lord Aldric Vane", description: "Wealthy landowner with many enemies." },
  crime: {
    type: "poisoning",
    weapon: "Arsenic in the evening sherry",
    summary: "Arsenic was slipped into Lord Vane's drink during the dinner party.",
    killer: "Dr. Helena Marsh",
  },
  suspects: [
    {
      name: "Dr. Helena Marsh",
      background: "Family physician with a secret gambling debt.",
      relationshipToVictim: "Personal doctor",
      isMurderer: true,
    },
    {
      name: "Edward Crane",
      background: "Estranged nephew who stands to inherit.",
      relationshipToVictim: "Nephew",
      isMurderer: false,
    },
  ],
  timeline: [
    { time: "18:00", event: "Guests arrive at the manor" },
    { time: "19:30", event: "Dinner is served" },
    { time: "21:00", event: "Lord Vane collapses in the library" },
    { time: "21:15", event: "Death confirmed by Dr. Marsh" },
  ],
};

// ════════════════════════════════════════════════════════════════════════════════
// TEST DATABASE SETUP
// ════════════════════════════════════════════════════════════════════════════════
let mongoServer;
let hostUser, playerUser;
let hostToken, playerToken;
let testRoom;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  hostUser = await User.create({
    username: "aiHost",
    email: "aihost@test.com",
    password: "password",
  });
  playerUser = await User.create({
    username: "aiPlayer",
    email: "aiplayer@test.com",
    password: "password",
  });

  hostToken = signToken({ id: hostUser._id.toString() });
  playerToken = signToken({ id: playerUser._id.toString() });

  testRoom = await GameRoom.create({
    roomCode: "AIMYS1",
    host: hostUser._id,
    players: [hostUser._id, playerUser._id],
    status: "waiting",
    maxPlayers: 4,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await GameState.deleteMany({});
  jest.clearAllMocks();
});

// ════════════════════════════════════════════════════════════════════════════════
// 1. mysteryValidator unit tests
// ════════════════════════════════════════════════════════════════════════════════
describe("mysteryValidator", () => {
  test("returns empty errors for a valid mystery", () => {
    const errors = validateMystery(VALID_MYSTERY, 2);
    expect(errors).toHaveLength(0);
  });

  test("errors on missing title", () => {
    const bad = { ...VALID_MYSTERY, title: "" };
    expect(validateMystery(bad, 2)).toContain(
      'Missing or empty required field: "title".'
    );
  });

  test("errors on missing victim object", () => {
    const bad = { ...VALID_MYSTERY, victim: null };
    const errors = validateMystery(bad, 2);
    expect(errors.some((e) => e.includes("victim"))).toBe(true);
  });

  test("errors on missing victim.name", () => {
    const bad = { ...VALID_MYSTERY, victim: { ...VALID_MYSTERY.victim, name: "" } };
    expect(validateMystery(bad, 2)).toContain('Missing or empty required field: "victim.name".');
  });

  test("errors on missing crime fields", () => {
    const bad = { ...VALID_MYSTERY, crime: { type: "", weapon: "", summary: "", killer: "" } };
    const errors = validateMystery(bad, 2);
    expect(errors.some((e) => e.includes("crime.type"))).toBe(true);
  });

  test("errors when suspects fewer than minSuspects", () => {
    const bad = { ...VALID_MYSTERY, suspects: [VALID_MYSTERY.suspects[0]] };
    const errors = validateMystery(bad, 2);
    expect(errors.some((e) => e.includes("suspects"))).toBe(true);
  });

  test("errors when no murderer marked", () => {
    const bad = {
      ...VALID_MYSTERY,
      crime: { ...VALID_MYSTERY.crime, killer: "" },
      suspects: VALID_MYSTERY.suspects.map((s) => ({ ...s, isMurderer: false })),
    };
    const errors = validateMystery(bad, 2);
    expect(errors.some((e) => e.includes("isMurderer"))).toBe(true);
  });

  test("errors when more than one murderer marked", () => {
    const bad = {
      ...VALID_MYSTERY,
      suspects: VALID_MYSTERY.suspects.map((s) => ({ ...s, isMurderer: true })),
    };
    const errors = validateMystery(bad, 2);
    expect(errors.some((e) => e.includes("Exactly one suspect"))).toBe(true);
  });

  test("errors on empty timeline", () => {
    const bad = { ...VALID_MYSTERY, timeline: [] };
    expect(validateMystery(bad, 2)).toContain('"timeline" must be a non-empty array.');
  });

  test("accepts mystery with only crime.killer (no isMurderer boolean)", () => {
    const mystery = {
      ...VALID_MYSTERY,
      suspects: VALID_MYSTERY.suspects.map((s) => ({
        ...s,
        isMurderer: undefined,
      })),
    };
    // validator allows crime.killer as authority when isMurderer not present
    // (isMurderer type check will flag it, but crime.killer presence is accepted)
    const errors = validateMystery(mystery, 2);
    // Should have boolean type errors for isMurderer but not a "no murderer" error
    expect(errors.some((e) => e.includes("Exactly one suspect"))).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 2. mysteryGenerator – extractJson and buildPrompt
// ════════════════════════════════════════════════════════════════════════════════
describe("mysteryGenerator helpers", () => {
  test("buildPrompt includes playersCount and difficulty", () => {
    const prompt = buildPrompt({ playersCount: 4, difficulty: "hard", locationHints: "castle" });
    expect(prompt).toContain("4 players");
    expect(prompt).toContain("hard");
    expect(prompt).toContain("castle");
  });

  test("extractJson parses raw JSON string", () => {
    const raw = JSON.stringify(VALID_MYSTERY);
    const parsed = extractJson(raw);
    expect(parsed.title).toBe(VALID_MYSTERY.title);
  });

  test("extractJson strips markdown fences", () => {
    const raw = `Here is the output:\n\`\`\`json\n${JSON.stringify(VALID_MYSTERY)}\n\`\`\``;
    const parsed = extractJson(raw);
    expect(parsed.title).toBe(VALID_MYSTERY.title);
  });

  test("extractJson finds JSON inside noisy preamble", () => {
    const raw = `Sure, here you go! ${JSON.stringify(VALID_MYSTERY)} Hope that helps!`;
    const parsed = extractJson(raw);
    expect(parsed.title).toBe(VALID_MYSTERY.title);
  });

  test("extractJson throws on completely invalid input", () => {
    expect(() => extractJson("This is not JSON at all.")).toThrow(SyntaxError);
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 3. generateMystery – integration with mocked Ollama
// ════════════════════════════════════════════════════════════════════════════════
describe("generateMystery (Ollama mocked)", () => {
  const { generateMystery } = require("../services/ai/mysteryGenerator");

  test("returns parsed mystery on first successful attempt", async () => {
    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));
    const result = await generateMystery({ playersCount: 2, difficulty: "easy" });
    expect(result.title).toBe(VALID_MYSTERY.title);
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(1);
  });

  test("retries when first response is unparseable and succeeds on retry", async () => {
    ollamaService.sendPrompt
      .mockResolvedValueOnce("Sorry I cannot do that")  // bad response
      .mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY)); // retry succeeds

    const result = await generateMystery({ playersCount: 2, difficulty: "easy" });
    expect(result.title).toBe(VALID_MYSTERY.title);
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(2);
  });

  test("throws after exhausting all retries", async () => {
    ollamaService.sendPrompt.mockResolvedValue("not valid json ever");
    await expect(generateMystery({ playersCount: 2 })).rejects.toThrow(
      /Failed to generate a valid mystery/i
    );
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// 4. POST /api/game/:roomCode/generate-mystery REST endpoint
// ════════════════════════════════════════════════════════════════════════════════
describe("POST /api/game/:roomCode/generate-mystery", () => {
  test("returns 401 without token", async () => {
    const res = await request(app).post(`/api/game/AIMYS1/generate-mystery`);
    expect(res.statusCode).toBe(401);
  });

  test("returns 403 for non-host user", async () => {
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(VALID_MYSTERY));
    const res = await request(app)
      .post(`/api/game/AIMYS1/generate-mystery`)
      .set("Authorization", `Bearer ${playerToken}`)
      .send({ difficulty: "easy" });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/host/i);
  });

  test("returns 400 for invalid roomCode format", async () => {
    const res = await request(app)
      .post(`/api/game/BAD/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`);
    expect(res.statusCode).toBe(400);
  });

  test("returns 200 with story when AI succeeds", async () => {
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(VALID_MYSTERY));

    const res = await request(app)
      .post(`/api/game/AIMYS1/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({ difficulty: "medium", locationHints: "Victorian manor" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.story.title).toBe(VALID_MYSTERY.title);
  });

  test("persists story to GameState after generation", async () => {
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(VALID_MYSTERY));

    await request(app)
      .post(`/api/game/AIMYS1/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    const state = await GameState.findOne({ roomId: "AIMYS1" });
    expect(state).not.toBeNull();
    expect(state.story.title).toBe(VALID_MYSTERY.title);
    expect(state.story.victim.name).toBe(VALID_MYSTERY.victim.name);
    expect(state.story.suspects).toHaveLength(2);
  });

  test("returns 500 when AI generates invalid mystery after all retries", async () => {
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify({ bad: "data" }));

    const res = await request(app)
      .post(`/api/game/AIMYS1/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    expect(res.statusCode).toBe(500);
  });
});
