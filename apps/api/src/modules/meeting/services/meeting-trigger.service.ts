/**
 * Meeting Trigger Service
 *
 * Monitors task completions and triggers emergency meetings
 * when the total completed tasks reaches thresholds (minimum 3).
 *
 * This service:
 * - Listens for progress update events
 * - Maintains an in-memory cache of task counts per session
 * - Emits EMERGENCY_MEETING socket events when threshold is reached
 */
import { Server as SocketIOServer } from "socket.io";
import { Types } from "mongoose";
import { EventEmitter } from "events";
import { progressService, progressEvents } from "../../progress/services/progress.service";
import { MeetingModel } from "../models/meeting.model";
import { GameModel } from "../../game/models/game.model";
import { logger } from "../../../infrastructure/logging/logger";

// Configuration
const MEETING_TASK_THRESHOLD = 3; // Trigger meeting at 3 completed tasks
const MEETING_COOLDOWN_MS = 30000; // 30 seconds between auto-triggered meetings

// Event emitter for meeting events
export const meetingEvents = new EventEmitter();

interface SessionMeetingState {
  totalTasksAtLastMeeting: number;
  lastMeetingTime: number;
  meetingInProgress: boolean;
}

class MeetingTriggerService {
  private io: SocketIOServer | null = null;
  private sessionStates: Map<string, SessionMeetingState> = new Map();
  private initialized = false;

  /**
   * Initialize with Socket.IO server instance
   */
  initialize(io: SocketIOServer): void {
    if (this.initialized) {
      logger.warn("MeetingTriggerService already initialized");
      return;
    }

    this.io = io;
    this.initialized = true;

    // Listen for progress updates
    progressEvents.on("progress:updated", this.handleProgressUpdate.bind(this));

    logger.info("MeetingTriggerService initialized");
  }

  /**
   * Handle progress update events
   */
  private async handleProgressUpdate(data: {
    playerId: string;
    gameId: string;
    tasksCompletedCount: number;
    totalPoints: number;
  }): Promise<void> {
    try {
      const { gameId } = data;

      // Get total tasks across all players
      const totalTasks = await progressService.getTotalCompletedTasks(gameId);

      // Get or create session state
      let state = this.sessionStates.get(gameId);
      if (!state) {
        state = {
          totalTasksAtLastMeeting: 0,
          lastMeetingTime: 0,
          meetingInProgress: false,
        };
        this.sessionStates.set(gameId, state);
      }

      // Check if we should trigger a meeting
      const tasksSinceLastMeeting = totalTasks - state.totalTasksAtLastMeeting;
      const timeSinceLastMeeting = Date.now() - state.lastMeetingTime;
      const cooldownPassed = timeSinceLastMeeting >= MEETING_COOLDOWN_MS;

      if (
        tasksSinceLastMeeting >= MEETING_TASK_THRESHOLD &&
        !state.meetingInProgress &&
        cooldownPassed
      ) {
        logger.info(
          `Triggering emergency meeting for game ${gameId}: ${totalTasks} total tasks completed`
        );
        await this.triggerMeeting(gameId, totalTasks);
      }
    } catch (error) {
      logger.error("Error handling progress update in meeting trigger:", error);
    }
  }

  /**
   * Trigger an emergency meeting for all players in a session
   */
  async triggerMeeting(gameId: string, totalTasks: number): Promise<void> {
    if (!this.io) {
      logger.error("Socket.IO not initialized in MeetingTriggerService");
      return;
    }

    try {
      // Get game to find room code
      const game = await GameModel.findById(gameId).populate("roomId");
      if (!game) {
        logger.warn(`Game ${gameId} not found for meeting trigger`);
        return;
      }

      // Update session state
      const state = this.sessionStates.get(gameId);
      if (state) {
        state.totalTasksAtLastMeeting = totalTasks;
        state.lastMeetingTime = Date.now();
        state.meetingInProgress = true;
      }

      // Create meeting record in MongoDB
      const meeting = new MeetingModel({
        gameId: new Types.ObjectId(gameId),
        round: game.round || 1,
        messages: [],
        startedAt: new Date(),
      });
      await meeting.save();

      // Get room code for socket room
      const roomCode = (game.roomId as any)?.roomCode;
      if (!roomCode) {
        logger.warn(`Room code not found for game ${gameId}`);
        return;
      }

      // Emit to all clients in the room
      this.io.to(roomCode).emit("EMERGENCY_MEETING", {
        meetingId: meeting._id.toString(),
        gameId,
        totalTasksCompleted: totalTasks,
        triggeredAt: new Date().toISOString(),
        reason: "task_threshold",
      });

      logger.info(`Emergency meeting triggered for room ${roomCode}, meeting ${meeting._id}`);

      // Emit internal event for other services
      meetingEvents.emit("meeting:started", {
        meetingId: meeting._id.toString(),
        gameId,
        roomCode,
      });
    } catch (error) {
      logger.error("Error triggering meeting:", error);
    }
  }

  /**
   * Manually trigger a meeting (e.g., button press)
   */
  async manualTrigger(gameId: string, playerId: string): Promise<void> {
    const totalTasks = await progressService.getTotalCompletedTasks(gameId);
    await this.triggerMeeting(gameId, totalTasks);
    logger.info(`Manual meeting triggered by player ${playerId} in game ${gameId}`);
  }

  /**
   * End a meeting
   */
  async endMeeting(gameId: string, meetingId: string): Promise<void> {
    try {
      const state = this.sessionStates.get(gameId);
      if (state) {
        state.meetingInProgress = false;
      }

      // Update meeting record
      await MeetingModel.findByIdAndUpdate(meetingId, {
        endedAt: new Date(),
      });

      // Emit to all clients
      const game = await GameModel.findById(gameId).populate("roomId");
      const roomCode = (game?.roomId as any)?.roomCode;

      if (this.io && roomCode) {
        this.io.to(roomCode).emit("MEETING_ENDED", {
          meetingId,
          gameId,
          endedAt: new Date().toISOString(),
        });
      }

      meetingEvents.emit("meeting:ended", { meetingId, gameId });
      logger.info(`Meeting ${meetingId} ended for game ${gameId}`);
    } catch (error) {
      logger.error("Error ending meeting:", error);
    }
  }

  /**
   * Clean up session state when game ends
   */
  cleanupSession(gameId: string): void {
    this.sessionStates.delete(gameId);
  }

  /**
   * Get current meeting state for a session
   */
  getSessionState(gameId: string): SessionMeetingState | undefined {
    return this.sessionStates.get(gameId);
  }
}

export const meetingTriggerService = new MeetingTriggerService();
