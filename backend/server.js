require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const connectDB = require("./src/config/db");
const authRoutes = require("./src/routes/authRoutes");
const gameRoutes = require("./src/routes/game");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "UP", database: mongoose.connection.readyState === 1 ? "CONNECTED" : "DISCONNECTED" });
});

// Centralized error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  console.error("Centralized Error Handler:", err);
  res.status(status).json({ error: err.message || "Internal server error" });
});

// Database and Server Start
const startServer = async () => {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      console.log("HTTP server closed.");
      try {
        await mongoose.connection.close();
        console.log("Database connection closed.");
        process.exit(0);
      } catch (err) {
        console.error("Error closing database connection during shutdown:", err);
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

module.exports = app; // Export for testing
