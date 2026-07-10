/**
 * @file gameStateSeed.js
 * Seeds sample GameState documents into the database for development/testing.
 *
 * Usage:
 *   node backend/scripts/gameStateSeed.js
 *
 * Requires a running MongoDB instance and MONGO_URI in environment (or .env).
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const GameState = require("../src/models/GameState");
const GameRoom = require("../src/models/GameRoom");
const User = require("../src/models/User");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/mysteryverse";

/** Sample seed data covering different phases */
const SEEDS = [
  {
    roomCode: "SEED01",
    phase: "lobby",
    players: [],
    story: {
      victim: "",
      murderer: "",
      location: "Abandoned Manor",
      timeline: [],
      clues: [],
    },
    eventsLog: [{ event: "Room seeded – lobby phase" }],
  },
  {
    roomCode: "SEED02",
    phase: "investigation",
    players: [],
    story: {
      victim: "Lord Blackwell",
      murderer: "",
      location: "Grand Library",
      timeline: [
        { time: "9:00 PM", event: "Dinner party begins" },
        { time: "10:30 PM", event: "Lord Blackwell found dead" },
      ],
      clues: ["Broken candlestick", "Torn letter", "Muddy boot prints"],
    },
    eventsLog: [
      { event: "Room seeded – investigation phase" },
      { event: "Clues distributed to players" },
    ],
  },
  {
    roomCode: "SEED03",
    phase: "voting",
    players: [],
    story: {
      victim: "Lady Crimson",
      murderer: "Prof. Ashworth",
      location: "Secret Study",
      timeline: [
        { time: "8:00 PM", event: "Guests arrive" },
        { time: "11:00 PM", event: "Lady Crimson goes missing" },
        { time: "11:30 PM", event: "Body discovered in study" },
      ],
      clues: ["Poison vial", "Secret diary entry", "Silver ring"],
    },
    eventsLog: [
      { event: "Room seeded – voting phase" },
      { event: "All clues found – voting begins" },
    ],
  },
  {
    roomCode: "SEED04",
    phase: "reveal",
    players: [],
    story: {
      victim: "Duke Wellington",
      murderer: "Ms. Harrington",
      location: "Wine Cellar",
      timeline: [
        { time: "7:00 PM", event: "Wine tasting begins" },
        { time: "9:00 PM", event: "Duke is seen arguing with Ms. Harrington" },
        { time: "9:45 PM", event: "Duke found unconscious in wine cellar" },
      ],
      clues: [
        "Vintage wine glass with lipstick",
        "Unsigned threatening note",
        "Misplaced corkscrew",
      ],
    },
    eventsLog: [
      { event: "Room seeded – reveal phase" },
      { event: "Murderer revealed: Ms. Harrington" },
    ],
  },
];

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✅  Connected to MongoDB:", MONGO_URI);

    // Clean up existing seed rooms
    const seedCodes = SEEDS.map((s) => s.roomCode);
    await GameState.deleteMany({ roomId: { $in: seedCodes } });
    await GameRoom.deleteMany({ roomCode: { $in: seedCodes } });
    console.log("🗑️   Cleared existing seed data.");

    // Use a placeholder host (first user in DB, or create one)
    let host = await User.findOne({});
    if (!host) {
      host = await User.create({
        username: "seed_host",
        email: "seed@mysteryverse.local",
        password: "seeded_password_not_used",
      });
      console.log("👤  Created placeholder host user:", host._id);
    }

    for (const seed of SEEDS) {
      // Create GameRoom
      const room = await GameRoom.create({
        roomCode: seed.roomCode,
        host: host._id,
        players: [host._id],
        status: seed.phase === "lobby" ? "waiting" : "in_progress",
        maxPlayers: 4,
      });

      // Seed GameState
      const state = await GameState.create({
        roomId: seed.roomCode,
        phase: seed.phase,
        players: seed.players,
        story: seed.story,
        eventsLog: seed.eventsLog.map((e) => ({
          ...e,
          timestamp: new Date(),
        })),
        lastUpdated: new Date(),
      });

      console.log(
        `🎮  Seeded room ${seed.roomCode} | Phase: ${seed.phase} | State ID: ${state._id}`
      );
    }

    console.log("\n🌱  Seeding complete. Run 'npm start' to use the seeded data.");
    process.exit(0);
  } catch (err) {
    console.error("❌  Seeding failed:", err);
    process.exit(1);
  }
};

seed();
