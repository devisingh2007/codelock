const mongoose = require("mongoose");

/** TTL in seconds – default 7 days */
const STATE_TTL_SECONDS =
  parseInt(process.env.GAME_STATE_TTL_SECONDS, 10) || 7 * 24 * 60 * 60;

/** Valid game phases in order */
const PHASES = ["lobby", "roles-assigned", "investigation", "voting", "reveal"];

// ─── Phase 6 AI Mystery Sub-schemas ─────────────────────────────────────────

const TimelineEventSchema = new mongoose.Schema(
  {
    time: { type: String, required: true },
    event: { type: String, required: true },
  },
  { _id: false }
);

/** Victim sub-document */
const VictimSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    description: { type: String, default: "" },
  },
  { _id: false }
);

/** Crime details sub-document */
const CrimeSchema = new mongoose.Schema(
  {
    type: { type: String, default: "" },
    weapon: { type: String, default: "" },
    summary: { type: String, default: "" },
    /** Name of the murderer (matches a suspect.name) */
    killer: { type: String, default: "" },
  },
  { _id: false }
);

/** Per-suspect sub-document */
const SuspectSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    background: { type: String, default: "" },
    relationshipToVictim: { type: String, default: "" },
    /** True for exactly one suspect – the murderer */
    isMurderer: { type: Boolean, default: false },
  },
  { _id: false }
);

const GMHistoryEventSchema = new mongoose.Schema(
  {
    actionType: { type: String, required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PendingActionSchema = new mongoose.Schema(
  {
    actionType: { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

/**
 * Full AI-generated mystery story.
 * All fields are optional/defaulted for backward compatibility with
 * pre-Phase-6 game states that used the old minimal story shape.
 */
const StorySchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    location: { type: String, default: "" },
    victim: { type: VictimSchema, default: () => ({}) },
    crime: { type: CrimeSchema, default: () => ({}) },
    suspects: { type: [SuspectSchema], default: [] },
    timeline: { type: [TimelineEventSchema], default: [] },
    clues: { type: [String], default: [] },
    /** ISO timestamp when the mystery was generated */
    generatedAt: { type: Date, default: null },
    /** AI Game Master logs and pending queues */
    gmHistory: { type: [GMHistoryEventSchema], default: [] },
    pendingActions: { type: [PendingActionSchema], default: [] },
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

// ─── Phase 7 AI Role Sub-schemas ─────────────────────────────────────────────

const RoleSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    roleName: { type: String, required: true, maxlength: 300 },
    background: { type: String, required: true, maxlength: 300 },
    objective: { type: String, required: true, maxlength: 300 },
    secret: { type: String, required: true, maxlength: 300 },
    clues: { type: [String], default: [] },
  },
  { _id: false }
);

const HistoryEventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    timestamp: { type: Date, default: Date.now },
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

    /** Generated player/NPC roles (Phase 7) */
    roles: {
      type: [RoleSchema],
      default: [],
      validate: {
        validator: function (v) {
          const names = v.map((r) => r.roleName);
          return names.length === new Set(names).size;
        },
        message: "Duplicate role names are not allowed.",
      },
    },

    /** History of phase transitions and actions (Phase 7) */
    history: { type: [HistoryEventSchema], default: [] },

    /** Final resolution fields (Phase 10) */
    finalVerdict: { type: String, default: null },
    winner: { type: String, default: null },
    completedAt: { type: Date, default: null },
    finalReveal: { type: mongoose.Schema.Types.Mixed, default: null },
    summary: { type: mongoose.Schema.Types.Mixed, default: null },
    resolutionStatus: { type: String, default: null },

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
