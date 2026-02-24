/**
 * Meeting Service
 * 
 * Handles meeting chat and message generation
 */
import { Types } from "mongoose";
import { MeetingModel, IMeeting, IMeetingMessage } from "../models/meeting.model";
import { GameModel } from "../../game/models/game.model";
import { RoomModel } from "../../room/models/room.model";
import { logger } from "../../../infrastructure/logging/logger";

const REFERENCE_SENTENCES = [
  "I was in the cafeteria doing tasks",
  "I saw someone near the admin room",
  "I was fixing wiring in electrical",
  "I saw red vent near storage",
  "I was in navigation when the lights went out",
  "I saw someone run past me in the corridor",
  "I was doing tasks in weapons",
  "I saw someone acting suspicious",
  "I was in shields when the meeting was called",
  "I didn't see anything suspicious",
];

export class MeetingService {
  /**
   * Send a message in meeting
   */
  async sendMessage(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId,
    message: string
  ): Promise<IMeetingMessage> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.phase !== "MEETING") {
      throw new Error("Not in meeting phase");
    }

    // Get or create meeting
    let meeting = await MeetingModel.findOne({
      gameId,
      round: game.round,
    });

    if (!meeting) {
      meeting = new MeetingModel({
        gameId,
        round: game.round,
        messages: [],
        startedAt: new Date(),
      });
    }

    // Check if player already sent message
    const existingMessage = meeting.messages.find(
      (m) => (m.playerId as Types.ObjectId).toString() === playerId.toString()
    );

    if (existingMessage) {
      throw new Error("Player already sent message in this meeting");
    }

    // Get player role
    const room = await RoomModel.findById(game.roomId);
    const player = room?.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === playerId.toString()
    );

    if (!player) {
      throw new Error("Player not in game");
    }

    // Generate reference sentence for crewmates
    let finalMessage = message;
    if (player.role === "CREWMATE") {
      const referenceSentence =
        REFERENCE_SENTENCES[
          Math.floor(Math.random() * REFERENCE_SENTENCES.length)
        ];
      finalMessage = `${message} (Reference: ${referenceSentence})`;
    }
    // Imposter messages are sent as-is (no reference)

    // Add message
    const meetingMessage: IMeetingMessage = {
      playerId,
      message: finalMessage,
      createdAt: new Date(),
    };

    meeting.messages.push(meetingMessage);
    await meeting.save();

    logger.info(`Meeting message sent: game=${gameId}, player=${playerId}`);

    return meetingMessage;
  }

  /**
   * Get all messages for current meeting
   */
  async getMeetingMessages(
    gameId: Types.ObjectId
  ): Promise<IMeetingMessage[]> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const meeting = await MeetingModel.findOne({
      gameId,
      round: game.round,
    });

    if (!meeting) {
      return [];
    }

    return meeting.messages;
  }

  /**
   * Generate reference sentence (for crewmates)
   */
  generateReferenceSentence(): string {
    return REFERENCE_SENTENCES[
      Math.floor(Math.random() * REFERENCE_SENTENCES.length)
    ];
  }

  /**
   * Get meeting by game ID
   */
  async getMeeting(gameId: Types.ObjectId): Promise<IMeeting | null> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      return null;
    }

    return MeetingModel.findOne({
      gameId,
      round: game.round,
    });
  }

  /**
   * End meeting
   */
  async endMeeting(gameId: Types.ObjectId): Promise<void> {
    const meeting = await MeetingModel.findOne({
      gameId,
      endedAt: null,
    });

    if (meeting) {
      meeting.endedAt = new Date();
      await meeting.save();
      logger.info(`Meeting ended: game=${gameId}`);
    }
  }
}

export const meetingService = new MeetingService();
