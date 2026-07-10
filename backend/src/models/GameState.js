const mongoose = require("mongoose");

const GameStateSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GameRoom",
    required: true,
  },
  story: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  playersState: [
    {
      playerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
      role: {
        type: String,
        default: "",
      },
      secret: {
        type: String,
        default: "",
      },
      clues: [
        {
          type: String,
        },
      ],
    },
  ],
  currentPhase: {
    type: String,
    default: "lobby",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameState", GameStateSchema);
