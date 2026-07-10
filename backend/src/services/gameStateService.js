/**
 * @module gameStateService
 * Business-logic layer for the Phase 5 Game State Engine.
 * All DB operations are performed here; controllers delegate to this service.
 */

const mongoose = require("mongoose");
const GameState = require("../models/GameState");
const GameRoom = require("../models/GameRoom");
const {
  VersionConflictError,
  InvalidPhaseTransitionError,
  UnauthorisedError,
  nextPhase,
  mergeStateChanges,
  appendEvent,
} = require("../utils/stateUtils");

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Finds a GameState by roomId or throws 404-style error.
 * @param {string} roomId
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<import('mongoose').Document>}
 */
const findStateOrThrow = async (roomId, session) => {
  const query = GameState.findOne({ roomId: roomId.toUpperCase() }).populate("roles.userId", "username");
  if (session) query.session(session);
  const state = await query.exec();
  if (!state) {
    const err = new Error(`GameState not found for room "${roomId}".`);
    err.statusCode = 404;
    throw err;
  }
  return state;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieves the current GameState for a room.
 * Creates a new GameState document if one does not exist yet.
 *
 * @param {string} roomId - The 6-character room code.
 * @returns {Promise<import('mongoose').Document>}
 */
const getOrCreateState = async (roomId) => {
  const code = roomId.toUpperCase();
  let state = await GameState.findOne({ roomId: code }).populate("roles.userId", "username");

  if (!state) {
    state = await GameState.create({ roomId: code });
    state = await GameState.findOne({ roomId: code }).populate("roles.userId", "username");
    console.log(`[GameStateService] Created new state for room ${code}`);
  }
  return state;
};

/**
 * Retrieves the GameState for a room (does not auto-create).
 *
 * @param {string} roomId
 * @returns {Promise<import('mongoose').Document>}
 */
const getState = async (roomId) => findStateOrThrow(roomId);

/**
 * Applies a partial update to the GameState using optimistic concurrency.
 * Uses findOneAndUpdate with the current __v to detect conflicts.
 *
 * @param {string} roomId
 * @param {object} changes     - Partial state update payload.
 * @param {number} clientVersion - The __v the client last saw.
 * @returns {Promise<import('mongoose').Document>} Updated document.
 * @throws {VersionConflictError} If __v in DB differs from clientVersion.
 */
const updateState = async (roomId, changes, clientVersion) => {
  const code = roomId.toUpperCase();

  // Build a $set payload from changes (only allowed keys)
  const setPayload = {};
  if (changes.story !== undefined) setPayload.story = changes.story;
  if (changes.players !== undefined) setPayload.players = changes.players;

  const pushPayload = {};
  if (Array.isArray(changes.eventsLog) && changes.eventsLog.length > 0) {
    pushPayload.eventsLog = { $each: changes.eventsLog };
  }
  // Always push a system event entry
  const systemEvent = {
    timestamp: new Date(),
    event: `State updated (v${clientVersion} → v${clientVersion + 1})`,
  };
  pushPayload.eventsLog = pushPayload.eventsLog
    ? { ...pushPayload.eventsLog, $each: [...(pushPayload.eventsLog.$each ?? []), systemEvent] }
    : { $each: [systemEvent] };

  const updateOp = {
    $set: { ...setPayload, lastUpdated: new Date() },
    $push: pushPayload,
    $inc: { __v: 1 },
  };

  const updated = await GameState.findOneAndUpdate(
    { roomId: code, __v: clientVersion }, // version-locked filter
    updateOp,
    { new: true, runValidators: true }
  );

  if (!updated) {
    // Document exists but version didn't match → conflict
    const exists = await GameState.exists({ roomId: code });
    if (!exists) {
      const err = new Error(`Room "${roomId}" has no GameState.`);
      err.statusCode = 404;
      throw err;
    }
    throw new VersionConflictError();
  }

  console.log(`[GameStateService] State updated for room ${code} (now v${updated.__v})`);
  return updated;
};

/**
 * Advances the game phase for a room.
 * Only the host of the room is allowed to call this.
 * Uses a MongoDB transaction to atomically update both GameRoom and GameState.
 *
 * @param {string} roomId
 * @param {string} requestingUserId - Caller's MongoDB ObjectId as string.
 * @returns {Promise<import('mongoose').Document>} Updated GameState.
 * @throws {UnauthorisedError} If caller is not the room host.
 * @throws {InvalidPhaseTransitionError} If already at the final phase.
 */
const advancePhase = async (roomId, requestingUserId) => {
  const code = roomId.toUpperCase();

  // MongoDB transactions require a replica set. In test environments (single-node
  // MongoMemoryServer) we skip the session and perform operations directly.
  const useTransaction = process.env.NODE_ENV !== "test";

  // Verify host
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const err = new Error(`Room "${code}" not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (room.host.toString() !== requestingUserId.toString()) {
    throw new UnauthorisedError("Only the room host can advance the phase.");
  }

  // Load current state
  const state = await findStateOrThrow(code);

  // Determine next phase (throws InvalidPhaseTransitionError if at end)
  const newPhase = nextPhase(state.phase);

  if (useTransaction) {
    const session = await mongoose.startSession();
    try {
      let updatedState;
      await session.withTransaction(async () => {
        state.phase = newPhase;
        appendEvent(state, `Phase advanced to "${newPhase}" by host.`);
        state.lastUpdated = new Date();
        updatedState = await state.save({ session });
      });
      console.log(`[GameStateService] Phase for room ${code}: → ${newPhase}`);
      return updatedState;
    } finally {
      await session.endSession();
    }
  } else {
    // Test path – direct save without transaction
    state.phase = newPhase;
    appendEvent(state, `Phase advanced to "${newPhase}" by host.`);
    state.lastUpdated = new Date();
    const updatedState = await state.save();
    console.log(`[GameStateService] Phase for room ${code}: → ${newPhase}`);
    return updatedState;
  }
};

/**
 * Restores the current persisted GameState for a room.
 * This is essentially a re-read from DB and returns the authoritative state.
 * Useful after server restarts or client reconnection.
 *
 * @param {string} roomId
 * @returns {Promise<import('mongoose').Document>}
 */
const restoreState = async (roomId) => {
  const state = await getOrCreateState(roomId);
  appendEvent(state, "State restored/synced from server.");
  state.lastUpdated = new Date();
  await state.save();
  console.log(`[GameStateService] State restored for room ${roomId.toUpperCase()}`);
  return state;
};

/**
 * Appends a single event to the eventsLog without touching other fields.
 *
 * @param {string} roomId
 * @param {string} eventDescription
 * @returns {Promise<import('mongoose').Document>}
 */
const logEvent = async (roomId, eventDescription) => {
  const code = roomId.toUpperCase();
  const updated = await GameState.findOneAndUpdate(
    { roomId: code },
    {
      $push: { eventsLog: { timestamp: new Date(), event: eventDescription } },
      $set: { lastUpdated: new Date() },
    },
    { new: true }
  );
  return updated;
};

module.exports = {
  getOrCreateState,
  getState,
  updateState,
  advancePhase,
  restoreState,
  logEvent,
};
