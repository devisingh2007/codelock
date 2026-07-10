"use strict";

const { validationResult } = require("express-validator");
const finalRevealService = require("../services/finalRevealService");

const finalizeGame = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;
  const hostId = req.user.id;

  try {
    const result = await finalRevealService.finalizeGame(roomCode, hostId);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const getFinalReveal = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;
  const userId = req.user.id;

  try {
    const finalReveal = await finalRevealService.getFinalReveal(roomCode, userId);
    return res.status(200).json({ success: true, finalReveal });
  } catch (error) {
    next(error);
  }
};

const getSummary = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;
  const userId = req.user.id;

  try {
    const summary = await finalRevealService.getSummary(roomCode, userId);
    return res.status(200).json({ success: true, summary });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  finalizeGame,
  getFinalReveal,
  getSummary,
};
