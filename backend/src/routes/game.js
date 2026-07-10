const express = require("express");
const { body, param } = require("express-validator");
const { createRoom, joinRoom, getRoom, deleteRoom } = require("../controllers/gameController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Route validations
const roomCodeBodyValidation = [
  body("roomCode")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room code must be exactly 6 alphanumeric characters."),
];

const roomCodeParamValidation = [
  param("roomCode")
    .trim()
    .matches(/^[A-Z0-9]{6}$/i)
    .withMessage("Room code must be exactly 6 alphanumeric characters."),
];

// Routes
router.post("/create", authMiddleware, createRoom);
router.post("/join", authMiddleware, roomCodeBodyValidation, joinRoom);
router.get("/:roomCode", authMiddleware, roomCodeParamValidation, getRoom);
router.delete("/:roomCode", authMiddleware, roomCodeParamValidation, deleteRoom);

module.exports = router;
