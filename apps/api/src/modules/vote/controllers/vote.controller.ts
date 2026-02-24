/**
 * Vote Controller
 */
import { Request, Response } from "express";
import { voteService } from "../services/vote.service";
import { AuthenticatedRequest } from "../../auth/middlewares/jwt.middleware";

export class VoteController {
  /**
   * Cast a vote
   */
  async castVote(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { gameId, votedFor, isSkip } = req.body;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      if (!gameId) {
        res.status(400).json({ error: "gameId is required" });
        return;
      }

      await voteService.castVote(
        gameId,
        authReq.userId as any,
        votedFor,
        isSkip || false
      );

      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get vote breakdown (imposter only)
   */
  async getVoteBreakdown(req: Request, res: Response): Promise<void> {
    try {
      const { gameId } = req.params;
      const breakdown = await voteService.getVoteBreakdown(gameId as any);
      res.json(breakdown);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const voteController = new VoteController();
