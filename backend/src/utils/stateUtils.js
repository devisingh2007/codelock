/**
 * @module stateUtils
 * Utility helpers for the Phase 5 Game State Engine.
 * All functions are pure (no side-effects) unless noted otherwise.
 */

const { PHASES } = require("../models/GameState");

// ─── Custom Error Classes ─────────────────────────────────────────────────────

/**
 * Thrown when an optimistic-concurrency version conflict is detected.
 */
class VersionConflictError extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message = "State version conflict – refresh and retry.") {
    super(message);
    this.name = "VersionConflictError";
    this.statusCode = 409;
  }
}

/**
 * Thrown when a phase transition is invalid (e.g. already at "reveal").
 */
class InvalidPhaseTransitionError extends Error {
  /**
   * @param {string} currentPhase
   */
  constructor(currentPhase) {
    super(`Cannot advance from phase "${currentPhase}" – already at final phase.`);
    this.name = "InvalidPhaseTransitionError";
    this.statusCode = 400;
  }
}

/**
 * Thrown when a caller is not authorised to perform an action.
 */
class UnauthorisedError extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message = "Unauthorised action.") {
    super(message);
    this.name = "UnauthorisedError";
    this.statusCode = 403;
  }
}

// ─── Phase helpers ────────────────────────────────────────────────────────────

/**
 * Returns the next phase in the game lifecycle.
 * @param {string} currentPhase - One of PHASES.
 * @returns {string} The next phase string.
 * @throws {InvalidPhaseTransitionError} If already at the final phase.
 */
const nextPhase = (currentPhase) => {
  const idx = PHASES.indexOf(currentPhase);
  if (idx === -1 || idx === PHASES.length - 1) {
    throw new InvalidPhaseTransitionError(currentPhase);
  }
  return PHASES[idx + 1];
};

/**
 * Returns true if `phase` is a valid game phase.
 * @param {string} phase
 * @returns {boolean}
 */
const isValidPhase = (phase) => PHASES.includes(phase);

// ─── State merge helpers ──────────────────────────────────────────────────────

/**
 * Whitelist of top-level GameState fields that clients may update.
 */
const ALLOWED_UPDATE_KEYS = ["story", "eventsLog", "players"];

/**
 * Merges a partial update object into a Mongoose GameState document safely.
 * Only keys in ALLOWED_UPDATE_KEYS are applied; unknown keys are silently ignored.
 *
 * @param {import('mongoose').Document} stateDoc - Existing Mongoose document.
 * @param {object} changes - Partial update object from client.
 * @returns {import('mongoose').Document} The mutated document (not yet saved).
 */
const mergeStateChanges = (stateDoc, changes) => {
  for (const key of ALLOWED_UPDATE_KEYS) {
    if (changes[key] === undefined) continue;

    if (key === "eventsLog" && Array.isArray(changes.eventsLog)) {
      // Append new log entries rather than replacing the whole array
      stateDoc.eventsLog.push(...changes.eventsLog);
    } else if (key === "players" && Array.isArray(changes.players)) {
      // Merge player state by userId
      for (const updatedPlayer of changes.players) {
        const existing = stateDoc.players.find(
          (p) => p.userId.toString() === updatedPlayer.userId?.toString()
        );
        if (existing) {
          Object.assign(existing, updatedPlayer);
        } else {
          stateDoc.players.push(updatedPlayer);
        }
      }
    } else {
      stateDoc[key] = changes[key];
    }
  }
  return stateDoc;
};

// ─── Event log helper ─────────────────────────────────────────────────────────

/**
 * Appends a structured event entry to the eventsLog array of a state doc.
 * Does NOT save the document.
 *
 * @param {import('mongoose').Document} stateDoc - Mongoose GameState document.
 * @param {string} eventDescription - Human-readable event description.
 * @returns {import('mongoose').Document} The mutated document.
 */
const appendEvent = (stateDoc, eventDescription) => {
  stateDoc.eventsLog.push({
    timestamp: new Date(),
    event: eventDescription,
  });
  return stateDoc;
};

// ─── Diffing helper ───────────────────────────────────────────────────────────

/**
 * Returns a shallow diff of two plain objects, showing keys that changed.
 * Useful for logging and debugging state changes.
 *
 * @param {object} oldObj
 * @param {object} newObj
 * @returns {object} Object containing only the changed keys with their new values.
 */
const shallowDiff = (oldObj, newObj) => {
  const diff = {};
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
  for (const key of allKeys) {
    if (JSON.stringify(oldObj[key]) !== JSON.stringify(newObj[key])) {
      diff[key] = newObj[key];
    }
  }
  return diff;
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Error classes
  VersionConflictError,
  InvalidPhaseTransitionError,
  UnauthorisedError,
  // Phase helpers
  nextPhase,
  isValidPhase,
  PHASES,
  // Mutation helpers
  mergeStateChanges,
  appendEvent,
  shallowDiff,
  ALLOWED_UPDATE_KEYS,
};
