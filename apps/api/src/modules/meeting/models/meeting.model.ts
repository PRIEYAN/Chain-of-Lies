/**
 * Meeting Model
 * 
 * Stores meeting chat messages
 */
import { Schema, model, Document, Types } from "mongoose";

export interface IMeetingMessage {
  playerId: Types.ObjectId;
  message: string;
  createdAt: Date;
}

export interface IMeeting extends Document {
  gameId: Types.ObjectId;
  round: number;
  messages: IMeetingMessage[];
  startedAt: Date;
  endedAt?: Date;
}

const meetingSchema = new Schema<IMeeting>(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    round: {
      type: Number,
      required: true,
    },
    messages: [
      {
        playerId: { type: Schema.Types.ObjectId, ref: "User" },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: Date,
  },
  { timestamps: true }
);

export const MeetingModel = model<IMeeting>("Meeting", meetingSchema);
