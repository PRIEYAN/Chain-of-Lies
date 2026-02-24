/**
 * User Model
 * 
 * Stores wallet addresses and authentication data
 */
import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  walletAddress: string;
  username: string;
  nonce?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    username: {
      type: String,
      required: true,
    },
    nonce: {
      type: String,
    },
  },
  { timestamps: true }
);

export const UserModel = model<IUser>("User", userSchema);
