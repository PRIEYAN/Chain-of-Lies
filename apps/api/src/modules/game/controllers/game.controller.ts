/**
 * Game Controller
 */
import { Request, Response } from "express";
import { gameService } from "../services/game.service";
import { AuthenticatedRequest } from "../../auth/middlewares/jwt.middleware";

export class GameController {
  /**
   * Start a new game
   */
  async startGame(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { roomId } = req.body;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      if (!roomId) {
        res.status(400).json({ error: "roomId is required" });
        return;
      }

      const game = await gameService.startGame(roomId);
      res.json({
        id: game._id,
        roomId: game.roomId,
        phase: game.phase,
        round: game.round,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get player's game state
   */
  async getPlayerGameState(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { gameId } = req.params;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const state = await gameService.getPlayerGameState(
        gameId as any,
        authReq.userId as any
      );

      res.json(state);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const gameController = new GameController();
