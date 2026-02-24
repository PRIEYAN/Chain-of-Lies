/**
 * Shared Socket.IO Instance
 * 
 * IMPORTANT: This is the ONLY socket instance in the entire application.
 * DO NOT create additional socket connections anywhere else.
 */
import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket: Socket = io(SOCKET_URL, {
    autoConnect: false, // We'll connect manually when needed
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5,
    timeout: 20000, // 20 second timeout
    forceNew: false,
});

// Debug logging in development
if (import.meta.env.DEV) {
    socket.onAny((event, ...args) => {
        console.log(`[Socket] Event: ${event}`, args);
    });

    socket.on("connect", () => {
        console.log("[Socket] Connected:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.log("[Socket] Disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
        console.error("[Socket] Connection error:", error);
        console.error("[Socket] Attempted URL:", SOCKET_URL);
        console.error("[Socket] Error details:", {
            message: error.message,
            type: error.type,
            description: error.description,
        });
    });
    
    socket.on("reconnect_attempt", (attemptNumber) => {
        console.log(`[Socket] Reconnection attempt ${attemptNumber}...`);
    });
    
    socket.on("reconnect_failed", () => {
        console.error("[Socket] Reconnection failed. Check if backend is running on port 5000");
    });
}
