/**
 * Vote Service
 * 
 * Handles voting logic and elimination
 */
import { Types } from "mongoose";
import { VoteModel, IVote } from "../models/vote.model";
import { GameModel } from "../../game/models/game.model";
import { RoomModel } from "../../room/models/room.model";
import { GameLogModel } from "../../shared/models/log.model";
import { gameService } from "../../game/services/game.service";
import { logger } from "../../../infrastructure/logging/logger";

export class VoteService {
  /**
   * Cast a vote
   */
  async castVote(
    gameId: Types.ObjectId,
    voterId: Types.ObjectId,
    votedFor?: Types.ObjectId,
    isSkip: boolean = false
  ): Promise<void> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.phase !== "VOTING") {
      throw new Error("Not in voting phase");
    }

    // Check if already voted
    const existingVote = await VoteModel.findOne({ gameId, voterId });
    if (existingVote) {
      throw new Error("Already voted");
    }

    // Verify voter is alive
    const room = await RoomModel.findById(game.roomId);
    const voter = room?.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === voterId.toString()
    );
    if (!voter || !voter.isAlive) {
      throw new Error("Voter not alive");
    }

    // Verify votedFor is alive (if not skip)
    if (!isSkip && votedFor) {
      const target = room?.players.find(
        (p) => (p.userId as Types.ObjectId).toString() === votedFor.toString()
      );
      if (!target || !target.isAlive) {
        throw new Error("Cannot vote for eliminated player");
      }
    }

    // Create vote
    await VoteModel.create({
      gameId,
      voterId,
      votedFor: isSkip ? undefined : votedFor,
      isSkip,
    });

    logger.info(`Vote cast: game=${gameId}, voter=${voterId}, target=${votedFor || "SKIP"}`);

    // Check if all alive players have voted
    const alivePlayers = room?.players.filter((p) => p.isAlive) || [];
    const voteCount = await VoteModel.countDocuments({ gameId });

    if (voteCount >= alivePlayers.length) {
      // All voted, tally results
      await this.tallyVotes(gameId);
    }
  }

  /**
   * Tally votes and eliminate player
   */
  async tallyVotes(
    gameId: Types.ObjectId
  ): Promise<{ eliminated?: Types.ObjectId; voteBreakdown: Record<string, number> }> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const votes = await VoteModel.find({ gameId });
    const voteBreakdown: Record<string, number> = {};
    let skipCount = 0;

    // Count votes
    votes.forEach((vote) => {
      if (vote.isSkip) {
        skipCount++;
      } else if (vote.votedFor) {
        const key = vote.votedFor.toString();
        voteBreakdown[key] = (voteBreakdown[key] || 0) + 1;
      }
    });

    // Find highest vote count
    const maxVotes = Math.max(...Object.values(voteBreakdown), skipCount);
    const candidates: Array<{ playerId: string; votes: number }> = [];

    Object.entries(voteBreakdown).forEach(([playerId, votes]) => {
      if (votes === maxVotes) {
        candidates.push({ playerId, votes });
      }
    });

    // Determine elimination
    let eliminated: Types.ObjectId | undefined;

    if (skipCount === maxVotes) {
      // SKIP has highest votes - no elimination
      logger.info(`Vote result: SKIP wins, no elimination`);
    } else if (candidates.length === 1) {
      // Single highest - eliminate
      eliminated = new Types.ObjectId(candidates[0].playerId);
    } else if (candidates.length > 1) {
      // Tie - no elimination
      logger.info(`Vote result: Tie, no elimination`);
    }

    // Eliminate player if needed
    if (eliminated) {
      const room = await RoomModel.findById(game.roomId);
      const player = room?.players.find(
        (p) => (p.userId as Types.ObjectId).toString() === eliminated!.toString()
      );
      if (player) {
        player.isAlive = false;
        await room.save();

        await GameLogModel.create({
          gameId,
          type: "PLAYER_ELIMINATED",
          metadata: { playerId: eliminated, voteBreakdown },
        });

        logger.info(`Player eliminated: ${eliminated}`);
      }
    }

    // Clear votes for next round
    await VoteModel.deleteMany({ gameId });

    // Check win conditions
    const winCheck = await gameService.checkWinConditions(gameId);
    if (!winCheck.gameEnded) {
      // Game continues - reset to TASKS phase
      game.phase = "TASKS";
      game.round += 1;
      await game.save();
    }

    return { eliminated, voteBreakdown };
  }

  /**
   * Check if player has voted
   */
  async hasVoted(gameId: Types.ObjectId, voterId: Types.ObjectId): Promise<boolean> {
    const vote = await VoteModel.findOne({ gameId, voterId });
    return !!vote;
  }

  /**
   * Get vote breakdown (imposter only)
   */
  async getVoteBreakdown(gameId: Types.ObjectId): Promise<Record<string, number>> {
    const votes = await VoteModel.find({ gameId });
    const breakdown: Record<string, number> = {};

    votes.forEach((vote) => {
      if (vote.isSkip) {
        breakdown["SKIP"] = (breakdown["SKIP"] || 0) + 1;
      } else if (vote.votedFor) {
        const key = vote.votedFor.toString();
        breakdown[key] = (breakdown[key] || 0) + 1;
      }
    });

    return breakdown;
  }
}

export const voteService = new VoteService();
