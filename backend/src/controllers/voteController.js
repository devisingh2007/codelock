const { validationResult } = require("express-validator");
const voteService = require("../services/voteService");

const castVote = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomId, accusedPlayerId } = req.body;
  const voterId = req.user.id;

  try {
    const vote = await voteService.castVote({
      roomId,
      voterId,
      accusedPlayerId,
    });
    return res.status(200).json({ success: true, vote });
  } catch (error) {
    next(error);
  }
};

const getVotingResults = async (req, res, next) => {
  const { roomId } = req.params;

  try {
    const results = await voteService.getResults(roomId);
    return res.status(200).json({ success: true, ...results });
  } catch (error) {
    next(error);
  }
};

const startVoting = async (req, res, next) => {
  const { roomId } = req.params;
  const hostId = req.user.id;

  try {
    const gameState = await voteService.startVoting(roomId, hostId);
    return res.status(200).json({ success: true, gameState });
  } catch (error) {
    next(error);
  }
};

const endVoting = async (req, res, next) => {
  const { roomId } = req.params;
  const hostId = req.user.id;

  try {
    const result = await voteService.endVoting(roomId, hostId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  castVote,
  getVotingResults,
  startVoting,
  endVoting,
};
