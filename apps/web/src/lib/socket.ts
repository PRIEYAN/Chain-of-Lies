import { io, type Socket } from "socket.io-client";

/**
 * Dedicated socket module.
 * We keep it small so UI can import for imperative actions if needed,
 * while useGameSocket() provides a hook-based typed interface.
 */
let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export function getSocket() {
  if (socket) return socket;

  socket = io(SOCKET_URL, {
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
