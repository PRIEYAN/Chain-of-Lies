/**
 * API Server Entry Point
 * 
 * Initializes Express server with domain routes and WebSocket support
 */
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";

import { registerGameRoutes } from "./domains/game/routes";
import { registerVotingRoutes } from "./domains/voting/routes";
import { registerSubmissionRoutes } from "./domains/submissions/routes";
import { logger } from "./infrastructure/logging/logger";
import { errorHandler } from "./infrastructure/http/middleware/error-handler";
import { connectMongoDB } from "./infrastructure/database/mongodb";
import { authRoutes } from "./modules/auth/routes/auth.routes";
import { roomRoutes } from "./modules/room/routes/room.routes";
import { gameRoutes } from "./modules/game/routes/game.routes";
import { wordbankRoutes } from "./modules/game/routes/wordbank.routes";
import { taskRoutes } from "./modules/task/routes/task.routes";
import { meetingRoutes } from "./modules/meeting/routes/meeting.routes";
import { voteRoutes } from "./modules/vote/routes/vote.routes";
import progressRoutes from "./modules/progress/routes/progress.routes";

const app = express();
const httpServer = createServer(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS middleware
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_URL || "http://localhost:3000");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logger.info(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

// Initialize domain routes
async function initializeRoutes() {
  // Legacy domain routes
  registerGameRoutes(app);
  registerVotingRoutes(app);
  registerSubmissionRoutes(app);
  
  // New module routes
  app.use("/api/auth", authRoutes);
  app.use("/api/room", roomRoutes);
  app.use("/api/game", gameRoutes);
  app.use("/api/wordbanks", wordbankRoutes);
  app.use("/api/task", taskRoutes);
  app.use("/api/meeting", meetingRoutes);
  app.use("/api/vote", voteRoutes);
  app.use("/api/progress", progressRoutes); // NEW: Player progress tracking
}

// Initialize server
async function bootstrap() {
  console.log("🚀 Starting Chain of Lies API Server...");
  console.log("");
  
  // Connect MongoDB
  await connectMongoDB();
  console.log("");
  
  await initializeRoutes();

  // Initialize Socket.IO server
  console.log("🔧 Setting up Socket.IO...");
  const { initializeSocketIO } = await import("./infrastructure/websocket/socketio-server");
  const io = initializeSocketIO(httpServer);
  
  if (!io) {
    throw new Error("Failed to initialize Socket.IO server");
  }
  
  console.log("✅ Socket.IO initialized successfully");

  // Error handling middleware (must be last)
  app.use(errorHandler);

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, () => {
    console.log("✅ API server started successfully!");
    console.log(`🌐 Server running on: http://localhost:${port}`);
    console.log(`❤️  Health check: http://localhost:${port}/api/health`);
    console.log("");
    logger.info(`API server running on port ${port}`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

export { app, httpServer };
