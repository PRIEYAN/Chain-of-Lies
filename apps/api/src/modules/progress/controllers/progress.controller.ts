/**
 * Progress Controller
 *
 * HTTP handlers for player progress endpoints
 */
import { Request, Response } from "express";
import { Types } from "mongoose";
import { progressService } from "../services/progress.service";
import { logger } from "../../../infrastructure/logging/logger";

export const progressController = {
  /**
   * GET /api/progress?sessionId=xxx
   * Get all players' progress for a session
   */
  async getSessionProgress(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId, roomCode } = req.query;

      if (!sessionId && !roomCode) {
        res.status(400).json({
          error: "Either sessionId or roomCode query parameter is required",
        });
        return;
      }

      let progress;

      if (sessionId) {
        if (!Types.ObjectId.isValid(sessionId as string)) {
          res.status(400).json({ error: "Invalid sessionId format" });
          return;
        }
        progress = await progressService.getSessionProgress(sessionId as string);
      } else {
        progress = await progressService.getProgressByRoomCode(roomCode as string);
      }

      res.json({
        success: true,
        count: progress.length,
        progress: progress.map((p) => ({
          playerId: p.playerId.toString(),
          playerName: p.playerName,
          sessionId: p.sessionId.toString(),
          roomCode: p.roomCode,
          role: p.role,
          isAlive: p.isAlive,
          tasksCompleted: p.tasksCompleted.map((t) => ({
            taskId: t.taskId.toString(),
            taskName: t.taskName,
            taskKey: t.taskKey,
            completedAt: t.completedAt,
            points: t.points,
          })),
          tasksCompletedCount: p.tasksCompletedCount,
          totalPoints: p.totalPoints,
          lastUpdated: p.lastUpdated,
        })),
      });
    } catch (error) {
      logger.error("Error fetching session progress:", error);
      res.status(500).json({ error: "Failed to fetch progress" });
    }
  },

  /**
   * GET /api/progress/player/:playerId
   * Get a player's progress history across all sessions
   */
  async getPlayerHistory(req: Request, res: Response): Promise<void> {
    try {
      const { playerId } = req.params;

      if (!Types.ObjectId.isValid(playerId)) {
        res.status(400).json({ error: "Invalid playerId format" });
        return;
      }

      const history = await progressService.getPlayerHistory(playerId);

      res.json({
        success: true,
        playerId,
        sessionsCount: history.length,
        history: history.map((p) => ({
          sessionId: p.sessionId.toString(),
          roomCode: p.roomCode,
          role: p.role,
          isAlive: p.isAlive,
          tasksCompletedCount: p.tasksCompletedCount,
          totalPoints: p.totalPoints,
          lastUpdated: p.lastUpdated,
          createdAt: p.createdAt,
        })),
      });
    } catch (error) {
      logger.error("Error fetching player history:", error);
      res.status(500).json({ error: "Failed to fetch player history" });
    }
  },

  /**
   * GET /api/progress/total/:sessionId
   * Get total completed tasks across all players
   */
  async getTotalTasks(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!Types.ObjectId.isValid(sessionId)) {
        res.status(400).json({ error: "Invalid sessionId format" });
        return;
      }

      const total = await progressService.getTotalCompletedTasks(sessionId);

      res.json({
        success: true,
        sessionId,
        totalCompletedTasks: total,
      });
    } catch (error) {
      logger.error("Error fetching total tasks:", error);
      res.status(500).json({ error: "Failed to fetch total tasks" });
    }
  },

  /**
   * POST /api/progress/rebuild/:sessionId
   * Rebuild progress from existing task data (admin/debug endpoint)
   */
  async rebuildProgress(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;

      if (!Types.ObjectId.isValid(sessionId)) {
        res.status(400).json({ error: "Invalid sessionId format" });
        return;
      }

      await progressService.rebuildProgressFromTasks(new Types.ObjectId(sessionId));

      res.json({
        success: true,
        message: "Progress rebuilt successfully",
      });
    } catch (error) {
      logger.error("Error rebuilding progress:", error);
      res.status(500).json({ error: "Failed to rebuild progress" });
    }
  },
};
