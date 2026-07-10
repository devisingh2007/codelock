#!/usr/bin/env node
"use strict";

/**
 * @file migrations/addStoryField.js
 * Phase 6 – One-time migration script.
 *
 * Backfills the `story` field on every existing GameState document that
 * was created before Phase 6 and therefore lacks the field entirely.
 *
 * Usage:
 *   node migrations/addStoryField.js
 *
 * The script reads MONGO_URI from .env (or the environment).  It connects,
 * applies the update, then exits cleanly.
 *
 * Safe to run multiple times – the $exists: false filter ensures that
 * documents which already have `story` are left untouched.
 */

require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");
const GameState = require("../src/models/GameState");

const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("[Migration] ERROR: MONGO_URI is not set. Aborting.");
  process.exit(1);
}

const run = async () => {
  console.log("[Migration] Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI);
  console.log("[Migration] Connected.");

  // Backfill: set story to null on documents that don't yet have the field.
  // Using $exists: false so that docs already having story (even null) are skipped.
  const result = await GameState.updateMany(
    { story: { $exists: false } },
    { $set: { story: null } }
  );

  console.log(
    `[Migration] addStoryField complete. ` +
      `Matched: ${result.matchedCount}, Modified: ${result.modifiedCount}`
  );

  await mongoose.disconnect();
  console.log("[Migration] Disconnected. Done.");
  process.exit(0);
};

run().catch((err) => {
  console.error("[Migration] Fatal error:", err);
  process.exit(1);
});
