const { validationResult } = require("express-validator");
const gameService = require("../services/gameService");
const gameStateService = require("../services/gameStateService");
const { generateMystery } = require("../services/ai/mysteryGenerator");
const { validateMystery } = require("../utils/mysteryValidator");
const { io } = require("../sockets/gameSocket");
const aiConfig = require("../config/ai");
const { getLocationHints } = require("../config/scenarios");

// ─── Per-room endpoint rate limiter ───────────────────────────────────────────
// Uses a sliding-window (1 minute) approach stored in-memory.
// Map<roomCode, number[]>  – each entry is an array of request timestamps (ms).
const roomRateLimitMap = new Map();

/**
 * Per-minute rate limit for /generate-mystery per room.
 * Reads AI_RATE_LIMIT_PER_MINUTE; falls back to aiConfig or 6.
 */
const ROOM_RATE_LIMIT =
  parseInt(process.env.AI_RATE_LIMIT_PER_MINUTE, 10) ||
  aiConfig.rateLimitPerMin ||
  6;

/**
 * Returns true if the room has exceeded its per-minute request quota.
 * Mutates roomRateLimitMap to track calls.
 *
 * @param {string} roomCode
 * @returns {boolean}
 */
const isRoomRateLimited = (roomCode) => {
  const now = Date.now();
  const windowStart = now - 60_000; // 1-minute rolling window

  let timestamps = roomRateLimitMap.get(roomCode) || [];
  // Prune old timestamps outside the window
  timestamps = timestamps.filter((ts) => ts >= windowStart);

  if (timestamps.length >= ROOM_RATE_LIMIT) {
    roomRateLimitMap.set(roomCode, timestamps);
    return true;
  }

  timestamps.push(now);
  roomRateLimitMap.set(roomCode, timestamps);
  return false;
};

// ─── Simple in-memory metrics ─────────────────────────────────────────────────
const metrics = {
  mysteriesGenerated: 0,
  mysteriesFailedValidation: 0,
  aiErrors: 0,
};

/** Expose read-only metrics snapshot for health/monitoring routes. */
const getMetrics = () => ({ ...metrics });


const createRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { scenario, difficulty, partySize } = req.body;
    const room = await gameService.createRoom(userId, {
      scenario,
      difficulty,
      maxPlayers: partySize ? parseInt(partySize, 10) : undefined,
    });
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

  // ── Per-room rate limit check ────────────────────────────────────────────────
  if (isRoomRateLimited(roomCode)) {
    console.warn(
      `[GameController] Rate limit exceeded for room ${roomCode} ` +
        `(limit: ${ROOM_RATE_LIMIT} req/min)`
    );
    return res.status(429).json({
      error: "Too many mystery generation requests for this room. Please wait a minute and try again.",
      retryAfterSeconds: 60,
    });
  }

  console.log(
    `[GameController] [${new Date().toISOString()}] Mystery generation requested ` +
      `| room=${roomCode} | user=${userId}`
  );

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
    // Resolve locationHints: prefer explicit body value, then map scenario key → rich description
    const scenarioKey = req.body?.scenario ?? "mansion";
    const locationHints =
      req.body?.locationHints ||
      getLocationHints(scenarioKey);

    console.log(
      `[GameController] Generating mystery for room ${roomCode} ` +
        `(${room.players.length} players) | scenario=${scenarioKey} | difficulty=${req.body?.difficulty ?? "medium"}`
    );
    const mystery = await generateMystery({
      playersCount: Math.max(room.players.length, 2), // at least 2 suspects
      difficulty: req.body?.difficulty ?? "medium",
      locationHints,
    });

    // 3. Validate (double-check — generator already validates, but be explicit)
    const validationErrors = validateMystery(mystery, Math.max(room.players.length, 2));
    if (validationErrors.length > 0) {
      metrics.mysteriesFailedValidation++;
      console.error(
        `[GameController] Validation failed for room ${roomCode}:`,
        validationErrors
      );
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

    metrics.mysteriesGenerated++;
    console.log(
      `[GameController] Story saved to GameState for room ${roomCode}. ` +
        `[Metrics] Total generated: ${metrics.mysteriesGenerated}`
    );

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
    metrics.aiErrors++;
    console.error(
      `[GameController] generateMysteryForRoom error | room=${roomCode}:`,
      error
    );
    next(error);
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
  generateMysteryForRoom,
  getMetrics, // exported for health/monitoring
  // Expose internals for testing rate limit logic
  _isRoomRateLimited: isRoomRateLimited,
  _roomRateLimitMap: roomRateLimitMap,
};
