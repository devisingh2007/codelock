const mongoose = require("mongoose");

const GameRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  players: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameRoom", GameRoomSchema);
