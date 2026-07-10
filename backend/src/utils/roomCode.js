const GameRoom = require("../models/GameRoom");

/**
 * Generates a random alphanumeric code of a given length.
 * @param {number} length 
 * @returns {string}
 */
const generateRandomCode = (length) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Generates a unique room code, checking for collisions against the database.
 * Retries up to 5 times.
 * @param {number} length 
 * @returns {Promise<string>}
 */
const generateRoomCode = async (length = 6) => {
  const maxRetries = 5;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const code = generateRandomCode(length);
    const existingRoom = await GameRoom.findOne({ roomCode: code });
    if (!existingRoom) {
      return code;
    }
  }
  throw new Error("Failed to generate a unique room code after maximum attempts.");
};

module.exports = {
  generateRoomCode,
};
