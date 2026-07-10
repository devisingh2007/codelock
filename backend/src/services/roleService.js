/**
 * @module roleService
 * Service layer coordinating role assignment, character generation,
 * validation, database persistence, and per-room rate limiting.
 */

"use strict";

const mongoose = require("mongoose");
const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const characterGenerator = require("./ai/characterGenerator");
const { validateRoles } = require("../utils/roleValidator");

// In-memory rate limiting map: roomId -> lastAssignedTimestamp (ms)
const rateLimitMap = new Map();

/**
 * Orchestrates the role assignment for a game room.
 * Generates roles, validates them, saves them atomically, and updates the game phase.
 *
 * @param {string} roomId - 6-character room code.
 * @param {string} requestingUserId - MongoDB ObjectId of the user triggering assignment.
 * @returns {Promise<import('mongoose').Document>} The updated GameState document.
 * @throws {Error} If rate-limited, unauthorized, validation fails, or database transaction fails.
 */
const assignRoles = async (roomId, requestingUserId) => {
  const code = roomId.toUpperCase();

  // 1. Rate-limiting check
  const RATE_LIMIT_SECONDS = parseInt(process.env.ROLE_ASSIGN_RATE_LIMIT, 10) || 60;
  const now = Date.now();
  const lastAssigned = rateLimitMap.get(code);

  if (lastAssigned && now - lastAssigned < RATE_LIMIT_SECONDS * 1000) {
    const remaining = Math.ceil((RATE_LIMIT_SECONDS * 1000 - (now - lastAssigned)) / 1000);
    const err = new Error(`Rate limit exceeded. Please wait ${remaining} seconds before requesting role assignment again.`);
    err.statusCode = 429;
    throw err;
  }

  // Update rate limit timestamp
  rateLimitMap.set(code, now);

  // 2. Load room and check host authorisation
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const err = new Error(`GameRoom "${code}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (room.host.toString() !== requestingUserId.toString()) {
    const err = new Error("Only the room host can trigger role assignment.");
    err.statusCode = 403;
    throw err;
  }

  // 3. Load current GameState
  const state = await GameState.findOne({ roomId: code });
  if (!state) {
    const err = new Error(`GameState not found for room "${code}".`);
    err.statusCode = 404;
    throw err;
  }

  if (!state.story || !state.story.title) {
    const err = new Error("No mystery story has been generated for this room yet.");
    err.statusCode = 400;
    throw err;
  }

  // 4. Generate roles using helper
  const assignedRoles = await generatePlayerSecrets(state.story, state.players);

  // 5. Validate roles using roleValidator
  const validationErrors = validateRoles(assignedRoles, state.players.length);
  if (validationErrors.length > 0) {
    const err = new Error(`Role validation failed: ${validationErrors.join("; ")}`);
    err.statusCode = 422;
    throw err;
  }

  // 6. Persist roles within transaction session
  const useTransaction = process.env.NODE_ENV !== "test";
  const requestingUserObjectId = new mongoose.Types.ObjectId(requestingUserId);

  if (useTransaction) {
    const session = await mongoose.startSession();
    try {
      let updatedState;
      await session.withTransaction(async () => {
        // We load the state again under the session to ensure safety
        const sessionState = await GameState.findOne({ roomId: code }).session(session);
        if (!sessionState) {
          throw new Error(`GameState not found for room "${code}" under transaction.`);
        }

        sessionState.roles = assignedRoles;
        sessionState.phase = "roles-assigned";
        sessionState.history.push({
          action: "roles-assigned",
          by: requestingUserObjectId,
          timestamp: new Date(),
        });
        sessionState.lastUpdated = new Date();

        updatedState = await sessionState.save({ session });
      });
      console.log(`[RoleService] Atomically assigned roles and updated phase to roles-assigned for room ${code}`);
      return updatedState;
    } finally {
      await session.endSession();
    }
  } else {
    // Non-transaction test fallback
    state.roles = assignedRoles;
    state.phase = "roles-assigned";
    state.history.push({
      action: "roles-assigned",
      by: requestingUserObjectId,
      timestamp: new Date(),
    });
    state.lastUpdated = new Date();

    const updatedState = await state.save();
    console.log(`[RoleService] Assigned roles and updated phase to roles-assigned for room ${code}`);
    return updatedState;
  }
};

/**
 * Helper to generate roles and map player user IDs to the generated roles list.
 *
 * @param {object} gameStory - GameState.story object.
 * @param {Array} players - GameState.players array.
 * @returns {Promise<object[]>} Array of assigned role objects.
 */
const generatePlayerSecrets = async (gameStory, players) => {
  const generatedRoles = await characterGenerator.generateCharacters(gameStory);
  const playersCount = players.length;

  return generatedRoles.map((role, idx) => {
    let userId = null;
    if (idx < playersCount) {
      const p = players[idx];
      userId = p.userId || p._id || p;
    }
    return {
      ...role,
      userId: userId ? new mongoose.Types.ObjectId(userId.toString()) : null,
    };
  });
};

/**
 * Helper to save roles array to GameState directly.
 *
 * @param {string} roomId - 6-character room code.
 * @param {object[]} roles - Roles array to save.
 * @param {mongoose.ClientSession} [session] - Optional transaction session.
 * @returns {Promise<import('mongoose').Document>}
 */
const persistRoles = async (roomId, roles, session) => {
  const code = roomId.toUpperCase();
  const query = GameState.findOne({ roomId: code });
  if (session) query.session(session);
  const state = await query.exec();

  if (!state) {
    const err = new Error(`GameState not found for room "${roomId}".`);
    err.statusCode = 404;
    throw err;
  }

  state.roles = roles;
  state.phase = "roles-assigned";
  state.lastUpdated = new Date();

  if (session) {
    return await state.save({ session });
  } else {
    return await state.save();
  }
};

module.exports = {
  assignRoles,
  generatePlayerSecrets,
  persistRoles,
};
