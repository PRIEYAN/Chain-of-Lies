/**
 * MongoDB Connection
 * 
 * Connects to MongoDB Atlas using Mongoose
 */
import mongoose from "mongoose";
import { logger } from "../logging/logger";

const MONGODB_URI = "mongodb+srv://prieyan_dev:iamthegoat@chainsoflies.9mwigaa.mongodb.net/?appName=ChainsOfLies";

let isConnected = false;

export async function connectMongoDB(): Promise<void> {
  if (isConnected) {
    console.log("✅ MongoDB already connected");
    return;
  }

  // Check if using default localhost (no .env configured)
  if (MONGODB_URI === "mongodb://localhost:27017/chain-of-lies") {
    console.warn("⚠️  WARNING: MONGODB_URI not set in .env file!");
    console.warn("⚠️  Using default localhost:27017 (will fail if MongoDB not running locally)");
    console.warn("⚠️  To use MongoDB Atlas, add MONGODB_URI to apps/api/.env");
    console.warn("⚠️  Example: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chain-of-lies");
  }

  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log("✅ MongoDB connected successfully!");
    console.log(`📊 Database: ${mongoose.connection.name}`);
    console.log(`🌐 Host: ${mongoose.connection.host}`);
    logger.info("MongoDB connected successfully");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    console.error("❌ Server cannot start without database connection.");
    console.error("❌ Please configure MONGODB_URI in apps/api/.env");
    logger.error("MongoDB connection error:", error);
    throw error;
  }
}

export async function disconnectMongoDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info("MongoDB disconnected");
  } catch (error) {
    logger.error("MongoDB disconnection error:", error);
    throw error;
  }
}

export { mongoose };
