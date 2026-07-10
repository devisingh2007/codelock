const mongoose = require("mongoose");

const GameEventSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
    trim: true,
    uppercase: true,
  },
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("GameEvent", GameEventSchema);
