/**
 * WebSocket server initialization for real-time multiplayer communication
 */
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { logger } from "../logging/logger";

interface ExtendedWebSocket extends WebSocket {
  roomId?: string;
  playerId?: string;
  isAlive?: boolean;
}

const rooms = new Map<string, Set<ExtendedWebSocket>>();

export function initializeWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws: ExtendedWebSocket) => {
    ws.isAlive = true;
    logger.info("WebSocket client connected");

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (err) {
        logger.error("Failed to parse WebSocket message:", err);
      }
    });

    ws.on("close", () => {
      handleDisconnect(ws);
      logger.info("WebSocket client disconnected");
    });

    ws.on("error", (err) => {
      logger.error("WebSocket error:", err);
    });
  });

  // Heartbeat to detect dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  return wss;
}

function handleMessage(ws: ExtendedWebSocket, message: unknown) {
  // Message routing will be implemented based on game domain events
  logger.debug("Received message:", message);
}

function handleDisconnect(ws: ExtendedWebSocket) {
  if (ws.roomId) {
    const room = rooms.get(ws.roomId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) {
        rooms.delete(ws.roomId);
      }
    }
  }
}

export function broadcastToRoom(roomId: string, message: unknown) {
  const room = rooms.get(roomId);
  if (room) {
    const data = JSON.stringify(message);
    room.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }
}

export function joinRoom(ws: ExtendedWebSocket, roomId: string, playerId: string) {
  ws.roomId = roomId;
  ws.playerId = playerId;
  
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Set());
  }
  rooms.get(roomId)!.add(ws);
}
