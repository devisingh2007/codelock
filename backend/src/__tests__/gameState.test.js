/**
 * @file gameState.test.js
 * Comprehensive Phase 5 tests covering:
 *  - Model validation & TTL index
 *  - REST API endpoints (getState, updateState, advancePhase, restoreState)
 *  - Socket.IO events (join-game-room, state-update, phase-advance, reconnect)
 *  - Concurrency: two parallel updates on the same version
 */

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createServer } = require("http");
const { io: ioc } = require("socket.io-client");
const express = require("express");

// ── Imports under test ──────────────────────────────────────────────────────
const { app, httpServer } = require("../../server");
const GameState = require("../models/GameState");
const GameRoom = require("../models/GameRoom");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const {
  VersionConflictError,
  InvalidPhaseTransitionError,
  nextPhase,
  mergeStateChanges,
  appendEvent,
  shallowDiff,
} = require("../utils/stateUtils");
const gameStateService = require("../services/gameStateService");
const { initSocket } = require("../sockets/gameSocket");
const gameStateSocket = require("../sockets/gameStateSocket");

// ── Test setup ──────────────────────────────────────────────────────────────
jest.setTimeout(30000);

let mongoServer;
let hostUser, playerUser;
let hostToken, playerToken;
let testRoomCode;

const SOCKET_PORT = 4002;
let testHttpServer;
let testIo;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);

  // Seed users
  hostUser = await User.create({
    username: "stateHost",
    email: "statehost@example.com",
    password: "password",
  });
  playerUser = await User.create({
    username: "statePlayer",
    email: "stateplayer@example.com",
    password: "password",
  });

  hostToken = signToken({ id: hostUser._id.toString() });
  playerToken = signToken({ id: playerUser._id.toString() });

  // Create a test game room
  const room = await GameRoom.create({
    roomCode: "TST001",
    host: hostUser._id,
    players: [hostUser._id],
    status: "waiting",
    maxPlayers: 4,
  });
  testRoomCode = room.roomCode;

  // Standalone HTTP server for socket tests
  const standaloneApp = express();
  testHttpServer = createServer(standaloneApp);
  testIo = initSocket(testHttpServer);
  gameStateSocket(testIo);
  await new Promise((resolve) => testHttpServer.listen(SOCKET_PORT, resolve));
});

afterAll(async () => {
  await new Promise((resolve) => testHttpServer.close(resolve));
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await GameState.deleteMany({});
});

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UNIT: stateUtils
// ═══════════════════════════════════════════════════════════════════════════════
describe("stateUtils – helpers", () => {
  test("nextPhase advances through all phases in order", () => {
    expect(nextPhase("lobby")).toBe("investigation");
    expect(nextPhase("investigation")).toBe("voting");
    expect(nextPhase("voting")).toBe("reveal");
  });

  test("nextPhase throws InvalidPhaseTransitionError at final phase", () => {
    expect(() => nextPhase("reveal")).toThrow(InvalidPhaseTransitionError);
  });

  test("shallowDiff detects changed keys", () => {
    const diff = shallowDiff({ phase: "lobby", x: 1 }, { phase: "investigation", x: 1 });
    expect(diff).toEqual({ phase: "investigation" });
  });

  test("appendEvent pushes event with timestamp", () => {
    const fakeDoc = { eventsLog: [] };
    appendEvent(fakeDoc, "test event");
    expect(fakeDoc.eventsLog).toHaveLength(1);
    expect(fakeDoc.eventsLog[0].event).toBe("test event");
    expect(fakeDoc.eventsLog[0].timestamp).toBeInstanceOf(Date);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. MODEL: GameState schema validation
// ═══════════════════════════════════════════════════════════════════════════════
describe("GameState model validation", () => {
  test("creates with defaults and valid roomId", async () => {
    const state = await GameState.create({ roomId: "ABCD12" });
    expect(state.phase).toBe("lobby");
    expect(state.__v).toBe(0);
    expect(state.lastUpdated).toBeInstanceOf(Date);
    expect(state.players).toHaveLength(0);
    expect(state.eventsLog).toHaveLength(0);
  });

  test("rejects invalid phase enum", async () => {
    await expect(
      GameState.create({ roomId: "ABCD12", phase: "invalid_phase" })
    ).rejects.toThrow();
  });

  test("roomId is stored as uppercase", async () => {
    const state = await GameState.create({ roomId: "lower1" });
    expect(state.roomId).toBe("LOWER1");
  });

  test("increments __v on each save (optimistic concurrency)", async () => {
    const state = await GameState.create({ roomId: "VERST1" });
    expect(state.__v).toBe(0);
    state.phase = "investigation";
    const saved = await state.save();
    expect(saved.__v).toBe(1);
  });

  test("TTL index exists on lastUpdated field", async () => {
    const indexes = await GameState.collection.getIndexes({ full: true });
    const ttlIdx = indexes.find(
      (idx) => idx.expireAfterSeconds !== undefined && idx.key?.lastUpdated
    );
    expect(ttlIdx).toBeDefined();
  });

  test("required roomId – throws without it", async () => {
    await expect(GameState.create({ phase: "lobby" })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SERVICE: gameStateService
// ═══════════════════════════════════════════════════════════════════════════════
describe("gameStateService", () => {
  test("getOrCreateState creates new state if none exists", async () => {
    const state = await gameStateService.getOrCreateState("NEWRM1");
    expect(state.roomId).toBe("NEWRM1");
    expect(state.phase).toBe("lobby");
  });

  test("getOrCreateState returns existing state on second call", async () => {
    const s1 = await gameStateService.getOrCreateState("EXISTR");
    const s2 = await gameStateService.getOrCreateState("EXISTR");
    expect(s1._id.toString()).toBe(s2._id.toString());
  });

  test("updateState applies changes and bumps version", async () => {
    const initial = await gameStateService.getOrCreateState("UPDTST");
    const updated = await gameStateService.updateState(
      "UPDTST",
      { story: { victim: "Mr. X" } },
      initial.__v
    );
    expect(updated.__v).toBe(initial.__v + 1);
    expect(updated.story.victim).toBe("Mr. X");
  });

  test("updateState throws VersionConflictError on stale version", async () => {
    await gameStateService.getOrCreateState("CONFLICT");
    // Pass wrong version (100 when actual is 0)
    await expect(
      gameStateService.updateState("CONFLICT", {}, 100)
    ).rejects.toThrow(VersionConflictError);
  });

  test("advancePhase throws UnauthorisedError for non-host", async () => {
    await gameStateService.getOrCreateState(testRoomCode);
    await expect(
      gameStateService.advancePhase(testRoomCode, playerUser._id.toString())
    ).rejects.toMatchObject({ name: "UnauthorisedError" });
  });

  test("advancePhase successfully advances phase for host", async () => {
    await gameStateService.getOrCreateState(testRoomCode);
    const updated = await gameStateService.advancePhase(
      testRoomCode,
      hostUser._id.toString()
    );
    expect(updated.phase).toBe("investigation");
  });

  test("advancePhase throws InvalidPhaseTransitionError at reveal", async () => {
    const state = await GameState.create({ roomId: "FINAL1", phase: "reveal" });
    await expect(
      gameStateService.advancePhase("FINAL1", hostUser._id.toString())
    ).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. API: REST endpoints
// ═══════════════════════════════════════════════════════════════════════════════
describe("Game State REST API", () => {
  describe("GET /api/game/:roomId/state", () => {
    test("returns 200 and creates state for valid room", async () => {
      const res = await request(app)
        .get(`/api/game/${testRoomCode}/state`)
        .set("Authorization", `Bearer ${hostToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.data.roomId).toBe(testRoomCode);
      expect(res.body.data.phase).toBe("lobby");
    });

    test("returns 401 without token", async () => {
      const res = await request(app).get(`/api/game/${testRoomCode}/state`);
      expect(res.statusCode).toBe(401);
    });

    test("returns 400 for invalid roomId format", async () => {
      const res = await request(app)
        .get("/api/game/BAD/state")
        .set("Authorization", `Bearer ${hostToken}`);
      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/game/:roomId/state/update", () => {
    test("returns 200 and updated state with correct version", async () => {
      // Get initial state
      const getRes = await request(app)
        .get(`/api/game/${testRoomCode}/state`)
        .set("Authorization", `Bearer ${hostToken}`);
      const version = getRes.body.data.__v;

      const res = await request(app)
        .post(`/api/game/${testRoomCode}/state/update`)
        .set("Authorization", `Bearer ${hostToken}`)
        .send({ changes: { story: { victim: "Lady Vera" } }, version });

      expect(res.statusCode).toBe(200);
      expect(res.body.data.story.victim).toBe("Lady Vera");
      expect(res.body.data.__v).toBe(version + 1);
    });

    test("returns 409 when version is stale", async () => {
      await request(app)
        .get(`/api/game/${testRoomCode}/state`)
        .set("Authorization", `Bearer ${hostToken}`);

      const res = await request(app)
        .post(`/api/game/${testRoomCode}/state/update`)
        .set("Authorization", `Bearer ${hostToken}`)
        .send({ changes: {}, version: 999 });

      expect(res.statusCode).toBe(409);
    });

    test("returns 400 when changes or version is missing", async () => {
      const res = await request(app)
        .post(`/api/game/${testRoomCode}/state/update`)
        .set("Authorization", `Bearer ${hostToken}`)
        .send({ changes: {} }); // missing version

      expect(res.statusCode).toBe(400);
    });
  });

  describe("POST /api/game/:roomId/state/advancePhase", () => {
    test("returns 200 and advances phase for host", async () => {
      await request(app)
        .get(`/api/game/${testRoomCode}/state`)
        .set("Authorization", `Bearer ${hostToken}`);

      const res = await request(app)
        .post(`/api/game/${testRoomCode}/state/advancePhase`)
        .set("Authorization", `Bearer ${hostToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.phase).toBe("investigation");
    });

    test("returns 403 for non-host user", async () => {
      await request(app)
        .get(`/api/game/${testRoomCode}/state`)
        .set("Authorization", `Bearer ${playerToken}`);

      const res = await request(app)
        .post(`/api/game/${testRoomCode}/state/advancePhase`)
        .set("Authorization", `Bearer ${playerToken}`);

      expect(res.statusCode).toBe(403);
    });
  });

  describe("POST /api/game/:roomId/state/restore", () => {
    test("returns 200 with current state", async () => {
      await request(app)
        .get(`/api/game/${testRoomCode}/state`)
        .set("Authorization", `Bearer ${hostToken}`);

      const res = await request(app)
        .post(`/api/game/${testRoomCode}/state/restore`)
        .set("Authorization", `Bearer ${hostToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.roomId).toBe(testRoomCode);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SOCKET: game state events
// ═══════════════════════════════════════════════════════════════════════════════
describe("GameStateSocket events", () => {
  let hostSocket, playerSocket;

  const makeSocket = (token) =>
    ioc(`http://localhost:${SOCKET_PORT}`, {
      auth: { token },
      autoConnect: false,
      transports: ["websocket"],
    });

  const connect = (socket) =>
    new Promise((resolve, reject) => {
      socket.connect();
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });

  beforeEach(() => {
    hostSocket = makeSocket(hostToken);
    playerSocket = makeSocket(playerToken);
  });

  afterEach(() => {
    if (hostSocket?.connected) hostSocket.disconnect();
    if (playerSocket?.connected) playerSocket.disconnect();
  });

  test("join-game-room emits sync-state back to caller", async () => {
    await connect(hostSocket);

    const syncPromise = new Promise((resolve) => {
      hostSocket.once("sync-state", resolve);
    });

    hostSocket.emit("join-game-room", { roomId: testRoomCode }, () => {});
    const { state } = await syncPromise;

    expect(state).toBeDefined();
    expect(state.roomId).toBe(testRoomCode);
  });

  test("state-update broadcasts state-changed to all room members", async () => {
    await connect(hostSocket);
    await connect(playerSocket);

    // Both join and collect their respective sync-state responses
    const [, ] = await Promise.all([
      new Promise((r) => {
        hostSocket.once("sync-state", r);
        hostSocket.emit("join-game-room", { roomId: testRoomCode }, () => {});
      }),
      new Promise((r) => {
        playerSocket.once("sync-state", r);
        playerSocket.emit("join-game-room", { roomId: testRoomCode }, () => {});
      }),
    ]);

    // Get initial version from DB
    const state = await GameState.findOne({ roomId: testRoomCode });
    const version = state.__v;

    // Player listens for state-changed broadcast
    const changedPromise = new Promise((resolve) => {
      playerSocket.once("state-changed", resolve);
    });

    // Host sends update
    hostSocket.emit(
      "state-update",
      { roomId: testRoomCode, changes: { story: { victim: "Mr. Sockets" } }, version },
      () => {}
    );

    const { state: newState } = await changedPromise;
    expect(newState.story.victim).toBe("Mr. Sockets");
  });

  test("state-update returns VERSION_CONFLICT on stale version", async () => {
    await connect(hostSocket);
    await new Promise((r) => hostSocket.emit("join-game-room", { roomId: testRoomCode }, r));

    const ack = await new Promise((resolve) => {
      hostSocket.emit(
        "state-update",
        { roomId: testRoomCode, changes: {}, version: 999 },
        resolve
      );
    });

    expect(ack.error).toBeTruthy();
    expect(ack.code).toBe("VERSION_CONFLICT");
  });

  test("request-sync re-emits sync-state to caller", async () => {
    await connect(hostSocket);
    await new Promise((r) => hostSocket.emit("join-game-room", { roomId: testRoomCode }, r));

    const syncPromise = new Promise((resolve) => {
      hostSocket.once("sync-state", resolve);
    });

    hostSocket.emit("request-sync", { roomId: testRoomCode }, () => {});
    const { state } = await syncPromise;

    expect(state.roomId).toBe(testRoomCode);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. CONCURRENCY: two parallel updates with same version → one wins, one 409
// ═══════════════════════════════════════════════════════════════════════════════
describe("Concurrency – optimistic locking", () => {
  test("two simultaneous updates with same version: one succeeds, one conflicts", async () => {
    const state = await gameStateService.getOrCreateState("CONCUR");
    const version = state.__v;

    const [result1, result2] = await Promise.allSettled([
      gameStateService.updateState("CONCUR", { story: { victim: "Caller A" } }, version),
      gameStateService.updateState("CONCUR", { story: { victim: "Caller B" } }, version),
    ]);

    const successes = [result1, result2].filter((r) => r.status === "fulfilled");
    const conflicts = [result1, result2].filter(
      (r) =>
        r.status === "rejected" &&
        r.reason instanceof VersionConflictError
    );

    expect(successes).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
  });
});
