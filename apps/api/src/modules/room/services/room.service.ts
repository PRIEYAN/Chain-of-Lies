/**
 * Room Service
 * 
 * Handles room/lobby management
 */
import { Types } from "mongoose";
import { RoomModel, IRoom, RoomStatus } from "../models/room.model";
import { UserModel } from "../../auth/models/user.model";
import { logger } from "../../../infrastructure/logging/logger";

export class RoomService {
  /**
   * Generate unique room code
   */
  private generateRoomCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a new room
   */
  async createRoom(
    hostId: Types.ObjectId,
    hostName: string,
    maxPlayers: number = 20,
    hostSocketId?: string
  ): Promise<IRoom> {
    // Generate unique room code
    let roomCode: string;
    let exists = true;
    while (exists) {
      roomCode = this.generateRoomCode();
      const existing = await RoomModel.findOne({ roomCode });
      exists = !!existing;
    }

    const room = new RoomModel({
      roomCode: roomCode!,
      host: hostId,
      players: [
        {
          userId: hostId,
          socketId: hostSocketId || "", // Will be set when socket connects if not provided
          isAlive: true,
        },
      ],
      status: "WAITING",
      maxPlayers,
    });

    await room.save();
    logger.info(`Room created: ${roomCode} by ${hostName}`);
    return room;
  }

  /**
   * Join an existing room
   */
  async joinRoom(
    roomCode: string,
    userId: Types.ObjectId,
    socketId: string
  ): Promise<IRoom> {
    const room = await RoomModel.findOne({ roomCode: roomCode.toUpperCase() });
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "WAITING") {
      throw new Error("Room is not accepting new players");
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error("Room is full");
    }

    // Check if player already in room
    const existingPlayer = room.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === userId.toString()
    );
    if (existingPlayer) {
      existingPlayer.socketId = socketId;
      await room.save();
      return room;
    }

    // Add player to room
    room.players.push({
      userId,
      socketId,
      isAlive: true,
    });

    await room.save();
    logger.info(`Player ${userId} joined room ${roomCode}`);
    return room;
  }

  /**
   * Get room by ID
   */
  async getRoom(roomId: Types.ObjectId): Promise<IRoom> {
    const room = await RoomModel.findById(roomId).populate("players.userId");
    if (!room) {
      throw new Error("Room not found");
    }
    return room;
  }

  /**
   * Get room by code
   */
  async getRoomByCode(roomCode: string): Promise<IRoom> {
    const room = await RoomModel.findOne({ roomCode: roomCode.toUpperCase() })
      .populate("players.userId")
      .populate("host");
    if (!room) {
      throw new Error("Room not found");
    }
    return room;
  }

  /**
   * Update room status
   */
  async updateRoomStatus(
    roomId: Types.ObjectId,
    status: RoomStatus
  ): Promise<void> {
    await RoomModel.findByIdAndUpdate(roomId, { status });
    logger.info(`Room ${roomId} status updated to ${status}`);
  }

  /**
   * Remove player from room
   */
  async removePlayer(
    roomId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<void> {
    const room = await RoomModel.findById(roomId);
    if (!room) {
      return;
    }

    room.players = room.players.filter(
      (p) => (p.userId as Types.ObjectId).toString() !== userId.toString()
    );

    // If host left, assign new host
    if (room.host.toString() === userId.toString() && room.players.length > 0) {
      room.host = room.players[0].userId as Types.ObjectId;
    }

    await room.save();
    logger.info(`Player ${userId} removed from room ${roomId}`);
  }

  /**
   * Update player socket ID
   */
  async updatePlayerSocket(
    roomId: Types.ObjectId,
    userId: Types.ObjectId,
    socketId: string
  ): Promise<void> {
    const room = await RoomModel.findById(roomId);
    if (!room) {
      return;
    }

    const player = room.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === userId.toString()
    );
    if (player) {
      player.socketId = socketId;
      await room.save();
    }
  }

  /**
   * Check if user is host
   */
  async isHost(roomId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
    const room = await RoomModel.findById(roomId);
    if (!room) {
      return false;
    }
    return room.host.toString() === userId.toString();
  }
}

export const roomService = new RoomService();
