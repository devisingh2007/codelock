/**
 * @module gameStateController
 * Express controller functions for the Phase 5 Game State Engine REST API.
 * All handlers delegate business logic to gameStateService.
 */

const { validationResult } = require("express-validator");
const gameStateService = require("../services/gameStateService");
const { VersionConflictError, InvalidPhaseTransitionError, UnauthorisedError } = require("../utils/stateUtils");

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Normalises a caught error into an HTTP response.
 * @param {Error} err
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const handleError = (err, res, next) => {
  const knownCodes = {
    VersionConflictError: 409,
    InvalidPhaseTransitionError: 400,
    UnauthorisedError: 403,
  };
  const status = knownCodes[err.name] ?? err.statusCode ?? 500;

  if (status >= 500) {
    // Let the centralised Express error handler deal with unknown errors
    return next(err);
  }
  return res.status(status).json({ status: "error", error: err.message });
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/game/:roomId/state
 * Retrieves (or creates) the current GameState for a room.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getState = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: "error", error: errors.array()[0].msg });
    }

    const { roomId } = req.params;
    const state = await gameStateService.getOrCreateState(roomId);
    return res.status(200).json({ status: "ok", data: state });
  } catch (err) {
    return handleError(err, res, next);
  }
};

/**
 * POST /api/game/:roomId/state/update
 * Applies a partial update with optimistic concurrency.
 *
 * Request body:
 * ```json
 * {
 *   "changes": { "story": {...}, "eventsLog": [...] },
 *   "version": 3
 * }
 * ```
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const updateState = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: "error", error: errors.array()[0].msg });
    }

    const { roomId } = req.params;
    const { changes, version } = req.body;

    if (changes === undefined || version === undefined) {
      return res.status(400).json({
        status: "error",
        error: "Request body must include 'changes' (object) and 'version' (number).",
      });
    }

    if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
      return res.status(400).json({
        status: "error",
        error: "'version' must be a non-negative integer.",
      });
    }

    const updated = await gameStateService.updateState(roomId, changes, version);
    return res.status(200).json({ status: "ok", data: updated });
  } catch (err) {
    if (err instanceof VersionConflictError) {
      return res.status(409).json({ status: "conflict", error: err.message });
    }
    return handleError(err, res, next);
  }
};

/**
 * POST /api/game/:roomId/state/advancePhase
 * Advances the game phase to the next stage.
 * Only the room host is authorised to call this.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const advancePhase = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ status: "error", error: errors.array()[0].msg });
    }

    const { roomId } = req.params;
    const requestingUserId = req.user?.id;

    if (!requestingUserId) {
      return res.status(401).json({ status: "error", error: "Unauthenticated." });
    }

    const updated = await gameStateService.advancePhase(roomId, requestingUserId);
    return res.status(200).json({ status: "ok", data: updated });
  } catch (err) {
    if (err instanceof UnauthorisedError) {
      return res.status(403).json({ status: "error", error: err.message });
    }
    if (err instanceof InvalidPhaseTransitionError) {
      return res.status(400).json({ status: "error", error: err.message });
    }
    return handleError(err, res, next);
  }
};

/**
 * POST /api/game/:roomId/state/restore
 * Re-reads and returns the authoritative state from the DB.
 * Used by clients after reconnection or server restart.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const restoreState = async (req, res, next) => {
  try {
    const { roomId } = req.params;
    const state = await gameStateService.restoreState(roomId);
    return res.status(200).json({ status: "ok", data: state });
  } catch (err) {
    return handleError(err, res, next);
  }
};

module.exports = { getState, updateState, advancePhase, restoreState };
