/**
 * Game Model
 * 
 * Stores game state and word encryption progress
 */
import { Schema, model, Document, Types } from "mongoose";

export type GamePhase = "TASKS" | "MEETING" | "VOTING" | "ENDED";

export interface IGame extends Document {
  roomId: Types.ObjectId;
  imposterId: Types.ObjectId;
  secretWord: string;
  encryptedWord: string;
  decryptedPercentage: number;
  taskProgress: number;
  lastMeetingTaskCount: number;
  phase: GamePhase;
  round: number;
  meetingStartTime?: Date;
  winner?: "CREWMATE" | "IMPOSTER";
  createdAt: Date;
  updatedAt: Date;
}

const gameSchema = new Schema<IGame>(
  {
    roomId: {
      type: Schema.Types.ObjectId,
      ref: "Room",
      required: true,
      index: true,
    },
    imposterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    secretWord: {
      type: String,
      required: true,
    },
    encryptedWord: {
      type: String,
      required: true,
    },
    decryptedPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    taskProgress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    lastMeetingTaskCount: {
      type: Number,
      default: 0,
    },
    phase: {
      type: String,
      enum: ["TASKS", "MEETING", "VOTING", "ENDED"],
      default: "TASKS",
    },
    round: {
      type: Number,
      default: 1,
    },
    meetingStartTime: {
      type: Date,
    },
    winner: {
      type: String,
      enum: ["CREWMATE", "IMPOSTER"],
    },
  },
  { timestamps: true }
);

export const GameModel = model<IGame>("Game", gameSchema);
