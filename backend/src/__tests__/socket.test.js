const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const { createServer } = require("http");
const { io: ioc } = require("socket.io-client");
const express = require("express");
const { initSocket } = require("../../src/sockets/gameSocket");
const User = require("../../src/models/User");
const GameRoom = require("../../src/models/GameRoom");
const ChatMessage = require("../../src/models/ChatMessage");
const { signToken } = require("../../src/utils/jwt");

let mongoServer;
let httpServer;
let hostUser, player1User;
let hostToken, player1Token;
let hostSocket, player1Socket;
let testRoomCode;

const PORT = 4001;

jest.setTimeout(20000);

beforeAll(async () => {
  // In-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);

  // Seed users
  hostUser = await User.create({
    username: "socketHost",
    email: "sockethost@example.com",
    password: "hashedpassword",
  });
  player1User = await User.create({
    username: "socketPlayer1",
    email: "socketplayer1@example.com",
    password: "hashedpassword",
  });

  hostToken = signToken({ id: hostUser._id.toString() });
  player1Token = signToken({ id: player1User._id.toString() });

  // Create a test room
  const room = await GameRoom.create({
    roomCode: "SOCK01",
    host: hostUser._id,
    players: [hostUser._id],
    status: "waiting",
    maxPlayers: 4,
  });
  testRoomCode = room.roomCode;

  // Create a standalone Express + HTTP server just for socket tests
  const testApp = express();
  httpServer = createServer(testApp);
  initSocket(httpServer);

  await new Promise((resolve) => httpServer.listen(PORT, resolve));
});

afterAll(async () => {
  if (hostSocket && hostSocket.connected) hostSocket.disconnect();
  if (player1Socket && player1Socket.connected) player1Socket.disconnect();

  await new Promise((resolve, reject) =>
    httpServer.close((err) => (err ? reject(err) : resolve()))
  );

  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

beforeEach(() => {
  hostSocket = ioc(`http://localhost:${PORT}`, {
    auth: { token: hostToken },
    autoConnect: false,
    transports: ["websocket"],
  });
  player1Socket = ioc(`http://localhost:${PORT}`, {
    auth: { token: player1Token },
    autoConnect: false,
    transports: ["websocket"],
  });
});

afterEach(async () => {
  if (hostSocket && hostSocket.connected) hostSocket.disconnect();
  if (player1Socket && player1Socket.connected) player1Socket.disconnect();
  await ChatMessage.deleteMany({});
});

const connectSocket = (socket) =>
  new Promise((resolve, reject) => {
    socket.connect();
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });

// ─────────────────────────────────────────────────────────────────────────────
describe("Socket.IO – Authentication", () => {
  test("should reject connection without token", (done) => {
    const unauthSocket = ioc(`http://localhost:${PORT}`, {
      auth: {},
      autoConnect: false,
      transports: ["websocket"],
    });
    unauthSocket.connect();
    unauthSocket.once("connect_error", (err) => {
      expect(err.message).toMatch(/Authentication error/i);
      unauthSocket.disconnect();
      done();
    });
  });

  test("should reject connection with invalid token", (done) => {
    const badSocket = ioc(`http://localhost:${PORT}`, {
      auth: { token: "bad.jwt.token" },
      autoConnect: false,
      transports: ["websocket"],
    });
    badSocket.connect();
    badSocket.once("connect_error", (err) => {
      expect(err.message).toMatch(/Authentication error/i);
      badSocket.disconnect();
      done();
    });
  });

  test("should connect successfully with valid JWT", async () => {
    await connectSocket(hostSocket);
    expect(hostSocket.connected).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Socket.IO – join-room", () => {
  test("should join a room and receive success + chat history", async () => {
    await connectSocket(hostSocket);

    const result = await new Promise((resolve) => {
      hostSocket.emit("join-room", testRoomCode, resolve);
    });

    expect(result.success).toBe(true);
    expect(result.roomCode).toBe(testRoomCode);
    expect(Array.isArray(result.chatHistory)).toBe(true);
  });

  test("should notify others via user-joined event", async () => {
    await connectSocket(hostSocket);
    await connectSocket(player1Socket);

    // Host joins first
    await new Promise((resolve) => hostSocket.emit("join-room", testRoomCode, resolve));

    // Host listens for user-joined
    const joinedPromise = new Promise((resolve) => {
      hostSocket.once("user-joined", resolve);
    });

    // Player1 joins
    player1Socket.emit("join-room", testRoomCode, () => {});

    const event = await joinedPromise;
    expect(event.username).toBe("socketPlayer1");
    expect(event.roomCode).toBe(testRoomCode);
  });

  test("should return error for non-existent room code", async () => {
    await connectSocket(hostSocket);

    const result = await new Promise((resolve) => {
      hostSocket.emit("join-room", "NOROOM", resolve);
    });

    expect(result.error).toMatch(/Room not found/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Socket.IO – leave-room", () => {
  test("should leave a room and notify others with user-left", async () => {
    await connectSocket(hostSocket);
    await connectSocket(player1Socket);

    await new Promise((resolve) => hostSocket.emit("join-room", testRoomCode, resolve));
    await new Promise((resolve) => player1Socket.emit("join-room", testRoomCode, resolve));

    const leftPromise = new Promise((resolve) => {
      hostSocket.once("user-left", resolve);
    });

    const result = await new Promise((resolve) => {
      player1Socket.emit("leave-room", testRoomCode, resolve);
    });

    expect(result.success).toBe(true);

    const event = await leftPromise;
    expect(event.username).toBe("socketPlayer1");
    expect(event.roomCode).toBe(testRoomCode);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("Socket.IO – room-message", () => {
  test("should broadcast a message and persist it to the database", async () => {
    await connectSocket(hostSocket);
    await connectSocket(player1Socket);

    await new Promise((resolve) => hostSocket.emit("join-room", testRoomCode, resolve));
    await new Promise((resolve) => player1Socket.emit("join-room", testRoomCode, resolve));

    // player1 listens for broadcast
    const msgPromise = new Promise((resolve) => {
      player1Socket.once("room-message", resolve);
    });

    const ack = await new Promise((resolve) => {
      hostSocket.emit("room-message", { roomCode: testRoomCode, message: "Hello room!" }, resolve);
    });

    expect(ack.success).toBe(true);

    const broadcast = await msgPromise;
    expect(broadcast.message).toBe("Hello room!");
    expect(broadcast.sender.username).toBe("socketHost");

    // Check DB persistence
    const saved = await ChatMessage.findOne({ roomCode: testRoomCode });
    expect(saved).not.toBeNull();
    expect(saved.message).toBe("Hello room!");
  });

  test("should reject whitespace-only messages", async () => {
    await connectSocket(hostSocket);
    await new Promise((resolve) => hostSocket.emit("join-room", testRoomCode, resolve));

    const result = await new Promise((resolve) => {
      hostSocket.emit("room-message", { roomCode: testRoomCode, message: "   " }, resolve);
    });

    expect(result.error).toBeTruthy();
  });

  test("should reject messages exceeding 500 characters", async () => {
    await connectSocket(hostSocket);
    await new Promise((resolve) => hostSocket.emit("join-room", testRoomCode, resolve));

    const longMsg = "x".repeat(501);
    const result = await new Promise((resolve) => {
      hostSocket.emit("room-message", { roomCode: testRoomCode, message: longMsg }, resolve);
    });

    expect(result.error).toBeTruthy();
  });
});
