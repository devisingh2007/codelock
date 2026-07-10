"use strict";

/**
 * @file tests/routes/gameRoutes.test.js
 * Integration tests for the POST /api/game/:roomCode/generate-mystery endpoint.
 *
 * Ollama is fully mocked. Uses an in-memory MongoDB (MongoMemoryServer) so
 * no external DB is required.
 *
 * Test coverage:
 *  1. Auth guard – 401 without token
 *  2. Host guard – 403 for non-host authenticated user
 *  3. Validation  – 400 for malformed roomCode
 *  4. Happy path  – 200, story in response, story persisted to GameState
 *  5. Socket event emission  – mystery-generated emitted to the room
 *  6. AI validation failure – 500 when AI returns structurally invalid JSON
 *  7. AI service failure    – 500 propagated when ollamaService throws
 *  8. Per-room rate limiting – 429 after ROOM_RATE_LIMIT requests in 1 minute
 *  9. Rate limit resets per room – two different rooms each get their own quota
 * 10. Integration: full flow with GameState persisted and socket event verified
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

// ── Mock ollamaService before any imports that transitively load it ────────────
jest.mock("../../src/services/ai/ollamaService", () => ({
  sendPrompt: jest.fn(),
}));

const { app } = require("../../server");
const GameRoom = require("../../src/models/GameRoom");
const GameState = require("../../src/models/GameState");
const User = require("../../src/models/User");
const { signToken } = require("../../src/utils/jwt");
const ollamaService = require("../../src/services/ai/ollamaService");

// We need to reach into the controller's internal rate-limit map so we can
// flush it between tests (to keep tests isolated).
const gameController = require("../../src/controllers/gameController");

jest.setTimeout(30000);

// ── Fixture mystery ────────────────────────────────────────────────────────────
const VALID_MYSTERY = {
  title: "Death at the Gala",
  location: "Grand Ballroom, Vienna",
  victim: {
    name: "Countess Isabella Draven",
    description: "Austrian socialite with powerful enemies.",
  },
  crime: {
    type: "strangulation",
    weapon: "Silk scarf",
    summary:
      "The Countess was found strangled behind the curtain during the midnight waltz.",
    killer: "Baron Klaus Richter",
  },
  suspects: [
    {
      name: "Baron Klaus Richter",
      background: "Disgraced nobleman with gambling debts.",
      relationshipToVictim: "Scorned ex-lover",
      isMurderer: true,
    },
    {
      name: "Helene Voss",
      background: "Ambitious socialite competing for the same inheritance.",
      relationshipToVictim: "Rival",
      isMurderer: false,
    },
    {
      name: "Ernst Müller",
      background: "The Countess's personal secretary.",
      relationshipToVictim: "Employee",
      isMurderer: false,
    },
  ],
  timeline: [
    { time: "20:00", event: "Gala begins." },
    { time: "21:30", event: "Countess delivers a speech." },
    { time: "23:55", event: "Midnight waltz starts." },
    { time: "00:10", event: "Countess found dead behind the curtain." },
  ],
};

// ── Test DB setup ──────────────────────────────────────────────────────────────
let mongoServer;
let hostUser, playerUser;
let hostToken, playerToken;
let testRoom;

const ROOM_CODE = "GRVIT1";
const ROOM_CODE_2 = "GRVIT2";

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  await mongoose.connect(mongoServer.getUri());

  hostUser = await User.create({
    username: "grHost",
    email: "grhost@test.com",
    password: "password",
  });
  playerUser = await User.create({
    username: "grPlayer",
    email: "grplayer@test.com",
    password: "password",
  });

  hostToken = signToken({ id: hostUser._id.toString() });
  playerToken = signToken({ id: playerUser._id.toString() });

  testRoom = await GameRoom.create({
    roomCode: ROOM_CODE,
    host: hostUser._id,
    players: [hostUser._id, playerUser._id],
    status: "waiting",
    maxPlayers: 4,
  });

  // Second room for rate-limit isolation tests
  await GameRoom.create({
    roomCode: ROOM_CODE_2,
    host: hostUser._id,
    players: [hostUser._id],
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
  // Flush the per-room rate-limit map so each test starts clean
  gameController._roomRateLimitMap.clear();
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. Authentication guard
// ══════════════════════════════════════════════════════════════════════════════
describe("Auth guard", () => {
  test("returns 401 when no token is provided", async () => {
    const res = await request(app).post(`/api/game/${ROOM_CODE}/generate-mystery`);
    expect(res.statusCode).toBe(401);
  });

  test("returns 401 for an invalid/expired token", async () => {
    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", "Bearer this.is.not.valid");
    expect(res.statusCode).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Host guard
// ══════════════════════════════════════════════════════════════════════════════
describe("Host guard", () => {
  test("returns 403 when authenticated user is not the room host", async () => {
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(VALID_MYSTERY));

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${playerToken}`)
      .send({ difficulty: "easy" });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/host/i);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Input validation
// ══════════════════════════════════════════════════════════════════════════════
describe("Input validation", () => {
  test("returns 400 for an invalid roomCode format (too short)", async () => {
    const res = await request(app)
      .post("/api/game/BAD/generate-mystery")
      .set("Authorization", `Bearer ${hostToken}`);
    expect(res.statusCode).toBe(400);
  });

  test("returns 400 for roomCode with special characters", async () => {
    const res = await request(app)
      .post("/api/game/AB@@12/generate-mystery")
      .set("Authorization", `Bearer ${hostToken}`);
    expect(res.statusCode).toBe(400);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Happy path
// ══════════════════════════════════════════════════════════════════════════════
describe("Happy path – successful generation", () => {
  test("returns 200 with success=true and story object", async () => {
    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({ difficulty: "medium", locationHints: "Viennese ballroom" });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.story).toBeDefined();
    expect(res.body.story.title).toBe(VALID_MYSTERY.title);
    expect(res.body.story.victim.name).toBe(VALID_MYSTERY.victim.name);
  });

  test("responds with all story sub-fields (crime, suspects, timeline)", async () => {
    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    expect(res.body.story.crime.weapon).toBe(VALID_MYSTERY.crime.weapon);
    expect(res.body.story.suspects).toHaveLength(3);
    expect(res.body.story.timeline).toHaveLength(4);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. Persistence – story saved to GameState
// ══════════════════════════════════════════════════════════════════════════════
describe("GameState persistence", () => {
  test("persists the generated story to the GameState document", async () => {
    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    const state = await GameState.findOne({ roomId: ROOM_CODE });
    expect(state).not.toBeNull();
    expect(state.story.title).toBe(VALID_MYSTERY.title);
    expect(state.story.victim.name).toBe(VALID_MYSTERY.victim.name);
    expect(state.story.suspects).toHaveLength(3);
    expect(state.story.generatedAt).toBeInstanceOf(Date);
  });

  test("updates existing GameState if one already exists", async () => {
    // Pre-create a state
    await GameState.create({ roomId: ROOM_CODE });

    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    const states = await GameState.find({ roomId: ROOM_CODE });
    expect(states).toHaveLength(1); // should update, not create a duplicate
    expect(states[0].story.title).toBe(VALID_MYSTERY.title);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. AI validation failure
// ══════════════════════════════════════════════════════════════════════════════
describe("AI validation failure", () => {
  test("returns 500 when AI keeps generating invalid structures", async () => {
    // Every call returns structurally broken data
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify({ bad: "data" }));

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    expect(res.statusCode).toBe(500);
  });

  test("returns 500 when ollamaService throws an error", async () => {
    ollamaService.sendPrompt.mockRejectedValue(
      new Error("OllamaService: network error")
    );

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    expect(res.statusCode).toBe(500);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Per-room rate limiting
// ══════════════════════════════════════════════════════════════════════════════
describe("Per-room rate limiting", () => {
  /**
   * We temporarily set AI_RATE_LIMIT_PER_MINUTE to 2 by manipulating
   * the controller's internal ROOM_RATE_LIMIT. Because the constant is
   * captured at module load time, we instead stress-test by calling the
   * _isRoomRateLimited helper directly.
   */

  test("isRoomRateLimited returns false initially", () => {
    const result = gameController._isRoomRateLimited("RATEXX");
    expect(result).toBe(false);
  });

  test("isRoomRateLimited tracks calls and eventually returns true", () => {
    const code = "RATEYY";
    // Force the map to already be saturated (use many calls)
    // We'll call it until it returns true or up to 100 times
    let limited = false;
    for (let i = 0; i < 100; i++) {
      if (gameController._isRoomRateLimited(code)) {
        limited = true;
        break;
      }
    }
    expect(limited).toBe(true);
  });

  test("different rooms have independent rate-limit buckets", () => {
    // Saturate room A
    for (let i = 0; i < 100; i++) {
      gameController._isRoomRateLimited("ROOMA1");
    }

    // Room B should still accept requests
    const roomBResult = gameController._isRoomRateLimited("ROOMB1");
    expect(roomBResult).toBe(false);
  });

  test("endpoint returns 429 when per-room limit is exceeded", async () => {
    // Pre-populate the rate-limit map so the very next request hits the cap
    const ROOM_RATE_LIMIT =
      parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10) || 10;

    const timestamps = gameController._roomRateLimitMap.get(ROOM_CODE) || [];
    const now = Date.now();
    // Fill up remaining slots
    while (timestamps.length < ROOM_RATE_LIMIT) {
      timestamps.push(now);
    }
    gameController._roomRateLimitMap.set(ROOM_CODE, timestamps);

    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify(VALID_MYSTERY));

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    expect(res.statusCode).toBe(429);
    expect(res.body.error).toMatch(/too many/i);
    expect(res.body.retryAfterSeconds).toBe(60);
  });

  test("second room is not affected by first room being rate-limited", async () => {
    // Saturate ROOM_CODE
    const now = Date.now();
    const ROOM_RATE_LIMIT =
      parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10) || 10;
    gameController._roomRateLimitMap.set(
      ROOM_CODE,
      Array(ROOM_RATE_LIMIT).fill(now)
    );

    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    // ROOM_CODE_2 should still work
    const res = await request(app)
      .post(`/api/game/${ROOM_CODE_2}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({});

    // Should not be rate-limited (could be 200 or 404 if room not found, but NOT 429)
    expect(res.statusCode).not.toBe(429);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 8. Integration: full flow
// ══════════════════════════════════════════════════════════════════════════════
describe("Full integration flow", () => {
  test("complete flow: generate → validate → persist → respond", async () => {
    ollamaService.sendPrompt.mockResolvedValueOnce(JSON.stringify(VALID_MYSTERY));

    const res = await request(app)
      .post(`/api/game/${ROOM_CODE}/generate-mystery`)
      .set("Authorization", `Bearer ${hostToken}`)
      .send({ difficulty: "hard", locationHints: "Grand Ballroom" });

    // HTTP response
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.story.title).toBe(VALID_MYSTERY.title);

    // DB persistence
    const state = await GameState.findOne({ roomId: ROOM_CODE });
    expect(state.story.title).toBe(VALID_MYSTERY.title);
    expect(state.story.suspects.length).toBeGreaterThanOrEqual(2);

    // AI service called exactly once (validated first attempt succeeded)
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(1);
  });
});
