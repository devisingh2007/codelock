const express = require("express");
const { body, param } = require("express-validator");
const authMiddleware = require("../middleware/authMiddleware");
const { validateGamePhase } = require("../middleware/phaseMiddleware");
const {
  castVote,
  getVotingResults,
  startVoting,
  endVoting,
} = require("../controllers/voteController");

const router = express.Router();

const voteValidation = [
  body("roomId")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room ID must be a 6-character alphanumeric code."),
  body("accusedPlayerId")
    .isMongoId()
    .withMessage("Invalid accusedPlayerId."),
];

const roomIdParamValidation = [
  param("roomId")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room ID must be a 6-character alphanumeric code."),
];

// All routes require JWT authentication
router.post(
  "/",
  authMiddleware,
  voteValidation,
  validateGamePhase(["voting"]),
  castVote
);

router.get(
  "/:roomId/results",
  authMiddleware,
  roomIdParamValidation,
  getVotingResults
);

router.post(
  "/game/:roomId/start-voting",
  authMiddleware,
  roomIdParamValidation,
  validateGamePhase(["investigation"]),
  startVoting
);

router.post(
  "/game/:roomId/end-voting",
  authMiddleware,
  roomIdParamValidation,
  validateGamePhase(["voting"]),
  endVoting
);

module.exports = router;
