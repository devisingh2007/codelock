/**
 * @file investigationAndVoting.test.js
 * Comprehensive integration tests for Phase 9: Investigation System + Voting System.
 */

"use strict";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createServer } = require("http");
const { io: ioc } = require("socket.io-client");
const express = require("express");

// Imports under test
const { app } = require("../../server");
const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const User = require("../models/User");
const Vote = require("../models/Vote");
const InvestigationAction = require("../models/InvestigationAction");
const { signToken } = require("../utils/jwt");
const { initSocket } = require("../sockets/gameSocket");
const gameStateSocket = require("../sockets/gameStateSocket");

jest.setTimeout(30000);

let mongoServer;
let users = [];
let tokens = [];
let testRoomCode = "PH9RM1";

const SOCKET_PORT = 4004;
let testHttpServer;
let testIo;
let sockets = [];

const mockStory = {
  title: "Murder at the Villa",
  location: "Living Room",
  victim: { name: "Victim A", description: "Wealthy estate owner" },
  crime: { summary: "Poisoned wine", killer: "user2", type: "poisoning", weapon: "poison" },
  suspects: [
    { name: "user1", background: "Doctor", relationshipToVictim: "Physician", isMurderer: false },
    { name: "user2", background: "Butler", relationshipToVictim: "Servant", isMurderer: true },
    { name: "user3", background: "Chef", relationshipToVictim: "Cook", isMurderer: false },
    { name: "user4", background: "Maid", relationshipToVictim: "Cleaner", isMurderer: false },
  ],
  timeline: [{ time: "8:00 PM", event: "Wine served" }],
  clues: ["empty poison bottle", "torn letter"],
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);

  // Seed 4 users
  for (let i = 1; i <= 4; i++) {
    const user = await User.create({
      username: `user${i}`,
      email: `user${i}@example.com`,
      password: "password123",
    });
    users.push(user);
    tokens.push(signToken({ id: user._id.toString() }));
  }

  // Standalone Socket server setup for real-time validation
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
  sockets.forEach((s) => s.disconnect());
  sockets = [];
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

describe("Phase 9: Investigation & Voting Integration", () => {
  
  // ── Scenario 1 & 2: Room join, start game, investigate & receive socket updates ──
  test("Scenario 1 & 2: 4 players join, start game, send investigation actions & broadcast sockets", async () => {
    // 1. Create a GameRoom with 4 players
    const room = await GameRoom.create({
      roomCode: testRoomCode,
      host: users[0]._id,
      players: users.map((u) => u._id),
      status: "waiting",
      maxPlayers: 4,
    });

    // Create gameState in investigation phase
    await GameState.create({
      roomId: testRoomCode,
      phase: "investigation",
      story: mockStory,
      players: users.map((u) => ({ userId: u._id, role: "detective", cluesFound: [] })),
    });

    // Set up sockets for Scenario 2
    const hostSocket = makeSocket(tokens[0]);
    const client2Socket = makeSocket(tokens[1]);
    sockets.push(hostSocket, client2Socket);

    await connect(hostSocket);
    await connect(client2Socket);

    // Join the game room
    await new Promise((resolve) =>
      hostSocket.emit("join-game-room", { roomId: testRoomCode }, resolve)
    );
    await new Promise((resolve) =>
      client2Socket.emit("join-game-room", { roomId: testRoomCode }, resolve)
    );

    // Prepare socket listener for client2 (should receive updates)
    const actionPromise = new Promise((resolve) => {
      client2Socket.once("investigation:action", resolve);
    });

    const updatePromise = new Promise((resolve) => {
      client2Socket.once("investigation:update", resolve);
    });

    const cluePromise = new Promise((resolve) => {
      client2Socket.once("clue:discovered", resolve);
    });

    // 2. Perform Investigation Action via REST API
    const res = await request(app)
      .post("/api/investigation/action")
      .set("Authorization", `Bearer ${tokens[0]}`)
      .send({
        roomId: testRoomCode,
        actionType: "INSPECT_CLUE",
        target: "empty poison bottle",
        message: "Examining the poison bottle found in the living room bin.",
        metadata: { location: "living room" },
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.action.actionType).toBe("INSPECT_CLUE");
    expect(res.body.action.target).toBe("empty poison bottle");

    // 3. Assert Socket updates received by other players (Scenario 2)
    const receivedAction = await actionPromise;
    expect(receivedAction.actionType).toBe("INSPECT_CLUE");
    expect(receivedAction.target).toBe("empty poison bottle");

    const receivedUpdate = await updatePromise;
    expect(receivedUpdate.roomId).toBe(testRoomCode);
    expect(receivedUpdate.gameState).toBeDefined();

    const receivedClue = await cluePromise;
    expect(receivedClue.clue).toBe("empty poison bottle");
    expect(receivedClue.playerId.toString()).toBe(users[0]._id.toString());

    // 4. Retrieve History & Evidence via APIs
    const historyRes = await request(app)
      .get(`/api/investigation/${testRoomCode}/history`)
      .set("Authorization", `Bearer ${tokens[0]}`);
    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.body.history).toHaveLength(1);

    const evidenceRes = await request(app)
      .get(`/api/investigation/${testRoomCode}/evidence`)
      .set("Authorization", `Bearer ${tokens[0]}`);
    expect(evidenceRes.statusCode).toBe(200);
    expect(evidenceRes.body.discoveredClues).toContain("empty poison bottle");
  });

  // ── Scenario 3: Start Voting & submit duplicate vote rejection ──
  test("Scenario 3: Start voting, submit vote, reject duplicate vote, reject invalid votes", async () => {
    // Setup game room and state in "investigation" phase
    await GameRoom.create({
      roomCode: testRoomCode,
      host: users[0]._id,
      players: users.map((u) => u._id),
      status: "waiting",
      maxPlayers: 4,
    });

    const state = await GameState.create({
      roomId: testRoomCode,
      phase: "investigation",
      story: mockStory,
      players: users.map((u) => ({ userId: u._id, role: "detective", cluesFound: [] })),
    });

    // Try to vote during investigation phase -> should fail
    const prematureVote = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${tokens[1]}`)
      .send({
        roomId: testRoomCode,
        accusedPlayerId: users[1]._id.toString(),
      });
    expect(prematureVote.statusCode).toBe(400);

    // Host starts voting
    const startRes = await request(app)
      .post(`/api/game/${testRoomCode}/start-voting`)
      .set("Authorization", `Bearer ${tokens[0]}`);
    expect(startRes.statusCode).toBe(200);
    expect(startRes.body.gameState.phase).toBe("voting");

    // Player 2 votes for Player 1
    const vote1 = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${tokens[1]}`)
      .send({
        roomId: testRoomCode,
        accusedPlayerId: users[0]._id.toString(),
      });
    expect(vote1.statusCode).toBe(200);
    expect(vote1.body.success).toBe(true);

    // Duplicate vote by Player 2 -> should be rejected with 400
    const vote2 = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${tokens[1]}`)
      .send({
        roomId: testRoomCode,
        accusedPlayerId: users[0]._id.toString(),
      });
    expect(vote2.statusCode).toBe(400);
    expect(vote2.body.error).toContain("Duplicate vote");

    // Invalid suspect (voter not in room or accused not in room) -> should fail
    const externalUserId = new mongoose.Types.ObjectId().toString();
    const voteInvalid = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${tokens[1]}`)
      .send({
        roomId: testRoomCode,
        accusedPlayerId: externalUserId,
      });
    expect(voteInvalid.statusCode).toBe(400);
    expect(voteInvalid.body.error).toContain("Invalid suspect");
  });

  // ── Scenario 4: Voting ends & correct winner calculated ──
  test("Scenario 4: Voting ends, winner/tie correct resolution calculated", async () => {
    await GameRoom.create({
      roomCode: testRoomCode,
      host: users[0]._id,
      players: users.map((u) => u._id),
      status: "waiting",
      maxPlayers: 4,
    });

    await GameState.create({
      roomId: testRoomCode,
      phase: "voting",
      story: mockStory,
      players: users.map((u) => ({ userId: u._id, role: "detective", cluesFound: [] })),
    });

    // Cast votes
    // voter 1 -> accused user2
    // voter 2 -> accused user2
    // voter 3 -> accused user2
    // voter 4 -> accused user1
    await Vote.create({ roomId: testRoomCode, voterId: users[0]._id, accusedPlayerId: users[1]._id, roundNumber: 1 });
    await Vote.create({ roomId: testRoomCode, voterId: users[1]._id, accusedPlayerId: users[1]._id, roundNumber: 1 });
    await Vote.create({ roomId: testRoomCode, voterId: users[2]._id, accusedPlayerId: users[1]._id, roundNumber: 1 });
    await Vote.create({ roomId: testRoomCode, voterId: users[3]._id, accusedPlayerId: users[0]._id, roundNumber: 1 });

    // Host ends voting
    const endRes = await request(app)
      .post(`/api/game/${testRoomCode}/end-voting`)
      .set("Authorization", `Bearer ${tokens[0]}`);

    expect(endRes.statusCode).toBe(200);
    expect(endRes.body.success).toBe(true);
    expect(endRes.body.results.accused).toBe("user2"); // Winner
    expect(endRes.body.results.correct).toBe(true);    // Matches murderer 'user2'
    expect(endRes.body.results.votes["user2"]).toBe(3);
    expect(endRes.body.results.votes["user1"]).toBe(1);
    expect(endRes.body.gameState.phase).toBe("reveal");
  });

  // ── Scenario 5: Completed game phase rejects new actions ──
  test("Scenario 5: Completed game (reveal phase) rejects new votes and new investigation actions", async () => {
    await GameRoom.create({
      roomCode: testRoomCode,
      host: users[0]._id,
      players: users.map((u) => u._id),
      status: "waiting",
      maxPlayers: 4,
    });

    await GameState.create({
      roomId: testRoomCode,
      phase: "reveal", // Completed phase
      story: mockStory,
      players: users.map((u) => ({ userId: u._id, role: "detective", cluesFound: [] })),
    });

    // Try to start/end voting or cast a vote -> should fail
    const voteRes = await request(app)
      .post("/api/vote")
      .set("Authorization", `Bearer ${tokens[1]}`)
      .send({
        roomId: testRoomCode,
        accusedPlayerId: users[0]._id.toString(),
      });
    expect(voteRes.statusCode).toBe(400);

    const actionRes = await request(app)
      .post("/api/investigation/action")
      .set("Authorization", `Bearer ${tokens[0]}`)
      .send({
        roomId: testRoomCode,
        actionType: "INSPECT_CLUE",
        target: "torn letter",
      });
    expect(actionRes.statusCode).toBe(400);
  });
});
