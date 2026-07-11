const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const { generateRoomCode } = require("../utils/roomCode");
const { io } = require("../sockets/gameSocket");

/**
 * Creates a new game room and initializes players with the host.
 * @param {string} hostId 
 * @returns {Promise<object>}
 */
const createRoom = async (hostId) => {
  // Generate a unique 6-character room code
  const roomCode = await generateRoomCode();

  const newRoom = new GameRoom({
    roomCode,
    host: hostId,
    players: [hostId],
    status: "waiting",
    maxPlayers: 4,
  });

  await newRoom.save();

  // Socket emit on creation
  // io.emit('room-created', { roomCode, hostId })
  io.emit("room-created", { roomCode, hostId });

  return newRoom;
};

/**
 * Joins an existing game room.
 * @param {string} roomCode 
 * @param {string} playerId 
 * @returns {Promise<object>}
 */
const joinRoom = async (roomCode, playerId) => {
  const code = roomCode.toUpperCase();
  const room = await GameRoom.findOne({ roomCode: code });

  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  if (room.status !== "waiting") {
    const error = new Error("Room is not in waiting status.");
    error.status = 400;
    throw error;
  }

  // Idempotent join check
  if (room.players.includes(playerId)) {
    return room;
  }

  if (room.players.length >= room.maxPlayers) {
    const error = new Error("Room is full.");
    error.status = 400;
    throw error;
  }

  room.players.push(playerId);
  await room.save();

  // Socket emit on join
  // io.to(roomCode).emit('player-joined', { playerId, roomCode })
  io.to(code).emit("player-joined", { playerId, roomCode: code });

  return room;
};

/**
 * Gets a game room by its room code.
 * @param {string} roomCode 
 * @returns {Promise<object>}
 */
const getRoom = async (roomCode) => {
  const code = roomCode.toUpperCase();
  const room = await GameRoom.findOne({ roomCode: code }).populate("players", "username email");

  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  return room;
};

/**
 * Deletes a game room. Only the host is allowed to delete.
 * @param {string} roomCode 
 * @param {string} userId 
 * @returns {Promise<void>}
 */
const deleteRoom = async (roomCode, userId) => {
  const code = roomCode.toUpperCase();
  const room = await GameRoom.findOne({ roomCode: code });

  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  if (room.host.toString() !== userId.toString()) {
    const error = new Error("Only the host can delete this room.");
    error.status = 403;
    throw error;
  }

  // Delete the room
  await GameRoom.deleteOne({ _id: room._id });

  // Delete any associated GameState (roomId in GameState is the 6-char roomCode)
  await GameState.deleteMany({ roomId: room.roomCode });

  // Socket emit on deletion
  // io.to(roomCode).emit('room-deleted', { roomCode })
  io.to(code).emit("room-deleted", { roomCode: code });
};

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
};
