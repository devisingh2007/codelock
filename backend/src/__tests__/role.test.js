/**
 * @file role.test.js
 * Unit and integration tests for Phase 7: AI Character & Role Assignment.
 */

"use strict";

const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { createServer } = require("http");
const { io: ioc } = require("socket.io-client");
const express = require("express");

// Mock low-level Ollama service before importing generator/service
const ollamaService = require("../services/ai/ollamaService");
jest.mock("../services/ai/ollamaService");

// Imports under test
const GameState = require("../models/GameState");
const GameRoom = require("../models/GameRoom");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");
const roleService = require("../services/roleService");
const roleValidator = require("../utils/roleValidator");
const characterGenerator = require("../services/ai/characterGenerator");
const { initSocket } = require("../sockets/gameSocket");
const roleSocket = require("../sockets/roleSocket");
const gameStateSocket = require("../sockets/gameStateSocket");

jest.setTimeout(30000);

let mongoServer;
let hostUser, playerUser;
let hostToken, playerToken;
let testRoomCode;

const SOCKET_PORT = 4003;
let testHttpServer;
let testIo;
let hostSocket, playerSocket;

const mockStory = {
  title: "Murder at the Manor",
  location: "Living Room",
  victim: { name: "Lord Harrington", description: "Wealthy aristocrat" },
  crime: { summary: "Poisoned tea", killer: "Alice" },
  suspects: [
    { name: "Alice", background: "Doctor", relationshipToVictim: "Personal Physician", isMurderer: true },
    { name: "Bob", background: "Butler", relationshipToVictim: "Loyal Servant", isMurderer: false },
  ],
  timeline: [{ time: "9:00 PM", event: "Tea is served" }],
  clues: ["Empty vial in trash"],
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);

  // Seed users
  hostUser = await User.create({
    username: "roleHost",
    email: "rolehost@example.com",
    password: "password",
  });
  playerUser = await User.create({
    username: "rolePlayer",
    email: "roleplayer@example.com",
    password: "password",
  });

  hostToken = signToken({ id: hostUser._id.toString() });
  playerToken = signToken({ id: playerUser._id.toString() });

  // Create test GameRoom
  const room = await GameRoom.create({
    roomCode: "ROLE01",
    host: hostUser._id,
    players: [hostUser._id, playerUser._id],
    status: "waiting",
    maxPlayers: 4,
  });
  testRoomCode = room.roomCode;

  // Standalone Socket server setup
  const standaloneApp = express();
  testHttpServer = createServer(standaloneApp);
  testIo = initSocket(testHttpServer);
  gameStateSocket(testIo);
  roleSocket(testIo);
  await new Promise((resolve) => testHttpServer.listen(SOCKET_PORT, resolve));
});

afterAll(async () => {
  await new Promise((resolve) => testHttpServer.close(resolve));
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(async () => {
  await GameState.deleteMany({});
  jest.clearAllMocks();
});

// Helper for making sockets
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

// ═══════════════════════════════════════════════════════════════════════════════
// 1. UNIT: roleValidator
// ═══════════════════════════════════════════════════════════════════════════════
describe("roleValidator", () => {
  test("passes validation for valid roles array", () => {
    const roles = [
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Alice",
        background: "Doctor",
        objective: "Solve",
        secret: "Hidden vial",
        clues: [],
      },
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Bob",
        background: "Butler",
        objective: "Hide",
        secret: "Saw Alice",
        clues: [],
      },
    ];

    const errors = roleValidator.validateRoles(roles, 2);
    expect(errors).toHaveLength(0);
  });

  test("detects duplicate role names", () => {
    const roles = [
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Alice",
        background: "Doctor",
        objective: "Solve",
        secret: "Hidden vial",
        clues: [],
      },
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Alice", // Duplicate
        background: "Butler",
        objective: "Hide",
        secret: "Saw Alice",
        clues: [],
      },
    ];

    const errors = roleValidator.validateRoles(roles, 2);
    expect(errors).toContain("Duplicate role names are not allowed.");
  });

  test("detects mismatch in player count assignments", () => {
    const roles = [
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Alice",
        background: "Doctor",
        objective: "Solve",
        secret: "Hidden vial",
        clues: [],
      },
      {
        userId: null, // Mismatch (expected 2 player assignments)
        roleName: "Bob",
        background: "Butler",
        objective: "Hide",
        secret: "Saw Alice",
        clues: [],
      },
    ];

    const errors = roleValidator.validateRoles(roles, 2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("Expected exactly 2 roles to be assigned to players");
  });

  test("detects empty secrets or too long (>300 chars) secrets", () => {
    const roles = [
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Alice",
        background: "Doctor",
        objective: "Solve",
        secret: "", // Empty
        clues: [],
      },
      {
        userId: new mongoose.Types.ObjectId(),
        roleName: "Bob",
        background: "Butler",
        objective: "Hide",
        secret: "a".repeat(301), // Too long
        clues: [],
      },
    ];

    const errors = roleValidator.validateRoles(roles, 2);
    expect(errors.length).toBeGreaterThanOrEqual(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. UNIT: characterGenerator
// ═══════════════════════════════════════════════════════════════════════════════
describe("characterGenerator", () => {
  test("generates expected character roles from small story JSON", async () => {
    ollamaService.sendPrompt.mockResolvedValue(
      JSON.stringify({
        roles: [
          {
            roleName: "Alice",
            background: "Doctor",
            objective: "Solve",
            secret: "Hidden vial",
            clues: ["clueA"],
          },
          {
            roleName: "Bob",
            background: "Butler",
            objective: "Hide",
            secret: "Saw Alice",
            clues: ["clueB"],
          },
        ],
      })
    );

    const roles = await characterGenerator.generateCharacters(mockStory);
    expect(roles).toHaveLength(2);
    expect(roles[0].roleName).toBe("Alice");
    expect(roles[0].background).toBe("Doctor");
    expect(roles[1].secret).toBe("Saw Alice");
    expect(roles[1].clues).toContain("clueB");
  });

  test("performs retries and handles errors if LLM output is malformed", async () => {
    ollamaService.sendPrompt
      .mockResolvedValueOnce("invalid-json")
      .mockResolvedValueOnce(
        JSON.stringify({
          roles: [
            {
              roleName: "Alice",
              background: "Doctor",
              objective: "Solve",
              secret: "Hidden vial",
              clues: [],
            },
            {
              roleName: "Bob",
              background: "Butler",
              objective: "Hide",
              secret: "Saw Alice",
              clues: [],
            },
          ],
        })
      );

    const roles = await characterGenerator.generateCharacters(mockStory);
    expect(roles).toHaveLength(2);
    expect(ollamaService.sendPrompt).toHaveBeenCalledTimes(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. UNIT: roleService
// ═══════════════════════════════════════════════════════════════════════════════
describe("roleService", () => {
  test("assignRoles generates exactly one role per player and saves to database", async () => {
    // Seed GameState
    const state = await GameState.create({
      roomId: "ROLE01",
      story: mockStory,
      players: [
        { userId: hostUser._id, role: "detective" },
        { userId: playerUser._id, role: "detective" },
      ],
    });

    ollamaService.sendPrompt.mockResolvedValue(
      JSON.stringify({
        roles: [
          {
            roleName: "Alice",
            background: "Doctor",
            objective: "Solve",
            secret: "Hidden vial",
            clues: [],
          },
          {
            roleName: "Bob",
            background: "Butler",
            objective: "Hide",
            secret: "Saw Alice",
            clues: [],
          },
        ],
      })
    );

    const updated = await roleService.assignRoles("ROLE01", hostUser._id.toString());
    expect(updated.phase).toBe("roles-assigned");
    expect(updated.roles).toHaveLength(2);
    expect(updated.roles.find((r) => r.roleName === "Alice").userId.toString()).toBe(
      hostUser._id.toString()
    );
    expect(updated.roles.find((r) => r.roleName === "Bob").userId.toString()).toBe(
      playerUser._id.toString()
    );
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].action).toBe("roles-assigned");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INTEGRATION: Socket.IO delivery
// ═══════════════════════════════════════════════════════════════════════════════
describe("Socket.IO Role Delivery Integration", () => {
  beforeEach(() => {
    hostSocket = makeSocket(hostToken);
    playerSocket = makeSocket(playerToken);
  });

  afterEach(() => {
    if (hostSocket?.connected) hostSocket.disconnect();
    if (playerSocket?.connected) playerSocket.disconnect();
  });

  test("emits private role-assigned events to each socket containing user specific role", async () => {
    // Seed GameRoom ROLE02
    await GameRoom.create({
      roomCode: "ROLE02",
      host: hostUser._id,
      players: [hostUser._id, playerUser._id],
      status: "waiting",
      maxPlayers: 4,
    });

    // Seed GameState
    await GameState.create({
      roomId: "ROLE02",
      story: mockStory,
      players: [
        { userId: hostUser._id, role: "detective" },
        { userId: playerUser._id, role: "detective" },
      ],
    });

    ollamaService.sendPrompt.mockResolvedValue(
      JSON.stringify({
        roles: [
          {
            roleName: "Alice",
            background: "Doctor",
            objective: "Solve",
            secret: "Hidden vial",
            clues: [],
          },
          {
            roleName: "Bob",
            background: "Butler",
            objective: "Hide",
            secret: "Saw Alice",
            clues: [],
          },
        ],
      })
    );

    await connect(hostSocket);
    await connect(playerSocket);

    // Join room
    await new Promise((resolve) =>
      hostSocket.emit("join-game-room", { roomId: "ROLE02" }, resolve)
    );
    await new Promise((resolve) =>
      playerSocket.emit("join-game-room", { roomId: "ROLE02" }, resolve)
    );

    // Listeners for role-assigned events
    const hostRolePromise = new Promise((resolve) => {
      hostSocket.once("role-assigned", resolve);
    });

    const playerRolePromise = new Promise((resolve) => {
      playerSocket.once("role-assigned", resolve);
    });

    // Request role assignment (sent by host)
    const ack = await new Promise((resolve) => {
      hostSocket.emit("request-role-assignment", { roomId: "ROLE02" }, resolve);
    });

    expect(ack.success).toBe(true);

    const hostRolePayload = await hostRolePromise;
    const playerRolePayload = await playerRolePromise;

    expect(hostRolePayload.role.roleName).toBe("Alice");
    expect(hostRolePayload.role.secret).toBe("Hidden vial");

    expect(playerRolePayload.role.roleName).toBe("Bob");
    expect(playerRolePayload.role.secret).toBe("Saw Alice");
  });
});
