/**
 * Progress Service
 *
 * Handles player progress tracking and aggregation.
 * Provides an event-driven API using an EventEmitter pattern
 * so other modules can call updatePlayer without MongoDB internals.
 */
import { Types } from "mongoose";
import { EventEmitter } from "events";
import {
  PlayerProgressModel,
  IPlayerProgress,
  ITaskCompletion,
} from "../models/player-progress.model";
import { UserModel } from "../../auth/models/user.model";
import { RoomModel } from "../../room/models/room.model";
import { GameModel } from "../../game/models/game.model";
import { TaskModel } from "../../task/models/task.model";
import { logger } from "../../../infrastructure/logging/logger";

// Event emitter for progress updates - other modules can subscribe
export const progressEvents = new EventEmitter();

export interface ProgressPatch {
  taskCompleted?: {
    taskId: Types.ObjectId;
    taskName: string;
    taskKey?: string;
    points: number;
  };
  isAlive?: boolean;
  role?: "CREWMATE" | "IMPOSTER";
}

class ProgressService {
  /**
   * Initialize progress record for a player when game starts
   */
  async initializePlayerProgress(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId,
    roomCode: string,
    role: "CREWMATE" | "IMPOSTER"
  ): Promise<IPlayerProgress> {
    try {
      // Get player name
      const user = await UserModel.findById(playerId);
      const playerName = user?.username || `Player_${playerId.toString().slice(-8)}`;

      // Check if already exists
      let progress = await PlayerProgressModel.findOne({
        sessionId: gameId,
        playerId,
      });

      if (progress) {
        // Update role if changed
        progress.role = role;
        progress.lastUpdated = new Date();
        await progress.save();
        return progress;
      }

      // Create new progress record
      progress = new PlayerProgressModel({
        playerId,
        playerName,
        sessionId: gameId,
        roomCode,
        role,
        isAlive: true,
        tasksCompleted: [],
        tasksCompletedCount: 0,
        totalPoints: 0,
        lastUpdated: new Date(),
      });

      await progress.save();
      logger.info(`Initialized progress for player ${playerId} in game ${gameId}`);

      progressEvents.emit("progress:initialized", {
        playerId: playerId.toString(),
        gameId: gameId.toString(),
      });

      return progress;
    } catch (error) {
      logger.error("Failed to initialize player progress:", error);
      throw error;
    }
  }

  /**
   * Update player progress - call this from other modules
   */
  async updatePlayer(
    playerId: Types.ObjectId | string,
    gameId: Types.ObjectId | string,
    patch: ProgressPatch
  ): Promise<IPlayerProgress | null> {
    try {
      const playerObjId = typeof playerId === "string" ? new Types.ObjectId(playerId) : playerId;
      const gameObjId = typeof gameId === "string" ? new Types.ObjectId(gameId) : gameId;

      const progress = await PlayerProgressModel.findOne({
        sessionId: gameObjId,
        playerId: playerObjId,
      });

      if (!progress) {
        logger.warn(`Progress record not found for player ${playerId} in game ${gameId}`);
        return null;
      }

      // Apply patch
      if (patch.isAlive !== undefined) {
        progress.isAlive = patch.isAlive;
      }

      if (patch.role) {
        progress.role = patch.role;
      }

      if (patch.taskCompleted) {
        const completion: ITaskCompletion = {
          taskId: patch.taskCompleted.taskId,
          taskName: patch.taskCompleted.taskName,
          taskKey: patch.taskCompleted.taskKey,
          completedAt: new Date(),
          points: patch.taskCompleted.points,
        };

        progress.tasksCompleted.push(completion);
        progress.tasksCompletedCount = progress.tasksCompleted.length;
        progress.totalPoints += patch.taskCompleted.points;
      }

      progress.lastUpdated = new Date();
      await progress.save();

      // Emit event for subscribers
      progressEvents.emit("progress:updated", {
        playerId: progress.playerId.toString(),
        gameId: progress.sessionId.toString(),
        tasksCompletedCount: progress.tasksCompletedCount,
        totalPoints: progress.totalPoints,
      });

      return progress;
    } catch (error) {
      logger.error("Failed to update player progress:", error);
      // Graceful degradation - don't throw, just log
      return null;
    }
  }

  /**
   * Get all players' progress for a session
   */
  async getSessionProgress(sessionId: Types.ObjectId | string): Promise<IPlayerProgress[]> {
    try {
      const gameObjId = typeof sessionId === "string" ? new Types.ObjectId(sessionId) : sessionId;
      return PlayerProgressModel.find({ sessionId: gameObjId }).sort({ lastUpdated: -1 });
    } catch (error) {
      logger.error("Failed to get session progress:", error);
      return [];
    }
  }

  /**
   * Get total completed tasks across all players in a session
   */
  async getTotalCompletedTasks(sessionId: Types.ObjectId | string): Promise<number> {
    try {
      const gameObjId = typeof sessionId === "string" ? new Types.ObjectId(sessionId) : sessionId;
      
      const result = await PlayerProgressModel.aggregate([
        { $match: { sessionId: gameObjId } },
        { $group: { _id: null, total: { $sum: "$tasksCompletedCount" } } },
      ]);

      return result.length > 0 ? result[0].total : 0;
    } catch (error) {
      logger.error("Failed to get total completed tasks:", error);
      return 0;
    }
  }

  /**
   * Get progress by room code (for debugging/dashboards)
   */
  async getProgressByRoomCode(roomCode: string): Promise<IPlayerProgress[]> {
    try {
      return PlayerProgressModel.find({ roomCode: roomCode.toUpperCase() }).sort({
        lastUpdated: -1,
      });
    } catch (error) {
      logger.error("Failed to get progress by room code:", error);
      return [];
    }
  }

  /**
   * Get a player's progress across all their sessions
   */
  async getPlayerHistory(playerId: Types.ObjectId | string): Promise<IPlayerProgress[]> {
    try {
      const playerObjId = typeof playerId === "string" ? new Types.ObjectId(playerId) : playerId;
      return PlayerProgressModel.find({ playerId: playerObjId }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error("Failed to get player history:", error);
      return [];
    }
  }

  /**
   * Build progress from existing task data (for games already in progress)
   */
  async rebuildProgressFromTasks(gameId: Types.ObjectId): Promise<void> {
    try {
      const game = await GameModel.findById(gameId);
      if (!game) return;

      const room = await RoomModel.findById(game.roomId);
      if (!room) return;

      for (const player of room.players) {
        // Initialize if not exists
        await this.initializePlayerProgress(
          gameId,
          player.userId as Types.ObjectId,
          room.roomCode,
          player.role || "CREWMATE"
        );

        // Get completed tasks
        const tasks = await TaskModel.find({
          gameId,
          playerId: player.userId,
          completed: true,
        });

        // Update with each task
        for (const task of tasks) {
          await this.updatePlayer(player.userId as Types.ObjectId, gameId, {
            taskCompleted: {
              taskId: task._id,
              taskName: task.name,
              taskKey: task.taskKey,
              points: task.points || 0,
            },
          });
        }
      }

      logger.info(`Rebuilt progress for game ${gameId}`);
    } catch (error) {
      logger.error("Failed to rebuild progress from tasks:", error);
    }
  }
}

export const progressService = new ProgressService();
