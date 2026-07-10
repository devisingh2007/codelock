const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const Vote = require("../models/Vote");
const GameEvent = require("../models/GameEvent");
const gameResolutionService = require("./gameResolutionService");
const { io } = require("../sockets/gameSocket");

/**
 * Casts a vote for a suspected murderer.
 *
 * @param {object} params
 * @param {string} params.roomId
 * @param {string} params.voterId
 * @param {string} params.accusedPlayerId
 * @returns {Promise<object>}
 */
const castVote = async ({ roomId, voterId, accusedPlayerId }) => {
  const code = roomId.toUpperCase();

  // 1. Verify room exists
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  // 2. Verify voter is in the room
  if (!room.players.map(p => p.toString()).includes(voterId.toString())) {
    const error = new Error("User not in room.");
    error.status = 403;
    throw error;
  }

  // 3. Verify accused player is in the room
  if (!room.players.map(p => p.toString()).includes(accusedPlayerId.toString())) {
    const error = new Error("Invalid suspect: accused player is not in this room.");
    error.status = 400;
    throw error;
  }

  // 4. Retrieve GameState and verify phase is "voting"
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  if (gameState.phase !== "voting") {
    const error = new Error(`Cannot vote outside voting phase. Current phase is "${gameState.phase}".`);
    error.status = 400;
    throw error;
  }

  // 5. Check for duplicate vote in the current round (default 1)
  const roundNumber = 1;
  const existingVote = await Vote.findOne({ roomId: code, voterId, roundNumber });
  if (existingVote) {
    const error = new Error("Duplicate vote: you have already voted in this round.");
    error.status = 400;
    throw error;
  }

  // 6. Save Vote to DB
  const vote = await Vote.create({
    roomId: code,
    voterId,
    accusedPlayerId,
    roundNumber,
  });

  // 7. Record GameEvent
  await GameEvent.create({
    roomId: code,
    eventType: "VOTE_CAST",
    playerId: voterId,
    data: { accusedPlayerId, roundNumber },
  });

  // 8. Emit state update via Socket.IO
  io.to(code).emit("state-changed", {
    roomId: code,
    gameState,
  });

  return vote;
};

/**
 * Transitions game phase from "investigation" to "voting".
 *
 * @param {string} roomId
 * @param {string} hostId
 * @returns {Promise<object>}
 */
const startVoting = async (roomId, hostId) => {
  const code = roomId.toUpperCase();

  // Verify host
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  if (room.host.toString() !== hostId.toString()) {
    const error = new Error("Unauthorized action. Only the room host can start voting.");
    error.status = 403;
    throw error;
  }

  // Find GameState
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  if (gameState.phase !== "investigation") {
    const error = new Error(`Cannot start voting from "${gameState.phase}" phase.`);
    error.status = 400;
    throw error;
  }

  // Transition phase to "voting"
  gameState.phase = "voting";
  gameState.eventsLog.push({
    event: `Phase advanced to "voting" by host.`,
    timestamp: new Date(),
  });
  gameState.lastUpdated = new Date();
  await gameState.save();

  // Record GameEvent
  await GameEvent.create({
    roomId: code,
    eventType: "PHASE_CHANGED_VOTING",
    data: { newPhase: "voting" },
  });

  // Emit Socket.IO phase change
  io.to(code).emit("state-changed", {
    roomId: code,
    gameState,
  });
  io.to(code).emit("phase-changed", {
    roomId: code,
    phase: "voting",
  });

  return gameState;
};

/**
 * Transitions game phase from "voting" to "reveal", calculating the final results.
 *
 * @param {string} roomId
 * @param {string} hostId
 * @returns {Promise<object>}
 */
const endVoting = async (roomId, hostId) => {
  const code = roomId.toUpperCase();

  // Verify host
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  if (room.host.toString() !== hostId.toString()) {
    const error = new Error("Unauthorized action. Only the room host can end voting.");
    error.status = 403;
    throw error;
  }

  // Find GameState
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  if (gameState.phase !== "voting") {
    const error = new Error(`Cannot end voting during "${gameState.phase}" phase.`);
    error.status = 400;
    throw error;
  }

  // Calculate game resolution results
  const results = await gameResolutionService.resolveGame(code);

  // Transition phase to "reveal"
  gameState.phase = "reveal";
  gameState.eventsLog.push({
    event: `Phase advanced to "reveal" by host. Accused: ${results.accused}`,
    timestamp: new Date(),
  });
  gameState.lastUpdated = new Date();
  await gameState.save();

  // Record GameEvent
  await GameEvent.create({
    roomId: code,
    eventType: "PHASE_CHANGED_REVEAL",
    data: { newPhase: "reveal", results },
  });

  // Emit Socket.IO phase change
  io.to(code).emit("state-changed", {
    roomId: code,
    gameState,
  });
  io.to(code).emit("phase-changed", {
    roomId: code,
    phase: "reveal",
    results,
  });

  return { results, gameState };
};

/**
 * Gets voting results calculated on current votes.
 *
 * @param {string} roomId
 * @returns {Promise<object>}
 */
const getResults = async (roomId) => {
  return gameResolutionService.resolveGame(roomId);
};

module.exports = {
  castVote,
  startVoting,
  endVoting,
  getResults,
};
