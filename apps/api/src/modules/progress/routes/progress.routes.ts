/**
 * Progress Routes
 *
 * HTTP endpoints for player progress tracking
 */
import { Router } from "express";
import { progressController } from "../controllers/progress.controller";

const router = Router();

/**
 * GET /api/progress?sessionId=xxx or ?roomCode=xxx
 * Get all players' progress for a session
 */
router.get("/", progressController.getSessionProgress);

/**
 * GET /api/progress/player/:playerId
 * Get a player's progress history across all sessions
 */
router.get("/player/:playerId", progressController.getPlayerHistory);

/**
 * GET /api/progress/total/:sessionId
 * Get total completed tasks across all players
 */
router.get("/total/:sessionId", progressController.getTotalTasks);

/**
 * POST /api/progress/rebuild/:sessionId
 * Rebuild progress from existing task data (admin/debug endpoint)
 */
router.post("/rebuild/:sessionId", progressController.rebuildProgress);

export default router;
