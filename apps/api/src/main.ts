/**
 * API Server Entry Point
 * 
 * Initializes Express server with domain routes and WebSocket support
 */
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { initializeWebSocket } from "./infrastructure/websocket/server";
import { registerGameRoutes } from "./domains/game/routes";
import { registerVotingRoutes } from "./domains/voting/routes";
import { registerSubmissionRoutes } from "./domains/submissions/routes";
import { logger } from "./infrastructure/logging/logger";
import { errorHandler } from "./infrastructure/http/middleware/error-handler";

const app = express();
const httpServer = createServer(app);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  registerGameRoutes(app);
  registerVotingRoutes(app);
  registerSubmissionRoutes(app);
}

// Initialize server
async function bootstrap() {
  await initializeRoutes();
  
  // Initialize WebSocket server
  initializeWebSocket(httpServer);
  
  // Error handling middleware (must be last)
  app.use(errorHandler);
  
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, () => {
    logger.info(`API server running on port ${port}`);
  });
}

bootstrap().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});

export { app, httpServer };
