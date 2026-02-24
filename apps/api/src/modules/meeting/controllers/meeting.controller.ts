/**
 * Meeting Controller
 */
import { Request, Response } from "express";
import { meetingService } from "../services/meeting.service";
import { AuthenticatedRequest } from "../../auth/middlewares/jwt.middleware";

export class MeetingController {
  /**
   * Send a meeting message
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { gameId, message } = req.body;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      if (!gameId || !message) {
        res.status(400).json({ error: "gameId and message are required" });
        return;
      }

      const meetingMessage = await meetingService.sendMessage(
        gameId,
        authReq.userId as any,
        message
      );

      res.json(meetingMessage);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get meeting messages
   */
  async getMessages(req: Request, res: Response): Promise<void> {
    try {
      const { gameId } = req.params;
      const messages = await meetingService.getMeetingMessages(gameId as any);
      res.json(messages);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const meetingController = new MeetingController();
