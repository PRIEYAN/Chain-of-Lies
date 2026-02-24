/**
 * Room Controller
 */
import { Request, Response } from "express";
import { roomService } from "../services/room.service";
import { AuthenticatedRequest } from "../../auth/middlewares/jwt.middleware";

export class RoomController {
  /**
   * Create a new room
   */
  async createRoom(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { name, maxPlayers } = req.body;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      const room = await roomService.createRoom(
        authReq.userId as any,
        name || "Host",
        maxPlayers || 20
      );

      res.json({
        id: room._id,
        roomCode: room.roomCode,
        hostId: room.host,
        maxPlayers: room.maxPlayers,
        players: room.players,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Join a room
   */
  async joinRoom(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const { roomCode } = req.body;

      if (!authReq.userId) {
        res.status(401).json({ error: "Not authenticated" });
        return;
      }

      if (!roomCode) {
        res.status(400).json({ error: "roomCode is required" });
        return;
      }

      const room = await roomService.joinRoom(
        roomCode,
        authReq.userId as any,
        "" // Socket ID will be set when socket connects
      );

      res.json({
        id: room._id,
        roomCode: room.roomCode,
        hostId: room.host,
        players: room.players,
        status: room.status,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  /**
   * Get room by code
   */
  async getRoom(req: Request, res: Response): Promise<void> {
    try {
      const { roomCode } = req.params;
      const room = await roomService.getRoomByCode(roomCode);
      res.json({
        id: room._id,
        roomCode: room.roomCode,
        hostId: room.host,
        players: room.players,
        status: room.status,
        maxPlayers: room.maxPlayers,
      });
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  }
}

export const roomController = new RoomController();
