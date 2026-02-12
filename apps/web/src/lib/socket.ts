import { io, type Socket } from "socket.io-client";

/**
 * Dedicated socket module.
 * We keep it small so UI can import for imperative actions if needed,
 * while useGameSocket() provides a hook-based typed interface.
 */
let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;

  socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
