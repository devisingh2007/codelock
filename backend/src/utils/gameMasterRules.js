"use strict";

/**
 * @module gameMasterRules
 * Rules engine to decide when the AI Game Master should intervene in the game.
 */

/**
 * Evaluates the current game state and chat messages to determine if a GM intervention is required.
 *
 * @param {object} params
 * @param {Array<{sender: string, message: string}>} params.recentMsgs - List of recent chat messages.
 * @param {string[]} params.discoveredClues - Array of clues already discovered by players.
 * @param {number} params.timeElapsed - Time elapsed in seconds.
 * @param {object} params.story - The story details including suspects and victim.
 * @returns {{ shouldInvokeAI: boolean, triggerType: 'stuck' | 'false_accusation' | 'repeated_claims' | null, reason: string }}
 */
function decideAction({ recentMsgs = [], discoveredClues = [], timeElapsed = 0, story = {} }) {
  // 1. Repeated Claims Check
  // If a player repeats the exact same claim or message multiple times (e.g. 3 or more times recently)
  const messageCounts = {};
  for (const msg of recentMsgs) {
    if (!msg.message || !msg.sender) continue;
    const key = `${msg.sender}:${msg.message.trim().toLowerCase()}`;
    messageCounts[key] = (messageCounts[key] || 0) + 1;
    if (messageCounts[key] >= 3) {
      return {
        shouldInvokeAI: true,
        triggerType: "repeated_claims",
        reason: `Player ${msg.sender} has repeatedly claimed/stated: "${msg.message}"`,
      };
    }
  }

  // 2. False Accusation Check
  // Look for messages containing "accuse" or "murderer is" or "killer is"
  // and see if they mention a suspect name who is NOT the killer.
  const killerName = story?.crime?.killer || story?.suspects?.find(s => s.isMurderer)?.name;
  if (killerName) {
    const killerLower = killerName.toLowerCase();
    const suspectNames = (story?.suspects || []).map(s => s.name.toLowerCase());

    for (const msg of recentMsgs) {
      const textLower = (msg.message || "").toLowerCase();
      if (textLower.includes("accuse") || textLower.includes("killer is") || textLower.includes("murderer is")) {
        // Find which suspect they are accusing
        for (const suspect of suspectNames) {
          if (textLower.includes(suspect)) {
            if (suspect !== killerLower) {
              return {
                shouldInvokeAI: true,
                triggerType: "false_accusation",
                reason: `Player ${msg.sender} falsely accused ${suspect} (the actual killer is not ${suspect}).`,
              };
            }
          }
        }
      }
    }
  }

  // 3. Stuck Scenario Check
  // If time elapsed > 300 seconds and players have found very few clues, or there is no recent progress
  if (timeElapsed >= 300 && discoveredClues.length === 0) {
    return {
      shouldInvokeAI: true,
      triggerType: "stuck",
      reason: "Players are stuck in the investigation: no clues found after 5 minutes.",
    };
  }

  return {
    shouldInvokeAI: false,
    triggerType: null,
    reason: "No rules triggered for intervention.",
  };
}

module.exports = {
  decideAction,
};
