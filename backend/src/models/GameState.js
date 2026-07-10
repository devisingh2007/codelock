const mongoose = require("mongoose");

/** TTL in seconds – default 7 days */
const STATE_TTL_SECONDS =
  parseInt(process.env.GAME_STATE_TTL_SECONDS, 10) || 7 * 24 * 60 * 60;

/** Valid game phases in order */
const PHASES = ["lobby", "investigation", "voting", "reveal"];

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const TimelineEventSchema = new mongoose.Schema(
  {
    time: { type: String, required: true },
    event: { type: String, required: true },
  },
  { _id: false }
);

const StorySchema = new mongoose.Schema(
  {
    victim: { type: String, default: "" },
    murderer: { type: String, default: "" },
    location: { type: String, default: "" },
    timeline: { type: [TimelineEventSchema], default: [] },
    clues: { type: [String], default: [] },
  },
  { _id: false }
);

const PlayerStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: { type: String, default: "detective" },
    secrets: { type: [String], default: [] },
    cluesFound: { type: [String], default: [] },
  },
  { _id: false }
);

const EventLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    event: { type: String, required: true },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

/**
 * GameState – authoritative server-side game state for a single room.
 * Uses optimisticConcurrency so that __v (versionKey) is bumped on every
 * save and can be used for conflict detection.
 */
const GameStateSchema = new mongoose.Schema(
  {
    /**
     * Reference to the GameRoom this state belongs to.
     * Using String so callers can pass roomCode without a lookup.
     */
    roomId: {
      type: String,
      required: [true, "roomId is required"],
      index: true,
      trim: true,
      uppercase: true,
    },

    /** Current game phase */
    phase: {
      type: String,
      enum: { values: PHASES, message: "{VALUE} is not a valid phase" },
      default: "lobby",
    },

    /** Per-player state */
    players: { type: [PlayerStateSchema], default: [] },

    /** Story payload (set during investigation phase) */
    story: { type: StorySchema, default: () => ({}) },

    /** Append-only log of significant events */
    eventsLog: { type: [EventLogSchema], default: [] },

    /** Touched on every mutation – used for TTL */
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    /**
     * optimisticConcurrency: true  – Mongoose will reject a save/update
     * if __v in the DB differs from __v in the document being saved.
     */
    optimisticConcurrency: true,
    timestamps: true, // adds createdAt + updatedAt
    versionKey: "__v",
  }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

/** TTL index: MongoDB will auto-delete documents STATE_TTL_SECONDS after lastUpdated */
GameStateSchema.index(
  { lastUpdated: 1 },
  { expireAfterSeconds: STATE_TTL_SECONDS, name: "gamestate_ttl" }
);

// ─── Statics ──────────────────────────────────────────────────────────────────

/**
 * Returns the ordered phase array for external consumers.
 * @returns {string[]}
 */
GameStateSchema.statics.phases = () => PHASES;

/**
 * Returns the next phase after `currentPhase`, or null if already at end.
 * @param {string} currentPhase
 * @returns {string|null}
 */
GameStateSchema.statics.nextPhase = (currentPhase) => {
  const idx = PHASES.indexOf(currentPhase);
  if (idx === -1 || idx === PHASES.length - 1) return null;
  return PHASES[idx + 1];
};

module.exports = mongoose.model("GameState", GameStateSchema);
module.exports.PHASES = PHASES;
