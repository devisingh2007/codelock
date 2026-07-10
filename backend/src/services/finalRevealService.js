"use strict";

const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const InvestigationAction = require("../models/InvestigationAction");
const GameEvent = require("../models/GameEvent");
const gameResolutionService = require("./gameResolutionService");
const ollamaService = require("./ai/ollamaService");
const gameSocket = require("../sockets/gameSocket");

/**
 * Transforms stored facts into a natural language explanation using Ollama AI.
 * Falls back to a deterministic template if Ollama fails.
 */
async function generateFinalExplanation({ story, accused, actualMurderer, correct, votes, discoveredClues }) {
  const prompt = `You are the AI Game Master for a multiplayer murder-mystery game.
Please formulate a dramatic final story resolution based strictly on the facts below. Do NOT invent new facts, suspects, clues, or actions.

Game Details:
- Title: ${story.title}
- Location: ${story.location}
- Victim: ${story.victim?.name} (${story.victim?.description})
- Crime details: ${story.crime?.type} with weapon "${story.crime?.weapon}". Summary: ${story.crime?.summary}
- Discovered Clues: ${JSON.stringify(discoveredClues)}
- Chosen Accused suspect: ${accused}
- Actual Murderer suspect: ${actualMurderer}
- Verdict: ${correct ? "CORRECT. The players successfully accused the murderer." : "INCORRECT. The players accused the wrong suspect, and the murderer escaped."}
- Vote Distribution: ${JSON.stringify(votes)}

Format your response as a JSON object containing:
{
  "explanation": "A concise explanation of why the murderer was identified or missed, summarizing how the crime went down based strictly on the clues.",
  "narrative": "A dramatic and suspenseful narrative concluding the mystery."
}
Provide ONLY the raw JSON block without markdown code blocks.`;

  try {
    const responseText = await ollamaService.sendPrompt(prompt);
    let cleaned = responseText.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
    }
    const startIdx = cleaned.indexOf("{");
    const endIdx = cleaned.lastIndexOf("}");
    if (startIdx !== -1 && endIdx > startIdx) {
      cleaned = cleaned.substring(startIdx, endIdx + 1);
    }
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("[FinalRevealService] Ollama explanation generation failed, using fallback:", err.message);
    const outcomeText = correct
      ? `The investigators carefully examined the evidence: ${discoveredClues.join(", ")}. They correctly deduced that ${actualMurderer} was the culprit behind the ${story.crime?.type} of ${story.victim?.name}.`
      : `Despite discovering clues such as ${discoveredClues.join(", ")}, the investigators were misled and accused ${accused}. This allowed ${actualMurderer} to escape justice.`;

    return {
      explanation: `The players voted for ${accused}. ${outcomeText}`,
      narrative: `The dark corridors of the ${story.location} fell silent. The case of '${story.title}' was officially resolved with a verdict of ${correct ? "SUCCESS" : "FAILURE"}.`,
    };
  }
}

/**
 * Finalizes the game: determines results, generates AI reveal, marks completed, emits socket events.
 */
async function finalizeGame(roomCode, hostId) {
  const code = roomCode.toUpperCase();

  console.log(`[FinalRevealService] Starting finalizeGame for room ${code} by host ${hostId}`);

  // 1. Load the room
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    console.log(`[FinalRevealService] Room ${code} not found`);
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }

  // 2. Authorize host
  if (room.host.toString() !== hostId.toString()) {
    console.log(`[FinalRevealService] Host mismatch. Room host: ${room.host}, caller: ${hostId}`);
    const error = new Error("Unauthorized: Only the host can finalize the game.");
    error.status = 403;
    throw error;
  }

  // 3. Load GameState
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    console.log(`[FinalRevealService] GameState for room ${code} not found`);
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  // 4. Verify not already completed
  if (room.status === "ended") {
    console.log(`[FinalRevealService] Game already completed for room ${code}`);
    const error = new Error("Game already completed.");
    error.status = 400;
    throw error;
  }

  console.log(`[FinalRevealService] Loaded game and state for room ${code}. Resolving votes...`);

  // 5. Load voting results
  const results = await gameResolutionService.resolveGame(code);
  const { accused, actualMurderer, correct, votes } = results;

  console.log(`[FinalRevealService] Voting resolved. Accused: ${accused}, Killer: ${actualMurderer}`);

  // 6. Gather investigation details
  const investigationCount = await InvestigationAction.countDocuments({ roomId: code });
  const discoveredCluesDocs = await InvestigationAction.find({ roomId: code, actionType: "INSPECT_CLUE" });
  const discoveredClues = Array.from(new Set(discoveredCluesDocs.map(c => c.target)));
  const historyEvents = await GameEvent.find({ roomId: code }).sort({ timestamp: 1 });

  // 7. Call AI explanation
  console.log(`[FinalRevealService] Requesting AI explanation...`);
  const aiResult = await generateFinalExplanation({
    story: gameState.story,
    accused,
    actualMurderer,
    correct,
    votes,
    discoveredClues,
  });

  console.log(`[FinalRevealService] AI explanation received: ${JSON.stringify(aiResult)}`);

  // 8. Prepare finalReveal payload
  const finalReveal = {
    roomId: code,
    gameId: gameState._id,
    winnerStatus: correct ? "detectives_won" : "murderer_escaped",
    actualMurderer,
    chosenAccused: accused,
    correctVerdict: correct,
    voteSummary: votes,
    keyCluesUsed: discoveredClues,
    importantInvestigationActions: historyEvents
      .filter(e => e.eventType.startsWith("INVESTIGATION_"))
      .map(e => ({ actionType: e.eventType, target: e.data?.target })),
    explanation: aiResult.explanation,
    narrative: aiResult.narrative,
  };

  // 9. Prepare summary payload
  const summary = {
    totalPlayers: room.players.length,
    votesCast: votes ? Object.values(votes).reduce((a, b) => a + b, 0) : 0,
    topVotedSuspect: accused,
    correctVerdict: correct,
    numberOfInvestigationActions: investigationCount,
    keyEvidenceDiscovered: discoveredClues,
    finalGameDuration: Math.floor((Date.now() - new Date(gameState.createdAt).getTime()) / 1000),
    finalStatus: "completed",
  };

  // 10. Update GameState
  gameState.finalVerdict = correct ? "correct" : "incorrect";
  gameState.winner = correct ? "detectives" : "murderer";
  gameState.completedAt = new Date();
  gameState.finalReveal = finalReveal;
  gameState.summary = summary;
  gameState.resolutionStatus = "resolved";
  gameState.phase = "reveal";
  gameState.eventsLog.push({
    event: "Game finalized and completed.",
    timestamp: new Date(),
  });
  gameState.lastUpdated = new Date();
  await gameState.save();

  // 11. Update GameRoom
  room.status = "ended";
  await room.save();

  // 12. Record GameEvent
  await GameEvent.create({
    roomId: code,
    eventType: "GAME_COMPLETED",
    data: { finalReveal, summary },
  });

  // 13. Emit Socket.IO events to all players
  gameSocket.io.to(code).emit("game:completed", { roomId: code, summary });
  gameSocket.io.to(code).emit("game:finalReveal", { roomId: code, finalReveal });
  gameSocket.io.to(code).emit("state-changed", { roomId: code, gameState });

  return { finalReveal, summary };
}

/**
 * Gets the final reveal data for a room.
 */
async function getFinalReveal(roomCode, userId) {
  const code = roomCode.toUpperCase();
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }
  if (!room.players.map(p => p.toString()).includes(userId.toString())) {
    const error = new Error("Access denied: You are not a member of this room.");
    error.status = 403;
    throw error;
  }

  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState || !gameState.finalReveal) {
    const error = new Error("Final reveal data not found or game is not completed.");
    error.status = 400;
    throw error;
  }

  return gameState.finalReveal;
}

/**
 * Gets the final summary data for a room.
 */
async function getSummary(roomCode, userId) {
  const code = roomCode.toUpperCase();
  const room = await GameRoom.findOne({ roomCode: code });
  if (!room) {
    const error = new Error("Room not found.");
    error.status = 404;
    throw error;
  }
  if (!room.players.map(p => p.toString()).includes(userId.toString())) {
    const error = new Error("Access denied: You are not a member of this room.");
    error.status = 403;
    throw error;
  }

  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState || !gameState.summary) {
    const error = new Error("Summary data not found or game is not completed.");
    error.status = 400;
    throw error;
  }

  return gameState.summary;
}

module.exports = {
  finalizeGame,
  getFinalReveal,
  getSummary,
  generateFinalExplanation,
};
