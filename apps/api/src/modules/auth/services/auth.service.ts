/**
 * Authentication Service
 * 
 * Handles MetaMask wallet authentication
 */
import { ethers } from "ethers";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { UserModel, IUser } from "../models/user.model";
import { logger } from "../../../infrastructure/logging/logger";

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRY = "7d";

export class AuthService {
  /**
   * Generate nonce for wallet signature
   */
  async generateNonce(walletAddress: string): Promise<string> {
    const nonce = crypto.randomBytes(32).toString("hex");
    
    await UserModel.findOneAndUpdate(
      { walletAddress: walletAddress.toLowerCase() },
      { nonce },
      { upsert: true, new: true }
    );

    logger.info(`Nonce generated for ${walletAddress}`);
    return nonce;
  }

  /**
   * Verify MetaMask signature and issue JWT
   */
  async verifySignature(
    walletAddress: string,
    signature: string
  ): Promise<{ token: string; user: IUser }> {
    const user = await UserModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
    });

    if (!user || !user.nonce) {
      throw new Error("Nonce not found. Please request nonce first.");
    }

    // Recover address from signature
    const message = `Sign this message to authenticate: ${user.nonce}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error("Invalid signature");
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user._id.toString(), walletAddress: user.walletAddress },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );

    // Clear nonce after successful verification
    user.nonce = undefined;
    await user.save();

    logger.info(`User authenticated: ${walletAddress}`);

    return { token, user };
  }

  /**
   * Verify JWT token
   */
  async verifyJWT(token: string): Promise<{ userId: string; walletAddress: string }> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: string;
        walletAddress: string;
      };
      return decoded;
    } catch (error) {
      throw new Error("Invalid or expired token");
    }
  }

  /**
   * Get or create user
   */
  async getOrCreateUser(walletAddress: string, username?: string): Promise<IUser> {
    let user = await UserModel.findOne({
      walletAddress: walletAddress.toLowerCase(),
    });

    if (!user) {
      user = new UserModel({
        walletAddress: walletAddress.toLowerCase(),
        username: username || `Player_${walletAddress.slice(0, 6)}`,
      });
      await user.save();
      logger.info(`New user created: ${walletAddress}`);
    }

    return user;
  }
}

export const authService = new AuthService();
