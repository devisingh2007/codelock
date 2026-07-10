const mongoose = require("mongoose");

const GameStateSchema = new mongoose.Schema({
  gameRoom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GameRoom",
    required: true,
  },
  status: {
    type: String,
    enum: ["waiting", "active", "completed"],
    default: "waiting",
  },
  currentTurn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  stateData: {
    type: Map,
    of: String,
    default: {},
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameState", GameStateSchema);
