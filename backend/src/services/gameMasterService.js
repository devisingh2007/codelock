"use strict";

/**
 * @module gameMasterService
 * Orchestrates the AI Game Master (GM) rule evaluation, AI call invocation, state updates, and socket broadcasting.
 */

const GameState = require("../models/GameState");
const ChatMessage = require("../models/ChatMessage");
const gameMasterRules = require("../utils/gameMasterRules");
const gameMasterAgent = require("./ai/gameMasterAgent");
const aiConfig = require("../config/ai");
const { io } = require("../sockets/gameSocket");

/**
 * Processes a new chat message in a room, evaluates GM rules, and executes AI interventions.
 *
 * @param {string} roomCode - The 6-character unique room code.
 * @param {object} newMsg - The newly received chat message.
 * @returns {Promise<void>}
 */
async function processMessage(roomCode, newMsg) {
  try {
    const code = roomCode.toUpperCase();

    // 1. Fetch current GameState
    const gameState = await GameState.findOne({ roomId: code });
    if (!gameState) {
      console.warn(`[GameMasterService] No GameState found for room ${code}`);
      return;
    }

    // 2. Fetch recent messages for context (e.g., last 10 messages)
    const dbMsgs = await ChatMessage.find({ roomCode: code })
      .sort({ timestamp: -1 })
      .limit(10)
      .exec();
    
    // Reverse to chronological order
    dbMsgs.reverse();

    const recentMsgs = dbMsgs.map((m) => ({
      sender: m.senderUsername,
      message: m.message,
    }));

    // 3. Gather discovered clues
    const discoveredClues = gameState.players.reduce(
      (acc, p) => acc.concat(p.cluesFound || []),
      []
    );

    // 4. Calculate elapsed time since mystery generation
    const baseTime =
      gameState.story?.generatedAt || gameState.createdAt || new Date();
    const timeElapsed = Math.floor(
      (Date.now() - new Date(baseTime).getTime()) / 1000
    );

    // 5. Evaluate rules
    const decision = gameMasterRules.decideAction({
      recentMsgs,
      discoveredClues,
      timeElapsed,
      story: gameState.story,
    });

    console.log(
      `[GameMasterRules] Room ${code}: timeElapsed=${timeElapsed}s, decision=${JSON.stringify(
        decision
      )}`
    );

    if (!decision.shouldInvokeAI) {
      return;
    }

    // 6. Enforce Rate Limiting (GM_MAX_CALLS_PER_MIN)
    const oneMinuteAgo = new Date(Date.now() - 60_000);
    const recentGMCalls = (gameState.story?.gmHistory || []).filter(
      (h) => new Date(h.timestamp) > oneMinuteAgo
    );

    if (recentGMCalls.length >= aiConfig.gmMaxCallsPerMin) {
      console.warn(
        `[GameMasterService] Rate limit hit for room ${code}: ` +
          `${recentGMCalls.length} GM calls in last minute. Max is ${aiConfig.gmMaxCallsPerMin}. Skipping.`
      );
      return;
    }

    // 7. Invoke AI Game Master Agent
    console.log(
      `[GameMasterService] Invoking AI Game Master for room ${code}. Reason: ${decision.reason}`
    );
    let action;
    try {
      action = await gameMasterAgent.generateGMAction({
        triggerType: decision.triggerType,
        reason: decision.reason,
        story: gameState.story,
        recentMsgs,
      });
    } catch (aiErr) {
      console.error(
        `[GameMasterService] AI generation error in room ${code}: ${aiErr.message}`
      );
      return;
    }

    // 8. Update GameState
    // Push the action to gmHistory & pendingActions on story
    if (!gameState.story.gmHistory) gameState.story.gmHistory = [];
    if (!gameState.story.pendingActions) gameState.story.pendingActions = [];

    gameState.story.gmHistory.push({
      actionType: action.actionType,
      content: action.content,
      timestamp: new Date(),
    });

    gameState.story.pendingActions.push({
      actionType: action.actionType,
      payload: action.payload || {},
      createdAt: new Date(),
    });

    gameState.lastUpdated = new Date();
    await gameState.save();

    console.log(
      `[GameMasterService] Saved GM action (${action.actionType}) to state in room ${code}`
    );

    // 9. Dispatch via Socket.IO
    const payload = {
      roomCode: code,
      actionType: action.actionType,
      content: action.content,
      recipient: action.recipient || "all",
      payload: action.payload || {},
    };

    io.to(code).emit("gm-action", payload);

    if (action.actionType === "hint") {
      io.to(code).emit("gm-hint", {
        roomCode: code,
        content: action.content,
        recipient: action.recipient || "all",
        payload: action.payload || {},
      });
    } else if (action.actionType === "event") {
      io.to(code).emit("gm-event", {
        roomCode: code,
        content: action.content,
        recipient: action.recipient || "all",
        payload: action.payload || {},
      });
    }

  } catch (err) {
    console.error(`[GameMasterService] Unexpected error in processMessage:`, err);
  }
}

module.exports = {
  processMessage,
};
