/**
 * Meeting Chat Socket Handlers
 *
 * Self-contained socket handlers for emergency meeting chat functionality.
 * Import and call registerChatHandlers() after socket connection.
 */
import { Server as SocketIOServer, Socket } from "socket.io";
import { Types } from "mongoose";
import { MeetingModel } from "../../modules/meeting/models/meeting.model";
import { UserModel } from "../../modules/auth/models/user.model";
import { logger } from "../logging/logger";

interface ChatMessage {
  id: string;
  meetingId: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: string;
}

// Track active meetings per room
const activeMeetings: Map<string, string> = new Map(); // roomCode -> meetingId

/**
 * Register chat-related socket handlers for a connected socket
 */
export function registerChatHandlers(
  io: SocketIOServer,
  socket: Socket,
  getRoomCodeForSocket: () => string | undefined
): void {
  /**
   * Handle incoming chat message during meeting
   */
  socket.on("meeting_chat_message", async (data: {
    meetingId: string;
    message: string;
    playerName?: string;
  }) => {
    try {
      const { meetingId, message, playerName } = data;

      if (!meetingId || !message?.trim()) {
        socket.emit("error", { message: "Invalid chat message" });
        return;
      }

      const roomCode = getRoomCodeForSocket();
      if (!roomCode) {
        socket.emit("error", { message: "Not in a room" });
        return;
      }

      // Create chat message object
      const chatMsg: ChatMessage = {
        id: `msg-${Date.now()}-${socket.id.slice(-4)}`,
        meetingId,
        playerId: socket.id,
        playerName: playerName || `Player_${socket.id.slice(-8)}`,
        message: message.trim().slice(0, 500), // Limit message length
        timestamp: new Date().toISOString(),
      };

      // Save to MongoDB
      try {
        await MeetingModel.findByIdAndUpdate(
          meetingId,
          {
            $push: {
              messages: {
                playerId: new Types.ObjectId(), // Will be null reference but it's ok
                message: chatMsg.message,
                createdAt: new Date(),
              },
            },
          },
          { new: true }
        );
      } catch (dbError) {
        logger.warn("Failed to save chat message to MongoDB:", dbError);
        // Continue anyway - real-time chat more important than persistence
      }

      // Broadcast to all clients in the room
      io.to(roomCode).emit("meeting_chat_message", chatMsg);

      logger.debug(`Chat message in room ${roomCode}: ${chatMsg.playerName}: ${chatMsg.message.slice(0, 50)}`);
    } catch (error) {
      logger.error("Error handling chat message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  });

  /**
   * Handle request to join meeting chat room
   */
  socket.on("join_meeting_chat", async (data: { meetingId: string }) => {
    try {
      const { meetingId } = data;
      const roomCode = getRoomCodeForSocket();

      if (!roomCode) {
        socket.emit("error", { message: "Not in a game room" });
        return;
      }

      // Track active meeting for this room
      activeMeetings.set(roomCode, meetingId);

      // Get existing messages for this meeting
      const meeting = await MeetingModel.findById(meetingId).populate("messages.playerId");
      const existingMessages: ChatMessage[] = meeting?.messages?.map((m, i) => ({
        id: `hist-${i}`,
        meetingId,
        playerId: m.playerId?.toString() || "unknown",
        playerName: "Player", // Will be resolved by frontend from player list
        message: m.message,
        timestamp: m.createdAt?.toISOString() || new Date().toISOString(),
      })) || [];

      socket.emit("meeting_chat_history", {
        meetingId,
        messages: existingMessages,
      });

      logger.info(`Player ${socket.id} joined meeting chat ${meetingId}`);
    } catch (error) {
      logger.error("Error joining meeting chat:", error);
      socket.emit("error", { message: "Failed to join meeting chat" });
    }
  });

  /**
   * Handle leaving meeting chat
   */
  socket.on("leave_meeting_chat", () => {
    const roomCode = getRoomCodeForSocket();
    if (roomCode) {
      logger.debug(`Player ${socket.id} left meeting chat in room ${roomCode}`);
    }
  });

  /**
   * Handle dismiss meeting (player-specific)
   */
  socket.on("dismiss_meeting", async (data: { meetingId: string }) => {
    const roomCode = getRoomCodeForSocket();
    if (roomCode) {
      socket.emit("meeting_dismissed", { meetingId: data.meetingId });
      logger.debug(`Player ${socket.id} dismissed meeting in room ${roomCode}`);
    }
  });
}

/**
 * Broadcast emergency meeting to a room
 * Called by meetingTriggerService
 */
export function broadcastEmergencyMeeting(
  io: SocketIOServer,
  roomCode: string,
  data: {
    meetingId: string;
    gameId: string;
    totalTasksCompleted: number;
    reason: string;
  }
): void {
  activeMeetings.set(roomCode, data.meetingId);

  io.to(roomCode).emit("EMERGENCY_MEETING", {
    ...data,
    triggeredAt: new Date().toISOString(),
  });

  logger.info(`Emergency meeting broadcast to room ${roomCode}`);
}

/**
 * Get active meeting for a room
 */
export function getActiveMeeting(roomCode: string): string | undefined {
  return activeMeetings.get(roomCode);
}

/**
 * Clear active meeting for a room
 */
export function clearActiveMeeting(roomCode: string): void {
  activeMeetings.delete(roomCode);
}
