const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const GameRoom = require("../models/GameRoom");
const ChatMessage = require("../models/ChatMessage");

// Module-level io instance (set when initSocket is called)
let ioInstance = null;


/**
 * Rate Limiter – simple in-memory per-socket message throttle.
 * Allows MAX_MESSAGES messages per WINDOW_MS window.
 */
const MAX_MESSAGES = 10;
const WINDOW_MS = 5000; // 5 seconds

const rateLimitMap = new Map(); // socketId -> { count, resetAt }

const isRateLimited = (socketId) => {
  const now = Date.now();
  const entry = rateLimitMap.get(socketId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(socketId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  if (entry.count >= MAX_MESSAGES) {
    return true;
  }

  entry.count++;
  return false;
};

/**
 * JWT Authentication Middleware for Socket.IO handshake.
 * Expects token in socket.handshake.auth.token
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Authentication error: No token provided."));
    }

    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return next(new Error("Authentication error: User not found."));
    }

    socket.user = user; // Attach user to socket instance
    next();
  } catch (err) {
    return next(new Error("Authentication error: Invalid token."));
  }
};

/**
 * Initialise Socket.IO and register all event handlers.
 * @param {http.Server} server - The HTTP server instance
 * @returns {Server} io - The Socket.IO server instance
 */
const initSocket = (server) => {
  const { Server } = require("socket.io");

  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Apply JWT auth middleware to all connections
  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`[Socket] Connected: ${socket.id} | User: ${user.username}`);

    // ─────────────────────────────────────────────
    // join-room
    // ─────────────────────────────────────────────
    socket.on("join-room", async (roomCode, callback) => {
      try {
        if (!roomCode || typeof roomCode !== "string") {
          return callback && callback({ error: "Invalid room code." });
        }

        const room = await GameRoom.findOne({ roomCode }).populate(
          "players",
          "username"
        );

        if (!room) {
          return callback && callback({ error: "Room not found." });
        }

        // Join Socket.IO room
        socket.join(roomCode);
        socket.currentRoom = roomCode;

        // Fetch last 20 messages for history
        const history = await ChatMessage.find({ roomCode })
          .sort({ timestamp: -1 })
          .limit(20)
          .lean();

        history.reverse(); // oldest first

        // Notify everyone in the room
        socket.to(roomCode).emit("user-joined", {
          userId: user._id,
          username: user.username,
          roomCode,
        });

        console.log(
          `[Socket] ${user.username} joined room ${roomCode}`
        );

        if (callback) {
          callback({
            success: true,
            roomCode,
            players: room.players,
            chatHistory: history,
          });
        }
      } catch (err) {
        console.error("[Socket] join-room error:", err);
        if (callback) callback({ error: "Internal server error." });
      }
    });

    // ─────────────────────────────────────────────
    // leave-room
    // ─────────────────────────────────────────────
    socket.on("leave-room", async (roomCode, callback) => {
      try {
        if (!roomCode) {
          return callback && callback({ error: "Room code required." });
        }

        socket.leave(roomCode);

        io.to(roomCode).emit("user-left", {
          userId: user._id,
          username: user.username,
          roomCode,
        });

        socket.currentRoom = null;

        console.log(`[Socket] ${user.username} left room ${roomCode}`);
        if (callback) callback({ success: true });
      } catch (err) {
        console.error("[Socket] leave-room error:", err);
        if (callback) callback({ error: "Internal server error." });
      }
    });

    // ─────────────────────────────────────────────
    // room-message (chat)
    // ─────────────────────────────────────────────
    socket.on("room-message", async ({ roomCode, message }, callback) => {
      try {
        // Rate limit check
        if (isRateLimited(socket.id)) {
          return (
            callback &&
            callback({ error: "Rate limit exceeded. Slow down." })
          );
        }

        if (!roomCode || !message || typeof message !== "string") {
          return callback && callback({ error: "roomCode and message are required." });
        }

        const trimmed = message.trim();
        if (trimmed.length === 0 || trimmed.length > 500) {
          return (
            callback &&
            callback({
              error: "Message must be between 1 and 500 characters.",
            })
          );
        }

        // Persist to DB
        const chatMsg = await ChatMessage.create({
          roomCode,
          sender: user._id,
          senderUsername: user.username,
          message: trimmed,
        });

        const payload = {
          id: chatMsg._id,
          roomCode,
          sender: {
            id: user._id,
            username: user.username,
          },
          message: trimmed,
          timestamp: chatMsg.timestamp,
        };

        // Broadcast to everyone in the room (including sender)
        io.to(roomCode).emit("room-message", payload);

        console.log(
          `[Socket] Message in ${roomCode} by ${user.username}: ${trimmed}`
        );
        if (callback) callback({ success: true, message: payload });
      } catch (err) {
        console.error("[Socket] room-message error:", err);
        if (callback) callback({ error: "Internal server error." });
      }
    });

    // ─────────────────────────────────────────────
    // kick-player (host only)
    // ─────────────────────────────────────────────
    socket.on("kick-player", async ({ roomCode, playerId }, callback) => {
      try {
        if (!roomCode || !playerId) {
          return callback && callback({ error: "roomCode and playerId are required." });
        }

        const room = await GameRoom.findOne({ roomCode });
        if (!room) {
          return callback && callback({ error: "Room not found." });
        }

        if (room.host.toString() !== user._id.toString()) {
          return callback && callback({ error: "Only the host can kick players." });
        }

        const kickedUser = await User.findById(playerId);

        // Remove player from the room's players list
        room.players = room.players.filter(p => p.toString() !== playerId.toString());
        await room.save();

        // Broadcast user-kicked
        io.to(roomCode).emit("user-kicked", {
          userId: playerId,
          username: kickedUser ? kickedUser.username : "A player",
          roomCode
        });

        console.log(`[Socket] Host ${user.username} kicked player ${playerId} from room ${roomCode}`);
        if (callback) callback({ success: true });
      } catch (err) {
        console.error("[Socket] kick-player error:", err);
        if (callback) callback({ error: "Internal server error." });
      }
    });

    // ─────────────────────────────────────────────
    // add-player (host only)
    // ─────────────────────────────────────────────
    socket.on("add-player", async ({ roomCode, username }, callback) => {
      try {
        if (!roomCode || !username) {
          return callback && callback({ error: "roomCode and username are required." });
        }

        const trimmedUsername = username.trim();
        if (!trimmedUsername) {
          return callback && callback({ error: "Username cannot be empty." });
        }

        const room = await GameRoom.findOne({ roomCode });
        if (!room) {
          return callback && callback({ error: "Room not found." });
        }

        if (room.host.toString() !== user._id.toString()) {
          return callback && callback({ error: "Only the host can add players." });
        }

        if (room.players.length >= room.maxPlayers) {
          return callback && callback({ error: "Lobby is full." });
        }

        // Find or create the user
        let targetUser = await User.findOne({ username: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') } });
        if (!targetUser) {
          targetUser = await User.create({
            username: trimmedUsername,
            email: `${trimmedUsername.toLowerCase().replace(/\s+/g, '')}@mystery.com`,
            password: "dummyPassword123"
          });
        }

        // Check if player is already in room
        if (room.players.includes(targetUser._id)) {
          return callback && callback({ error: "Player is already in this lobby." });
        }

        room.players.push(targetUser._id);
        await room.save();

        // Broadcast user-joined to refresh player lists for all clients
        io.to(roomCode).emit("user-joined", {
          userId: targetUser._id,
          username: targetUser.username,
          roomCode,
        });

        console.log(`[Socket] Host ${user.username} added player ${targetUser.username} to room ${roomCode}`);
        if (callback) callback({ success: true, username: targetUser.username });
      } catch (err) {
        console.error("[Socket] add-player error:", err);
        if (callback) callback({ error: "Internal server error." });
      }
    });

    // ─────────────────────────────────────────────
    // disconnect / cleanup
    // ─────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(
        `[Socket] Disconnected: ${socket.id} | User: ${user.username} | Reason: ${reason}`
      );

      rateLimitMap.delete(socket.id);

      // Notify room if socket was in one
      if (socket.currentRoom) {
        io.to(socket.currentRoom).emit("user-left", {
          userId: user._id,
          username: user.username,
          roomCode: socket.currentRoom,
        });
      }
    });
  });

  ioInstance = io;
  return io;
};

module.exports = {
  initSocket,
  get io() {
    // Returns a no-op proxy if socket not yet initialized (e.g., during HTTP-only tests)
    if (!ioInstance) {
      return {
        emit: () => {},
        to: () => ({ emit: () => {} }),
      };
    }
    return ioInstance;
  },
};
