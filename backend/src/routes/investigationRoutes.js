const express = require("express");
const { body, param } = require("express-validator");
const authMiddleware = require("../middleware/authMiddleware");
const { validateGamePhase } = require("../middleware/phaseMiddleware");
const {
  createInvestigationAction,
  getInvestigationHistory,
  getInvestigationEvidence,
} = require("../controllers/investigationController");

const router = express.Router();

const actionValidation = [
  body("roomId")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room ID must be a 6-character alphanumeric code."),
  body("actionType")
    .isIn(["ASK_QUESTION", "INSPECT_LOCATION", "INSPECT_CLUE", "ACCUSE_PLAYER"])
    .withMessage("Invalid actionType."),
  body("target")
    .notEmpty()
    .withMessage("Target is required."),
];

const roomIdParamValidation = [
  param("roomId")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room ID must be a 6-character alphanumeric code."),
];

// All routes require JWT authentication
router.post(
  "/action",
  authMiddleware,
  actionValidation,
  validateGamePhase(["investigation"]),
  createInvestigationAction
);

router.get(
  "/:roomId/history",
  authMiddleware,
  roomIdParamValidation,
  getInvestigationHistory
);

router.get(
  "/:roomId/evidence",
  authMiddleware,
  roomIdParamValidation,
  getInvestigationEvidence
);

module.exports = router;
