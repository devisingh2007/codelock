/**
 * @module gameStateRoutes
 * Express Router for the Phase 5 Game State Engine REST API.
 * All routes require JWT authentication.
 *
 * Mounted under /api/game in server.js, so full paths are:
 *   GET  /api/game/:roomId/state
 *   POST /api/game/:roomId/state/update
 *   POST /api/game/:roomId/state/advancePhase
 *   POST /api/game/:roomId/state/restore
 */

const express = require("express");
const { param, body } = require("express-validator");
const authMiddleware = require("../middleware/authMiddleware");
const { getState, updateState, advancePhase, restoreState } = require("../controllers/gameStateController");

const router = express.Router();

/** Validates that `:roomId` is a 6-char alphanumeric room code */
const roomIdParam = param("roomId")
  .trim()
  .matches(/^[A-Z0-9]{6}$/i)
  .withMessage("roomId must be a 6-character alphanumeric room code.");

/** Validates the update body */
const updateBodyValidation = [
  body("changes")
    .isObject()
    .withMessage("'changes' must be an object."),
  body("version")
    .isInt({ min: 0 })
    .withMessage("'version' must be a non-negative integer."),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * GET /api/game/:roomId/state
 * Fetch (or auto-create) the GameState for a room.
 */
router.get("/:roomId/state", authMiddleware, roomIdParam, getState);

/**
 * POST /api/game/:roomId/state/update
 * Apply partial state update with optimistic concurrency check.
 * Body: { changes: object, version: number }
 */
router.post("/:roomId/state/update", authMiddleware, roomIdParam, updateBodyValidation, updateState);

/**
 * POST /api/game/:roomId/state/advancePhase
 * Advance the game phase. Host only.
 */
router.post("/:roomId/state/advancePhase", authMiddleware, roomIdParam, advancePhase);

/**
 * POST /api/game/:roomId/state/restore
 * Restore / resync state from DB (useful after reconnect).
 */
router.post("/:roomId/state/restore", authMiddleware, roomIdParam, restoreState);

module.exports = router;
