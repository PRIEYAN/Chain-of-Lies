/**
 * Auth Controller
 * 
 * Handles authentication endpoints
 */
import { Request, Response } from "express";
import { authService } from "../services/auth.service";

export class AuthController {
  /**
   * Generate nonce for wallet
   */
  async generateNonce(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress } = req.query;
      if (!walletAddress || typeof walletAddress !== "string") {
        res.status(400).json({ error: "walletAddress is required" });
        return;
      }

      const nonce = await authService.generateNonce(walletAddress);
      res.json({ nonce });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Verify signature and get JWT
   */
  async verifySignature(req: Request, res: Response): Promise<void> {
    try {
      const { walletAddress, signature } = req.body;
      if (!walletAddress || !signature) {
        res.status(400).json({ error: "walletAddress and signature are required" });
        return;
      }

      const { token, user } = await authService.verifySignature(
        walletAddress,
        signature
      );

      res.json({
        token,
        user: {
          id: user._id,
          walletAddress: user.walletAddress,
          username: user.username,
        },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as any;
      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const user = await authService.getOrCreateUser(authReq.walletAddress);
      res.json({
        id: user._id,
        walletAddress: user.walletAddress,
        username: user.username,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
