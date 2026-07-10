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

  // 3. Count votes per accused player ID
  const voteCounts = {};
  for (const vote of votes) {
    const accusedId = vote.accusedPlayerId.toString();
    voteCounts[accusedId] = (voteCounts[accusedId] || 0) + 1;
  }

  // 4. Fetch User documents to get usernames
  const userIds = Object.keys(voteCounts);
  const users = await User.find({ _id: { $in: userIds } });
  const userMap = {};
  for (const user of users) {
    userMap[user._id.toString()] = user.username;
  }

  // Map vote counts to usernames for the output
  const mappedVotes = {};
  for (const [userId, count] of Object.entries(voteCounts)) {
    const username = userMap[userId] || userId;
    mappedVotes[username] = count;
  }

  // 5. Determine the winner (highest votes) and check tie conditions
  let highestVotes = -1;
  let winnerId = null;
  let isTie = false;
  let tiedCandidates = [];

  for (const [userId, count] of Object.entries(voteCounts)) {
    if (count > highestVotes) {
      highestVotes = count;
      winnerId = userId;
      isTie = false;
      tiedCandidates = [userId];
    } else if (count === highestVotes) {
      isTie = true;
      tiedCandidates.push(userId);
    }
  }

  const winnerUsername = isTie ? null : (userMap[winnerId] || winnerId);

  // 6. Compare with actual murderer
  // The murderer name can be mapped to either username or a name in suspects.
  // Let's check how the murderer name is stored.
  // story.crime.killer is suspect name or username.
  const actualMurderer = gameState.story?.crime?.killer || "Unknown";

  // Check if winner username (or suspect name matching player) is the killer
  // We can look up the user object for the winner and check if their username matches the actual murderer (case-insensitive).
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
    votes: mappedVotes,
    isTie,
    winner: winnerUsername,
    voteCount: highestVotes,
  };
};

module.exports = {
  resolveGame,
};
