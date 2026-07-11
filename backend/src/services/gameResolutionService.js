const GameRoom = require("../models/GameRoom");
const GameState = require("../models/GameState");
const User = require("../models/User");
const Vote = require("../models/Vote");

/**
 * Calculates the final voting result, compares with the murderer, and prepares
 * the structured game resolution.
 *
 * @param {string} roomId - The 6-character room code.
 * @returns {Promise<object>} The resolved game output.
 */
const resolveGame = async (roomId) => {
  const code = roomId.toUpperCase();

  // 1. Fetch the GameState
  const gameState = await GameState.findOne({ roomId: code });
  if (!gameState) {
    const error = new Error("Game state not found.");
    error.status = 404;
    throw error;
  }

  // 2. Fetch all votes for the current room
  const votes = await Vote.find({ roomId: code });
  if (votes.length === 0) {
    return {
      accused: "None",
      actualMurderer: gameState.story?.crime?.killer || "Unknown",
      correct: false,
      votes: {},
      isTie: true,
      winner: null,
      voteCount: 0,
    };
  }

  // 3. Count votes per accused player ID (which is now the suspect name)
  const voteCounts = {};
  for (const vote of votes) {
    const accusedId = vote.accusedPlayerId;
    voteCounts[accusedId] = (voteCounts[accusedId] || 0) + 1;
  }

  // 4. Determine the winner (highest votes) and check tie conditions
  let highestVotes = -1;
  let winnerId = null;
  let isTie = false;

  for (const [suspectName, count] of Object.entries(voteCounts)) {
    if (count > highestVotes) {
      highestVotes = count;
      winnerId = suspectName;
      isTie = false;
    } else if (count === highestVotes) {
      isTie = true;
    }
  }

  const winnerUsername = isTie ? null : winnerId;
  const actualMurderer = gameState.story?.crime?.killer || "Unknown";

  let correct = false;
  if (winnerUsername) {
    if (winnerUsername.toLowerCase() === actualMurderer.toLowerCase()) {
      correct = true;
    }
  }

  return {
    accused: winnerUsername || "Tie / None",
    actualMurderer,
    correct,
    votes: voteCounts,
    isTie,
    winner: winnerUsername,
    voteCount: highestVotes,
  };
};

module.exports = {
  resolveGame,
};
