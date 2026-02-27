/**
 * Player Progress Model
 *
 * Tracks aggregated player progress across games for analytics and dashboards.
 * This complements the existing TaskModel by providing a denormalized view.
 */
import { Schema, model, Document, Types } from "mongoose";

export interface ITaskCompletion {
  taskId: Types.ObjectId;
  taskName: string;
  taskKey?: string;
  completedAt: Date;
  points: number;
}

export interface IPlayerProgress extends Document {
  playerId: Types.ObjectId;
  playerName: string;
  sessionId: Types.ObjectId; // References Game._id
  roomCode: string;
  role: "CREWMATE" | "IMPOSTER";
  isAlive: boolean;
  tasksCompleted: ITaskCompletion[];
  tasksCompletedCount: number;
  totalPoints: number;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskCompletionSchema = new Schema<ITaskCompletion>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: "Task", required: true },
    taskName: { type: String, required: true },
    taskKey: { type: String },
    completedAt: { type: Date, default: Date.now },
    points: { type: Number, default: 0 },
  },
  { _id: false }
);

const playerProgressSchema = new Schema<IPlayerProgress>(
  {
    playerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    playerName: {
      type: String,
      required: true,
    },
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    roomCode: {
      type: String,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["CREWMATE", "IMPOSTER"],
      required: true,
    },
    isAlive: {
      type: Boolean,
      default: true,
    },
    tasksCompleted: [taskCompletionSchema],
    tasksCompletedCount: {
      type: Number,
      default: 0,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
playerProgressSchema.index({ sessionId: 1, playerId: 1 }, { unique: true });

export const PlayerProgressModel = model<IPlayerProgress>(
  "PlayerProgress",
  playerProgressSchema
);
