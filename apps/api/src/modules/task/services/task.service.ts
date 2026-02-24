/**
 * Task Service
 * 
 * Handles task management and completion
 */
import { Types } from "mongoose";
import { TaskModel, ITask, TaskType } from "../models/task.model";
import { GameModel } from "../../game/models/game.model";
import { RoomModel } from "../../room/models/room.model";
import { gameService } from "../../game/services/game.service";
import { logger } from "../../../infrastructure/logging/logger";

const TASK_PROXIMITY_THRESHOLD = 100; // pixels

export class TaskService {
  /**
   * Get all tasks for a player
   */
  async getPlayerTasks(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId
  ): Promise<ITask[]> {
    return TaskModel.find({
      gameId,
      playerId,
    }).sort({ createdAt: 1 });
  }

  /**
   * Get tasks by type for a player
   */
  async getPlayerTasksByType(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId,
    type: TaskType
  ): Promise<ITask[]> {
    return TaskModel.find({
      gameId,
      playerId,
      type,
    });
  }

  /**
   * Verify player is close enough to task
   */
  async verifyTaskProximity(
    taskId: Types.ObjectId,
    playerX: number,
    playerY: number
  ): Promise<boolean> {
    const task = await TaskModel.findById(taskId);
    if (!task) {
      return false;
    }

    const distance = Math.sqrt(
      Math.pow(playerX - task.location.x, 2) +
        Math.pow(playerY - task.location.y, 2)
    );

    return distance <= TASK_PROXIMITY_THRESHOLD;
  }

  /**
   * Complete a task
   */
  async completeTask(
    taskIdOrName: Types.ObjectId | string,
    playerId: Types.ObjectId,
    playerX: number,
    playerY: number,
    points: number = 0
  ): Promise<{
    success: boolean;
    shouldStartMeeting?: boolean;
    encryptedWord?: string;
    decryptedPercentage?: number;
  }> {
    // Resolve task by id, taskKey, or name
    let task: ITask | null = null;

    // First try as ObjectId
    if (typeof taskIdOrName === "string" && Types.ObjectId.isValid(taskIdOrName)) {
      try {
        task = await TaskModel.findById(taskIdOrName);
      } catch (e) {
        task = null;
      }
    }

    // If not found, try as taskKey (e.g., "task1", "task2")
    if (!task && typeof taskIdOrName === "string") {
      task = await TaskModel.findOne({ playerId, taskKey: taskIdOrName });
    }

    // Final fallback: try name match (shouldn't happen in normal flow)
    if (!task && typeof taskIdOrName === "string") {
      task = await TaskModel.findOne({ playerId, name: taskIdOrName });
    }

    if (!task) {
      throw new Error("Task not found");
    }

    if (task.completed) {
      throw new Error("Task already completed");
    }

    if (task.playerId.toString() !== playerId.toString()) {
      throw new Error("Task does not belong to player");
    }

    // Verify proximity
    const isNearby = await this.verifyTaskProximity(task._id, playerX, playerY);
    if (!isNearby) {
      throw new Error("Player not close enough to task");
    }

    // Verify game phase
    const game = await GameModel.findById(task.gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.phase !== "TASKS") {
      throw new Error("Not in task phase");
    }

    // Verify role
    const room = await RoomModel.findById(game.roomId);
    const player = room?.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === playerId.toString()
    );

    if (!player) {
      throw new Error("Player not in game");
    }

    const playerRole = player.role;
    if (task.type === "IMPOSTER" && playerRole !== "IMPOSTER") {
      throw new Error("Only imposter can complete sabotage tasks");
    }
    if (task.type === "CREW" && playerRole !== "CREWMATE") {
      throw new Error("Only crewmates can complete crew tasks");
    }

    // Complete task based on type
    // persist earned points on the task
    task.points = points || 0;

    if (task.type === "CREW") {
      const result = await gameService.completeCrewTask(
        task.gameId,
        playerId,
        task._id,
        points
      );

      task.completed = true;
      task.completedAt = new Date();
      await task.save();

      return {
        success: true,
        shouldStartMeeting: result.shouldStartMeeting,
        encryptedWord: result.encryptedWord,
      };
    } else {
      const result = await gameService.completeImposterTask(
        task.gameId,
        playerId,
        task._id,
        points
      );

      task.completed = true;
      task.completedAt = new Date();
      await task.save();

      return {
        success: true,
        encryptedWord: result.encryptedWord,
        decryptedPercentage: result.decryptedPercentage,
      };
    }
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: Types.ObjectId): Promise<ITask> {
    const task = await TaskModel.findById(taskId);
    if (!task) {
      throw new Error("Task not found");
    }
    return task;
  }

  /**
   * Get all tasks for a game (for debugging)
   */
  async getGameTasks(gameId: Types.ObjectId): Promise<ITask[]> {
    return TaskModel.find({ gameId });
  }
}

export const taskService = new TaskService();
