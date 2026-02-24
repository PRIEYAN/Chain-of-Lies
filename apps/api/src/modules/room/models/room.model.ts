/**
 * Room Model
 * 
 * Represents a game lobby/room
 */
import { Schema, model, Document, Types } from "mongoose";

export type RoomStatus = "WAITING" | "IN_GAME" | "ENDED";

export interface IRoomPlayer {
  userId: Types.ObjectId;
  socketId: string;
  isAlive: boolean;
  role?: "CREWMATE" | "IMPOSTER";
}

export interface IRoom extends Document {
  roomCode: string;
  host: Types.ObjectId;
  players: IRoomPlayer[];
  status: RoomStatus;
  maxPlayers: number;
  createdAt: Date;
  updatedAt: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      index: true,
    },
    host: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    players: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        socketId: { type: String, required: true },
        isAlive: { type: Boolean, default: true },
        role: { type: String, enum: ["CREWMATE", "IMPOSTER"] },
      },
    ],
    status: {
      type: String,
      enum: ["WAITING", "IN_GAME", "ENDED"],
      default: "WAITING",
    },
    maxPlayers: {
      type: Number,
      default: 20,
    },
  },
  { timestamps: true }
);

export const RoomModel = model<IRoom>("Room", roomSchema);
