const express = require("express");
const { body, param } = require("express-validator");
const { createRoom, joinRoom, getRoom, deleteRoom, generateMysteryForRoom } = require("../controllers/gameController");
const { finalizeGame, getFinalReveal, getSummary } = require("../controllers/finalRevealController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Route validations
const roomCodeBodyValidation = [
  body("roomCode")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room code must be exactly 6 alphanumeric characters."),
];

const roomCodeParamValidation = [
  param("roomCode")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room code must be exactly 6 alphanumeric characters."),
];

// Routes
router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, roomCodeBodyValidation, joinRoom);
router.get("/:roomCode", authMiddleware, roomCodeParamValidation, getRoom);
router.delete("/:roomCode", authMiddleware, roomCodeParamValidation, deleteRoom);

/**
 * POST /api/game/:roomCode/generate-mystery
 * Body (optional): { difficulty?: 'easy'|'medium'|'hard', locationHints?: string }
 * Requires: Authorization: Bearer <host_jwt>
 */
router.post(
  "/:roomCode/generate-mystery",
  authMiddleware,
  roomCodeParamValidation,
  generateMysteryForRoom
);

// Phase 10: Final Reveal, Summary & Game Completion Routes
router.post(
  "/:roomCode/finalize",
  authMiddleware,
  roomCodeParamValidation,
  finalizeGame
);

router.get(
  "/:roomCode/final-reveal",
  authMiddleware,
  roomCodeParamValidation,
  getFinalReveal
);

router.get(
  "/:roomCode/summary",
  authMiddleware,
  roomCodeParamValidation,
  getSummary
);

module.exports = router;
