/**
 * WordBank Model
 * 
 * Stores secret words for games
 */
import { Schema, model, Document } from "mongoose";

export interface IWordBank extends Document {
  word: string;
  category?: string;
  difficulty?: number;
  createdAt: Date;
}

const wordBankSchema = new Schema<IWordBank>(
  {
    word: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    category: String,
    difficulty: Number,
  },
  { timestamps: true }
);

export const WordBankModel = model<IWordBank>("WordBank", wordBankSchema);
