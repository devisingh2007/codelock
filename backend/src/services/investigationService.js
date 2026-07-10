const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const InvestigationAction = require("../models/InvestigationAction");
const GameEvent = require("../models/GameEvent");
const gameSocket = require("../sockets/gameSocket");

/**
 * Handles creation of an investigation action.
 *
 * @param {object} params
 * @param {string} params.roomId
 * @param {string} params.playerId
 * @param {string} params.actionType
 * @param {string} params.target
 * @param {string} params.message
 * @param {object} params.metadata
 * @returns {Promise<object>}
 */
const createAction = async ({ roomId, playerId, actionType, target, message, metadata = {} }) => {
  const code = roomId.toUpperCase();

  // 1. Verify room exists
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  // 2. Verify player is in room
  if (!room.players.map(p => p.toString()).includes(playerId.toString())) {
    const error = new Error("User not in room.");
    error.status = 403;
    throw error;
  }

  // 3. Find GameState
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  // 4. Validate Game Phase is "investigation"
  if (gameState.phase !== "investigation") {
    const error = new Error(`Action not allowed during "${gameState.phase}" phase.`);
    error.status = 400;
    throw error;
  }

  // 5. Create InvestigationAction
  const action = await InvestigationAction.create({
    roomId: code,
    playerId,
    actionType,
    target,
    message,
    metadata,
  });

  // 6. Record GameEvent
  await GameEvent.create({
    roomId: code,
    eventType: `INVESTIGATION_${actionType}`,
    playerId,
    data: { target, message, metadata },
  });

  // 7. Update GameState based on action type
  if (actionType === "INSPECT_CLUE") {
    const playerIdx = gameState.players.findIndex(
      p => p.userId.toString() === playerId.toString()
    );
    if (playerIdx !== -1) {
      if (!gameState.players[playerIdx].cluesFound.includes(target)) {
        gameState.players[playerIdx].cluesFound.push(target);
      }
    }
  }

  // Push to eventsLog
  gameState.eventsLog.push({
    event: `Player investigated: ${actionType} on ${target} by ${playerId}`,
    timestamp: new Date(),
  });
  gameState.lastUpdated = new Date();
  await gameState.save();

  // 8. Socket emissions
  // Emits:
  // - investigation:action
  // - investigation:update
  // - clue:discovered (if clue)
  // - player:accused (if accusation)
  gameSocket.io.to(code).emit("investigation:action", {
    roomId: code,
    playerId,
    actionType,
    target,
    message,
    metadata,
  });

  gameSocket.io.to(code).emit("investigation:update", {
    roomId: code,
    gameState,
  });

  if (actionType === "INSPECT_CLUE") {
    gameSocket.io.to(code).emit("clue:discovered", {
      roomId: code,
      playerId,
      clue: target,
    });
  } else if (actionType === "ACCUSE_PLAYER") {
    gameSocket.io.to(code).emit("player:accused", {
      roomId: code,
      playerId,
      suspect: target,
    });
  }

  return { action, gameState };
};

/**
 * Retrieves the investigation actions history for a room.
 *
 * @param {string} roomId
 * @returns {Promise<Array>}
 */
const getHistory = async (roomId) => {
  const code = roomId.toUpperCase();
  return InvestigationAction.find({ roomId: code }).sort({ createdAt: 1 }).populate("playerId", "username email");
};

/**
 * Retrieves the evidence details for a room.
 *
 * @param {string} roomId
 * @returns {Promise<object>}
 */
const getEvidence = async (roomId) => {
  const code = roomId.toUpperCase();
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  const allClues = gameState.story?.clues || [];
  // Discovered clues across all players
  const discoveredClues = Array.from(
    new Set(
      gameState.players.reduce((acc, p) => acc.concat(p.cluesFound || []), [])
    )
  );

  return {
    discoveredClues,
    storyClues: allClues,
  };
};

module.exports = {
  createAction,
  getHistory,
  getEvidence,
};
