/**
 * Vote Model
 * 
 * Stores voting records
 */
import { Schema, model, Document, Types } from "mongoose";

export interface IVote extends Document {
  gameId: Types.ObjectId;
  voterId: Types.ObjectId;
  votedFor?: Types.ObjectId;
  isSkip: boolean;
  createdAt: Date;
}

const voteSchema = new Schema<IVote>(
  {
    gameId: {
      type: Schema.Types.ObjectId,
      ref: "Game",
      required: true,
      index: true,
    },
    voterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    votedFor: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    isSkip: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

voteSchema.index({ gameId: 1, voterId: 1 }, { unique: true });

export const VoteModel = model<IVote>("Vote", voteSchema);
