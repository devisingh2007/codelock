const mongoose = require("mongoose");

const InvestigationActionSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
    trim: true,
    uppercase: true,
  },
  playerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  actionType: {
    type: String,
    enum: ["ASK_QUESTION", "INSPECT_LOCATION", "INSPECT_CLUE", "ACCUSE_PLAYER"],
    required: true,
  },
  target: {
    type: String,
    required: true,
  },
  message: {
    type: String,
    default: "",
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

module.exports = mongoose.model("InvestigationAction", InvestigationActionSchema);
