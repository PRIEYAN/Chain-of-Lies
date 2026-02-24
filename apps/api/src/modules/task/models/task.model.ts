/**
 * Task Model
 * 
 * Stores task assignments and completion status
 */
import { Schema, model, Document, Types } from "mongoose";

export type TaskType = "CREW" | "IMPOSTER";

export interface ITask extends Document {
  gameId: Types.ObjectId;
  playerId: Types.ObjectId;
  type: TaskType;
  name: string;
  taskKey?: string;
  difficulty: number;
  location: {
    x: number;
    y: number;
  };
  completed: boolean;
  points?: number;
  completedAt?: Date;
}

const taskSchema = new Schema<ITask>(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    playerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["CREW", "IMPOSTER"],
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    taskKey: {
      type: String,
      sparse: true,
    },
    difficulty: {
      type: Number,
      default: 1,
    },
    location: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    completed: {
      type: Boolean,
      default: false,
    },
    points: {
      type: Number,
      default: 0,
    },
    completedAt: Date,
  },
  { timestamps: true }
);

export const TaskModel = model<ITask>("Task", taskSchema);
