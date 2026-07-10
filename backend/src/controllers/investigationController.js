const { validationResult } = require("express-validator");
const investigationService = require("../services/investigationService");

const createInvestigationAction = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomId, actionType, target, message, metadata } = req.body;
  const playerId = req.user.id;

  try {
    const result = await investigationService.createAction({
      roomId,
      playerId,
      actionType,
      target,
      message,
      metadata,
    });
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const getInvestigationHistory = async (req, res, next) => {
  const { roomId } = req.params;

  try {
    const history = await investigationService.getHistory(roomId);
    return res.status(200).json({ success: true, history });
  } catch (error) {
    next(error);
  }
};

const getInvestigationEvidence = async (req, res, next) => {
  const { roomId } = req.params;

  try {
    const evidence = await investigationService.getEvidence(roomId);
    return res.status(200).json({ success: true, ...evidence });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createInvestigationAction,
  getInvestigationHistory,
  getInvestigationEvidence,
};
