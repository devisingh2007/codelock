const GameState = require("../models/GameState");

/**
 * Middleware to validate that the game is in an allowed phase for the action.
 * Also attaches the retrieved gameState to the request object.
 *
 * @param {string[]} allowedPhases - The list of allowed game phases.
 * @returns {Function} Express middleware.
 */
const validateGamePhase = (allowedPhases) => {
  return async (req, res, next) => {
    try {
      const roomId =
        req.params.roomId ||
        req.body.roomId ||
        req.params.roomCode ||
        req.body.roomCode;

      if (!roomId) {
        return res.status(400).json({ error: "Room ID or Room Code is required." });
      }

      const gameState = await GameState.findOne({ roomId: roomId.toUpperCase() });
      if (!gameState) {
        return res.status(404).json({ error: "Game state not found." });
      }

      const GameRoom = require("../models/GameRoom");
      const room = await GameRoom.findOne({ roomCode: roomId.toUpperCase() });
      if (room && room.status === "ended") {
        return res.status(400).json({ error: "Game already completed." });
      }

      if (!allowedPhases.includes(gameState.phase)) {
        return res.status(400).json({
          error: `Action not allowed during "${gameState.phase}" phase. Required phase: ${allowedPhases.join(" or ")}.`,
        });
      }

      req.gameState = gameState;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  validateGamePhase,
};
