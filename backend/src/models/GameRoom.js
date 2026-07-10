const mongoose = require("mongoose");

const GameRoomSchema = new mongoose.Schema({
  roomCode: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    uppercase: true,
    validate: {
      validator: function (v) {
        return /^[A-Z0-9]{6}$/.test(v);
      },
      message: (props) => `${props.value} is not a valid 6-character alphanumeric room code!`,
    },
  },
  host: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  players: {
    type: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    default: [],
    validate: {
      validator: function (val) {
        return val.length <= this.maxPlayers;
      },
      message: "Players array exceeds maximum players limit.",
    },
  },
  status: {
    type: String,
    enum: ["waiting", "in_progress", "ended"],
    default: "waiting",
  },
  maxPlayers: {
    type: Number,
    default: 4,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("GameRoom", GameRoomSchema);
