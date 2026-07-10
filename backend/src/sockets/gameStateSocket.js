/**
 * @module gameStateSocket
 * Phase 5 Socket.IO event handlers for real-time game state synchronisation.
 *
 * Events (Client → Server):
 *   join-game-room   { roomId }           → socket joins room, receives sync-state
 *   leave-game-room  { roomId }           → socket leaves room
 *   state-update     { roomId, changes, version } → versioned state update
 *   request-advance-phase { roomId }      → host requests phase advance
 *   request-sync     { roomId }           → force-refresh state from DB
 *
 * Events (Server → Client):
 *   sync-state       { state }            → full current state (on join or restore)
 *   state-changed    { state }            → broadcast after any mutation
 *   phase-advanced   { state }            → broadcast after phase change
 *   state-error      { error }            → error notification
 *
 * @param {import('socket.io').Server} io
 */

const gameStateService = require("../services/gameStateService");
const {
  VersionConflictError,
  InvalidPhaseTransitionError,
  UnauthorisedError,
} = require("../utils/stateUtils");

/**
 * Attaches all Game State event handlers to the Socket.IO server.
 * Called once in server.js after `initSocket(httpServer)`.
 *
 * @param {import('socket.io').Server} io - The Socket.IO server instance.
 */
const gameStateSocket = (io) => {
  if (!io) {
    console.warn("[GameStateSocket] io instance is null – skipping setup.");
    return;
  }

  /**
   * Broadcasts the latest state to every socket in the room.
   * @param {string} roomId
   * @param {string} event  - Socket event name to emit.
   * @param {object} state  - Mongoose document or plain object.
   */
  const broadcast = (roomId, event, state) => {
    io.to(roomId.toUpperCase()).emit(event, { state });
  };

  // ── Re-use the existing authenticated socket namespace ────────────────────
  // gameSocket.js already applies JWT auth middleware to io.
  // We listen for connections on the same io instance.

  io.on("connection", (socket) => {
    const user = socket.user; // set by socketAuthMiddleware in gameSocket.js

    if (!user) {
      // Should never happen since middleware runs first; guard anyway.
      socket.disconnect(true);
      return;
    }

    // ── join-game-room ──────────────────────────────────────────────────────
    socket.on("join-game-room", async ({ roomId } = {}, callback) => {
      try {
        if (!roomId) {
          return callback?.({ error: "roomId is required." });
        }

        const code = roomId.toUpperCase();
        socket.join(code);
        socket.currentGameRoom = code;

        // Fetch or create the authoritative state
        const state = await gameStateService.getOrCreateState(code);

        // Send state only to this socket
        socket.emit("sync-state", { state });

        console.log(`[GameStateSocket] ${user.username} joined game room ${code}`);
        callback?.({ success: true, roomId: code });
      } catch (err) {
        console.error("[GameStateSocket] join-game-room error:", err);
        socket.emit("state-error", { error: err.message });
        callback?.({ error: err.message });
      }
    });

    // ── leave-game-room ─────────────────────────────────────────────────────
    socket.on("leave-game-room", ({ roomId } = {}, callback) => {
      const code = (roomId ?? socket.currentGameRoom)?.toUpperCase();
      if (code) {
        socket.leave(code);
        socket.currentGameRoom = null;
        console.log(`[GameStateSocket] ${user.username} left game room ${code}`);
      }
      callback?.({ success: true });
    });

    // ── state-update ────────────────────────────────────────────────────────
    socket.on("state-update", async ({ roomId, changes, version } = {}, callback) => {
      try {
        if (!roomId || changes === undefined || version === undefined) {
          return callback?.({ error: "roomId, changes, and version are required." });
        }

        const code = roomId.toUpperCase();
        const updated = await gameStateService.updateState(code, changes, version);

        // Broadcast new state to everyone in the room
        broadcast(code, "state-changed", updated);

        console.log(`[GameStateSocket] State updated in room ${code} by ${user.username}`);
        callback?.({ success: true, state: updated });
      } catch (err) {
        console.error("[GameStateSocket] state-update error:", err);

        if (err instanceof VersionConflictError) {
          socket.emit("state-error", { error: err.message, code: "VERSION_CONFLICT" });
          return callback?.({ error: err.message, code: "VERSION_CONFLICT" });
        }
        socket.emit("state-error", { error: err.message });
        callback?.({ error: err.message });
      }
    });

    // ── request-advance-phase ───────────────────────────────────────────────
    socket.on("request-advance-phase", async ({ roomId } = {}, callback) => {
      try {
        if (!roomId) {
          return callback?.({ error: "roomId is required." });
        }

        const code = roomId.toUpperCase();
        const updated = await gameStateService.advancePhase(code, user._id.toString());

        // Broadcast phase change
        broadcast(code, "phase-advanced", updated);
        broadcast(code, "state-changed", updated);

        console.log(
          `[GameStateSocket] Phase advanced in room ${code} by host ${user.username} → ${updated.phase}`
        );
        callback?.({ success: true, state: updated });
      } catch (err) {
        console.error("[GameStateSocket] request-advance-phase error:", err);

        const errorPayload = { error: err.message };
        if (err instanceof UnauthorisedError) errorPayload.code = "UNAUTHORISED";
        if (err instanceof InvalidPhaseTransitionError) errorPayload.code = "FINAL_PHASE";

        socket.emit("state-error", errorPayload);
        callback?.(errorPayload);
      }
    });

    // ── request-sync ────────────────────────────────────────────────────────
    socket.on("request-sync", async ({ roomId } = {}, callback) => {
      try {
        const code = (roomId ?? socket.currentGameRoom)?.toUpperCase();
        if (!code) {
          return callback?.({ error: "roomId is required." });
        }

        const state = await gameStateService.getOrCreateState(code);
        socket.emit("sync-state", { state });

        callback?.({ success: true });
      } catch (err) {
        console.error("[GameStateSocket] request-sync error:", err);
        socket.emit("state-error", { error: err.message });
        callback?.({ error: err.message });
      }
    });

    // ── On disconnect – auto-resync on reconnect ────────────────────────────
    socket.on("disconnect", (reason) => {
      console.log(
        `[GameStateSocket] ${user.username} disconnected (${reason}). ` +
        `Was in game room: ${socket.currentGameRoom ?? "none"}`
      );
    });
  });
};

module.exports = gameStateSocket;
