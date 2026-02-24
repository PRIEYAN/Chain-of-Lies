/**
 * Game Log Model
 * 
 * Audit trail for game events
 */
import { Schema, model, Document, Types } from "mongoose";

export interface IGameLog extends Document {
  gameId: Types.ObjectId;
  type:
    | "ROLE_ASSIGNED"
    | "TASK_COMPLETED"
    | "MEETING_STARTED"
    | "VOTE_CAST"
    | "PLAYER_ELIMINATED"
    | "GAME_ENDED";
  metadata: any;
  createdAt: Date;
}

const logSchema = new Schema<IGameLog>(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export const GameLogModel = model<IGameLog>("GameLog", logSchema);
