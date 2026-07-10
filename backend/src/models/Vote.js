const mongoose = require("mongoose");

const VoteSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  voterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  accusedPlayerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  roundNumber: {
    type: Number,
    required: true,
    default: 1,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Unique protection: One vote per player per round in a room
VoteSchema.index({ roomId: 1, voterId: 1, roundNumber: 1 }, { unique: true });

module.exports = mongoose.model("Vote", VoteSchema);
