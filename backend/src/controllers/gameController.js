const { validationResult } = require("express-validator");
const gameService = require("../services/gameService");

const createRoom = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const room = await gameService.createRoom(userId);
    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

const joinRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.body;
  const playerId = req.user.id;

  try {
    const room = await gameService.joinRoom(roomCode, playerId);
    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

const getRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;

  try {
    const room = await gameService.getRoom(roomCode);
    return res.status(200).json({ success: true, room });
  } catch (error) {
    next(error);
  }
};

const deleteRoom = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }

  const { roomCode } = req.params;
  const userId = req.user.id;

  try {
    await gameService.deleteRoom(roomCode, userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
};
