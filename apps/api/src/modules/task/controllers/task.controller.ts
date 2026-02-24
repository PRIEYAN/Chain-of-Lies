/**
 * Task Controller
 */
import { Request, Response } from "express";
import { taskService } from "../services/task.service";
import { AuthenticatedRequest } from "../../auth/middlewares/jwt.middleware";

export class TaskController {
  /**
   * Get player's tasks
   */
  async getPlayerTasks(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { gameId } = req.params;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const tasks = await taskService.getPlayerTasks(
        gameId as any,
        authReq.userId as any
      );

      res.json(tasks);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Complete a task
   */
  async completeTask(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { taskId, playerX, playerY, points } = req.body;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      if (!taskId) {
        res.status(400).json({ error: "taskId is required" });
        return;
      }

      const result = await taskService.completeTask(
        taskId,
        authReq.userId as any,
        playerX || 0,
        playerY || 0,
        points || 10
      );

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const taskController = new TaskController();
