const request = require("supertest");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { app } = require("../../server");
const GameRoom = require("../models/GameRoom");
const User = require("../models/User");
const { signToken } = require("../utils/jwt");

let mongoServer;
let hostToken;
let player1Token;
let player2Token;
let hostId;
let player1Id;
let player2Id;

jest.setTimeout(30000);

beforeAll(async () => {
  // Start mongo-memory-server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Disconnect from standard database connection if active
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  // Connect to memory DB
  await mongoose.connect(mongoUri);

  // Setup seed users
  const host = new User({ username: "hostUser", email: "host@example.com", password: "password123" });
  await host.save();
  hostId = host._id.toString();
  hostToken = signToken({ id: hostId });

  const player1 = new User({ username: "playerOne", email: "player1@example.com", password: "password123" });
  await player1.save();
  player1Id = player1._id.toString();
  player1Token = signToken({ id: player1Id });

  const player2 = new User({ username: "playerTwo", email: "player2@example.com", password: "password123" });
  await player2.save();
  player2Id = player2._id.toString();
  player2Token = signToken({ id: player2Id });
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

beforeEach(async () => {
  // Clean up GameRooms between tests
  await GameRoom.deleteMany({});
});

describe("Game Room Endpoints", () => {
  describe("POST /api/game/create", () => {
    test("should successfully create a game room", async () => {
      const res = await request(app)
        .post("/api/game/create")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({});

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.room).toHaveProperty("roomCode");
      expect(res.body.room.host).toBe(hostId);
      expect(res.body.room.players).toContain(hostId);
      expect(res.body.room.status).toBe("waiting");
      expect(res.body.room.maxPlayers).toBe(4);

      // Verify stored in DB
      const dbRoom = await GameRoom.findOne({ roomCode: res.body.room.roomCode });
      expect(dbRoom).not.toBeNull();
      expect(dbRoom.host.toString()).toBe(hostId);
    });

    test("should return 401 when creating without token", async () => {
      const res = await request(app)
        .post("/api/game/create")
        .send({});

      expect(res.statusCode).toBe(401);
    });
  });

  describe("POST /api/game/join", () => {
    test("should allow a player to join a room", async () => {
      // Create room first
      const createRes = await request(app)
        .post("/api/game/create")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({});
      
      const { roomCode } = createRes.body.room;

      // Join
      const joinRes = await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode });

      expect(joinRes.statusCode).toBe(200);
      expect(joinRes.body.success).toBe(true);
      expect(joinRes.body.room.players).toContain(player1Id);
      expect(joinRes.body.room.players.length).toBe(2);
    });

    test("should be idempotent when player joins multiple times", async () => {
      const createRes = await request(app)
        .post("/api/game/create")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({});
      
      const { roomCode } = createRes.body.room;

      // First join
      await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode });

      // Second join
      const joinRes = await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode });

      expect(joinRes.statusCode).toBe(200);
      expect(joinRes.body.room.players.length).toBe(2);
    });

    test("should prevent joining a non-existent room", async () => {
      const res = await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode: "NONEX1" });

      expect(res.statusCode).toBe(404);
      expect(res.body.error).toContain("Room not found");
    });

    test("should prevent joining when room is full", async () => {
      // Create room with maxPlayers = 1 to test full
      const roomCode = "FULLR1";
      const fullRoom = new GameRoom({
        roomCode,
        host: hostId,
        players: [hostId],
        status: "waiting",
        maxPlayers: 1,
      });
      await fullRoom.save();

      const res = await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Room is full");
    });

    test("should prevent joining if status is not waiting", async () => {
      const roomCode = "START1";
      const activeRoom = new GameRoom({
        roomCode,
        host: hostId,
        players: [hostId],
        status: "in_progress",
        maxPlayers: 4,
      });
      await activeRoom.save();

      const res = await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain("Room is not in waiting status");
    });

    test("should reject invalid room code formats", async () => {
      const res = await request(app)
        .post("/api/game/join")
        .set("Authorization", `Bearer ${player1Token}`)
        .send({ roomCode: "SHORT" }); // 5 chars

      expect(res.statusCode).toBe(400);
    });
  });

  describe("GET /api/game/:roomCode", () => {
    test("should successfully fetch room details", async () => {
      const createRes = await request(app)
        .post("/api/game/create")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({});
      
      const { roomCode } = createRes.body.room;

      const res = await request(app)
        .get(`/api/game/${roomCode}`)
        .set("Authorization", `Bearer ${player1Token}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.room.roomCode).toBe(roomCode);
      expect(res.body.room.players[0]).toHaveProperty("username", "hostUser");
    });

    test("should return 404 for a non-existent room", async () => {
      const res = await request(app)
        .get("/api/game/EMPTY1")
        .set("Authorization", `Bearer ${player1Token}`);

      expect(res.statusCode).toBe(404);
    });
  });

  describe("DELETE /api/game/:roomCode", () => {
    test("should allow host to delete the room", async () => {
      const createRes = await request(app)
        .post("/api/game/create")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({});
      
      const { roomCode } = createRes.body.room;

      const deleteRes = await request(app)
        .delete(`/api/game/${roomCode}`)
        .set("Authorization", `Bearer ${hostToken}`);

      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      const dbRoom = await GameRoom.findOne({ roomCode });
      expect(dbRoom).toBeNull();
    });

    test("should block non-host from deleting the room", async () => {
      const createRes = await request(app)
        .post("/api/game/create")
        .set("Authorization", `Bearer ${hostToken}`)
        .send({});
      
      const { roomCode } = createRes.body.room;

      const deleteRes = await request(app)
        .delete(`/api/game/${roomCode}`)
        .set("Authorization", `Bearer ${player1Token}`);

      expect(deleteRes.statusCode).toBe(403);
      expect(deleteRes.body.error).toContain("Only the host can delete this room");
    });
  });
});
