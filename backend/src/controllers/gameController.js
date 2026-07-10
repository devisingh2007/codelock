const { validationResult } = require("express-validator");
const gameService = require("../services/gameService");
const gameStateService = require("../services/gameStateService");
const { generateMystery } = require("../services/ai/mysteryGenerator");
const { validateMystery } = require("../utils/mysteryValidator");
const { io } = require("../sockets/gameSocket");

const createRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const room = await gameService.createRoom(userId);
    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

const joinRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.body;
  const playerId = req.user.id;

  try {
    const room = await gameService.joinRoom(roomCode, playerId);
    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

const getRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;

  try {
    const room = await gameService.getRoom(roomCode);
    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

const deleteRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;
  const userId = req.user.id;

  try {
    await gameService.deleteRoom(roomCode, userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/game/:roomCode/generate-mystery
 * Host-only endpoint that:
 *  1. Verifies the caller is the room host.
 *  2. Calls the Ollama AI to generate a mystery scenario.
 *  3. Validates the AI output.
 *  4. Saves the story into the GameState for the room.
 *  5. Emits a `mystery-generated` Socket.IO event to all room members.
 *  6. Returns 200 with the saved story.
 */
const generateMysteryForRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;
  const userId = req.user?.id;

  try {
    // 1. Load the room and verify host
    const room = await gameService.getRoom(roomCode);
    if (!room) {
      return res.status(404).json({ error: `Room "${roomCode}" not found.` });
    }
    if (room.host.toString() !== userId.toString()) {
      return res.status(403).json({ error: "Only the room host can generate a mystery." });
    }

    // 2. Generate mystery via Ollama AI
    console.log(`[GameController] Generating mystery for room ${roomCode} (${room.players.length} players)…`);
    const mystery = await generateMystery({
      playersCount: Math.max(room.players.length, 2), // at least 2 suspects
      difficulty: req.body?.difficulty ?? "medium",
      locationHints: req.body?.locationHints ?? "",
    });

    // 3. Validate (double-check — generator already validates, but be explicit)
    const validationErrors = validateMystery(mystery, Math.max(room.players.length, 2));
    if (validationErrors.length > 0) {
      return res.status(500).json({
        error: "AI generated an invalid mystery structure.",
        details: validationErrors,
      });
    }

    // 4. Save story into GameState
    const storyPayload = { ...mystery, generatedAt: new Date() };
    const gameState = await gameStateService.getOrCreateState(roomCode);
    gameState.story = storyPayload;
    gameState.lastUpdated = new Date();
    await gameState.save();
    console.log(`[GameController] Story saved to GameState for room ${roomCode}.`);

    // 5. Emit Socket.IO event to all room members
    try {
      io.to(roomCode).emit("mystery-generated", { roomCode, story: storyPayload });
      console.log(`[GameController] Emitted mystery-generated to room ${roomCode}.`);
    } catch (socketErr) {
      // Non-fatal: log but don't fail the HTTP response
      console.warn(`[GameController] Socket emit failed: ${socketErr.message}`);
    }

    // 6. Respond
    return res.status(200).json({ success: true, story: storyPayload });
  } catch (error) {
    console.error(`[GameController] generateMysteryForRoom error:`, error);
    next(error);
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
  generateMysteryForRoom,
};
