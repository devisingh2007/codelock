/**
 * @file finalReveal.test.js
 * Integration tests for Phase 10: Final Game Resolution + AI Reveal + Summary + Polish.
 */

"use strict";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createServer } = require("http");
const { io: ioc } = require("socket.io-client");
const express = require("express");

// Mock Ollama service
jest.mock("../services/ai/ollamaService", () => ({
  sendPrompt: jest.fn(),
}));
const ollamaService = require("../services/ai/ollamaService");

// Imports under test
const { app } = require("../../server");
const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const User = require("../models/User");
const Vote = require("../models/Vote");
const InvestigationAction = require("../models/InvestigationAction");
const GameEvent = require("../models/GameEvent");
const { signToken } = require("../utils/jwt");
const { initSocket } = require("../sockets/gameSocket");
const gameStateSocket = require("../sockets/gameStateSocket");

jest.setTimeout(30000);

let mongoServer;
let users = [];
let tokens = [];
let testRoomCode = "PH10RM";
let unauthorizedToken;

const SOCKET_PORT = 4005;
let testHttpServer;
let testIo;
let sockets = [];

const mockStory = {
  title: "Murder at Villa Rose",
  location: "Living Room",
  victim: { name: "Victim X", description: "Wealthy estate owner" },
  crime: { summary: "Poisoned tea", killer: "detective_player_2", type: "poisoning", weapon: "poison" },
  suspects: [
    { name: "detective_player_1", background: "Doctor", relationshipToVictim: "Physician", isMurderer: false },
    { name: "detective_player_2", background: "Butler", relationshipToVictim: "Servant", isMurderer: true },
  ],
  timeline: [{ time: "8:00 PM", event: "Tea served" }],
  clues: ["poison vial", "broken glass"],
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);

  // Seed 4 users in room
  for (let i = 1; i <= 4; i++) {
    const user = await User.create({
      username: `detective_player_${i}`,
      email: `player_${i}@example.com`,
      password: "password123",
    });
    users.push(user);
    tokens.push(signToken({ id: user._id.toString() }));
  }

  // Seed 1 unauthorized user
  const unauth = await User.create({
    username: "unauth_player",
    email: "unauth@example.com",
    password: "password123",
  });
  unauthorizedToken = signToken({ id: unauth._id.toString() });

  // Standalone Socket server setup
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
  await GameRoom.deleteMany({});
  await GameState.deleteMany({});
  await Vote.deleteMany({});
  await InvestigationAction.deleteMany({});
  await GameEvent.deleteMany({});
  sockets.forEach((s) => s.disconnect());
  sockets = [];
  jest.clearAllMocks();
});

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

describe("Phase 10: Final Game Resolution, AI Reveal and summary Tests", () => {
  test("Complete Finalization Flow: cast votes, finalize, compare win/loss, populate reveal/summary, check lock, test socket emit", async () => {
    // 1. Setup Room & GameState in Voting phase
    const room = await GameRoom.create({
      roomCode: testRoomCode,
      host: users[0]._id,
      players: users.map((u) => u._id),
      status: "in_progress",
      maxPlayers: 4,
    });

    const state = await GameState.create({
      roomId: testRoomCode,
      phase: "voting",
      story: mockStory,
      players: users.map((u) => ({ userId: u._id, role: "detective", cluesFound: [] })),
    });

    // Seed some mock investigation actions
    await InvestigationAction.create({
      roomId: testRoomCode,
      playerId: users[0]._id,
      actionType: "INSPECT_CLUE",
      target: "poison vial",
    });

    // Seed votes: 3 players vote for the correct murderer (user2), 1 votes for user1
    await Vote.create({ roomId: testRoomCode, voterId: users[0]._id, accusedPlayerId: users[1]._id, roundNumber: 1 });
    await Vote.create({ roomId: testRoomCode, voterId: users[1]._id, accusedPlayerId: users[1]._id, roundNumber: 1 });
    await Vote.create({ roomId: testRoomCode, voterId: users[2]._id, accusedPlayerId: users[1]._id, roundNumber: 1 });
    await Vote.create({ roomId: testRoomCode, voterId: users[3]._id, accusedPlayerId: users[0]._id, roundNumber: 1 });

    // Sockets Setup to assert Events
    const socket1 = makeSocket(tokens[0]);
    sockets.push(socket1);
    await connect(socket1);
    await new Promise((resolve) =>
      socket1.emit("join-game-room", { roomId: testRoomCode }, resolve)
    );

    const completedPromise = new Promise((resolve) => {
      socket1.once("game:completed", resolve);
    });
    const revealPromise = new Promise((resolve) => {
      socket1.once("game:finalReveal", resolve);
    });

    // Setup Mock Ollama response
    ollamaService.sendPrompt.mockResolvedValue(JSON.stringify({
      explanation: "The detectives successfully traced the poison vial back to the butler.",
      narrative: "Justice was served. The Villa fell quiet as the murderer was escorted away."
    }));

    // 2. Finalize Game via REST API (host only)
    const finalizeRes = await request(app)
      .post(`/api/game/${testRoomCode}/finalize`)
      .set("Authorization", `Bearer ${tokens[0]}`)
      .send();

    expect(finalizeRes.statusCode).toBe(200);
    expect(finalizeRes.body.success).toBe(true);
    expect(finalizeRes.body.finalReveal).toBeDefined();
    expect(finalizeRes.body.summary).toBeDefined();
    expect(finalizeRes.body.finalReveal.winnerStatus).toBe("detectives_won");
    expect(finalizeRes.body.finalReveal.correctVerdict).toBe(true);

    // 3. Verify socket events were emitted
    const socketCompleted = await completedPromise;
    expect(socketCompleted.roomId).toBe(testRoomCode);
    expect(socketCompleted.summary).toBeDefined();

    const socketReveal = await revealPromise;
    expect(socketReveal.roomId).toBe(testRoomCode);
    expect(socketReveal.finalReveal.actualMurderer).toBe("detective_suspect_2");

    // 4. Verify GameState fields populated in database
    const dbGameState = await GameState.findOne({ roomId: testRoomCode });
    expect(dbGameState.finalVerdict).toBe("correct");
    expect(dbGameState.winner).toBe("detectives");
    expect(dbGameState.resolutionStatus).toBe("resolved");
    expect(dbGameState.phase).toBe("reveal");

    const dbRoom = await GameRoom.findOne({ roomCode: testRoomCode });
    expect(dbRoom.status).toBe("ended");

    // 5. Verify room locking: reject new investigation actions and votes
    const inspectRes = await request(app)
      .post("/api/investigation/action")
      .set("Authorization", `Bearer ${tokens[0]}`)
      .send({
        roomId: testRoomCode,
        actionType: "INSPECT_CLUE",
        target: "broken glass",
      });
    expect(inspectRes.statusCode).toBe(400);
    expect(inspectRes.body.error).toContain("completed");

    const voteRes = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${tokens[0]}`)
      .send({
        roomId: testRoomCode,
        accusedPlayerId: users[0]._id.toString(),
      });
    expect(voteRes.statusCode).toBe(400);
    expect(voteRes.body.error).toContain("completed");

    // 6. Verify Fetch Endpoints (Authorization and Results checks)
    const revealFetchRes = await request(app)
      .get(`/api/game/${testRoomCode}/final-reveal`)
      .set("Authorization", `Bearer ${tokens[1]}`);
    expect(revealFetchRes.statusCode).toBe(200);
    expect(revealFetchRes.body.finalReveal.chosenAccused).toBe("detective_player_2"); // users[1].username is detective_player_2

    const summaryFetchRes = await request(app)
      .get(`/api/game/${testRoomCode}/summary`)
      .set("Authorization", `Bearer ${tokens[2]}`);
    expect(summaryFetchRes.statusCode).toBe(200);
    expect(summaryFetchRes.body.summary.numberOfInvestigationActions).toBe(1);

    // Block unauthorized player (not in room)
    const unauthFetchRes = await request(app)
      .get(`/api/game/${testRoomCode}/final-reveal`)
      .set("Authorization", `Bearer ${unauthorizedToken}`);
    expect(unauthFetchRes.statusCode).toBe(403);
  });
});
