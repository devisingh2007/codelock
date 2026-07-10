const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const connUri = process.env.MONGO_URI || "mongodb://localhost:27017/mysteryverse";
    
    mongoose.connection.on("connected", () => {
      console.log("Mongoose connection established to database.");
    });

    mongoose.connection.on("error", (err) => {
      console.error(`Mongoose connection error: ${err.message}`);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("Mongoose connection disconnected.");
    });

    await mongoose.connect(connUri);
  } catch (error) {
    console.error(`Database connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
