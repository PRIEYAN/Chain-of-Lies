/**
 * JWT Authentication Middleware
 * 
 * Verifies JWT token from request headers
 */
import { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  walletAddress?: string;
}

export async function authenticateJWT(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "No token provided" });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = await authService.verifyJWT(token);

    req.userId = decoded.userId;
    req.walletAddress = decoded.walletAddress;

    next();
  } catch (error: any) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
