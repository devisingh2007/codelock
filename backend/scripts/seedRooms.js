require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");
const GameRoom = require("../src/models/GameRoom");
const { generateRoomCode } = require("../src/utils/roomCode");

const seedRooms = async () => {
  try {
    await connectDB();
    console.log("Database connected for seeding...");

    // Clear existing rooms
    await GameRoom.deleteMany({});
    console.log("Cleared existing game rooms.");

    // Find or create host users
    let host = await User.findOne({ email: "host@example.com" });
    if (!host) {
      host = new User({
        username: "RoomHost",
        email: "host@example.com",
        password: "password123", // raw/unhashed for simplicity in local seeds
      });
      await host.save();
      console.log("Created seed host user.");
    }

    let player = await User.findOne({ email: "player@example.com" });
    if (!player) {
      player = new User({
        username: "RoomPlayer",
        email: "player@example.com",
        password: "password123",
      });
      await player.save();
      console.log("Created seed player user.");
    }

    // Seed room 1 (waiting room)
    const code1 = await generateRoomCode();
    const room1 = new GameRoom({
      roomCode: code1,
      host: host._id,
      players: [host._id],
      status: "waiting",
      maxPlayers: 4,
    });
    await room1.save();
    console.log(`Seeded waiting room: ${code1}`);

    // Seed room 2 (full/in-progress room)
    const code2 = await generateRoomCode();
    const room2 = new GameRoom({
      roomCode: code2,
      host: host._id,
      players: [host._id, player._id],
      status: "in_progress",
      maxPlayers: 2,
    });
    await room2.save();
    console.log(`Seeded in-progress/full room: ${code2}`);

    console.log("Database seeding completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedRooms();
