require("dotenv").config();
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const gameRoutes = require("./src/routes/game");
const gameStateRoutes = require("./src/routes/gameStateRoutes");
const { initSocket } = require("./src/sockets/gameSocket");
const gameStateSocket = require("./src/sockets/gameStateSocket");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/game", gameStateRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "UP",
    database:
      mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED",
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error("Centralized Error Handler:", err);
  res.status(status).json({ error: err.message || "Internal server error" });
});

// Create HTTP server so Socket.IO can share it
const httpServer = http.createServer(app);

// Database and Server Start
const startServer = async () => {
  await connectDB();

  // Initialise Socket.IO (only in non-test env)
  const io = initSocket(httpServer);
  gameStateSocket(io);

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Socket.IO listening on ws://localhost:${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    httpServer.close(async () => {
      console.log("HTTP server closed.");
      try {
        await mongoose.connection.close();
        console.log("Database connection closed.");
        process.exit(0);
      } catch (err) {
        console.error(
          "Error closing database connection during shutdown:",
          err
        );
        process.exit(1);
      }
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

module.exports = { app, httpServer }; // Export both for testing
