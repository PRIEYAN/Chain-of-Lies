/**
 * Socket.IO Server Implementation
 * 
 * Handles all real-time multiplayer communication using rooms
 */
import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { logger } from "../logging/logger";

interface Player {
    id: string;
    name: string;
    x: number;
    y: number;
    color: string;
    isHost: boolean;
}

interface Party {
    id: string;
    partyCode: string;
    hostId: string;
    hostName: string;
    maxPlayers: number;
    players: Record<string, Player>;
    phase: "LOBBY" | "GAME";
}

// In-memory storage (replace with database in production)
const parties: Map<string, Party> = new Map();
const socketToParty: Map<string, string> = new Map();
const lastBroadcast: Map<string, number> = new Map();
const BROADCAST_THROTTLE = 33; // ~30fps

// Helper to generate party code
function generatePartyCode(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Helper to generate random color
function generateColor(): string {
    const colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A",
        "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2",
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

export function initializeSocketIO(httpServer: HTTPServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            credentials: true,
        },
        path: "/socket.io",
    });

    io.on("connection", (socket: Socket) => {
        logger.info(`Socket connected: ${socket.id}`);

        // ========================================
        // LOBBY EVENTS
        // ========================================

        // Create Party
        socket.on("create_party", (data: { name: string }) => {
            try {
                const partyCode = generatePartyCode();
                const partyId = `party-${Date.now()}`;
                const playerId = socket.id;

                const player: Player = {
                    id: playerId,
                    name: data.name,
                    x: 278,
                    y: 264,
                    color: generateColor(),
                    isHost: true,
                };

                const party: Party = {
                    id: partyId,
                    partyCode,
                    hostId: playerId,
                    hostName: data.name,
                    maxPlayers: 8,
                    players: { [playerId]: player },
                    phase: "LOBBY",
                };

                parties.set(partyId, party);
                socketToParty.set(socket.id, partyId);

                // Join socket room
                socket.join(partyCode);

                // Send party joined event
                socket.emit("party_joined", {
                    party: {
                        id: party.id,
                        partyCode: party.partyCode,
                        hostId: party.hostId,
                        hostName: party.hostName,
                        maxPlayers: party.maxPlayers,
                    },
                    players: Object.values(party.players),
                    localPlayerId: playerId,
                });

                logger.info(`Party created: ${partyCode} by ${data.name}`);
            } catch (error) {
                logger.error("Error creating party:", error);
                socket.emit("error", { message: "Failed to create party" });
            }
        });

        // Join Party
        socket.on("join_party", (data: { partyCode: string; name: string }) => {
            try {
                // Find party by code
                let targetParty: Party | undefined;
                for (const party of parties.values()) {
                    if (party.partyCode === data.partyCode) {
                        targetParty = party;
                        break;
                    }
                }

                if (!targetParty) {
                    socket.emit("error", { message: "Party not found" });
                    return;
                }

                if (Object.keys(targetParty.players).length >= targetParty.maxPlayers) {
                    socket.emit("error", { message: "Party is full" });
                    return;
                }

                const playerId = socket.id;
                const player: Player = {
                    id: playerId,
                    name: data.name,
                    x: 278,
                    y: 264,
                    color: generateColor(),
                    isHost: false,
                };

                targetParty.players[playerId] = player;
                socketToParty.set(socket.id, targetParty.id);

                // Join socket room
                socket.join(data.partyCode);

                // Send party joined to the joining player
                socket.emit("party_joined", {
                    party: {
                        id: targetParty.id,
                        partyCode: targetParty.partyCode,
                        hostId: targetParty.hostId,
                        hostName: targetParty.hostName,
                        maxPlayers: targetParty.maxPlayers,
                    },
                    players: Object.values(targetParty.players),
                    localPlayerId: playerId,
                });

                // Notify all players in the party about the update
                io.to(data.partyCode).emit("party_player_update", {
                    players: Object.values(targetParty.players),
                });

                // If game already started, automatically transition this player to game
                if (targetParty.phase === "GAME") {
                    socket.emit("game_started");
                }

                logger.info(`${data.name} joined party: ${data.partyCode}`);
            } catch (error) {
                logger.error("Error joining party:", error);
                socket.emit("error", { message: "Failed to join party" });
            }
        });

        // Leave Party
        socket.on("leave_party", () => {
            handlePlayerLeave(socket);
        });

        // Get Parties (for party list)
        socket.on("get_parties", () => {
            const partyList = Array.from(parties.values()).map((party) => ({
                id: party.id,
                partyCode: party.partyCode,
                hostName: party.hostName,
                playerCount: Object.keys(party.players).length,
                maxPlayers: party.maxPlayers,
            }));

            socket.emit("party_list_updated", { parties: partyList });
        });

        // Start Game
        socket.on("start_game", () => {
            const partyId = socketToParty.get(socket.id);
            if (!partyId) return;

            const party = parties.get(partyId);
            if (!party) return;

            // Verify host
            if (party.hostId !== socket.id) {
                socket.emit("error", { message: "Only the host can start the game" });
                return;
            }

            party.phase = "GAME";

            // Notify all players in the room
            io.to(party.partyCode).emit("game_started");

            logger.info(`Game started in party: ${party.partyCode}`);
        });

        // ========================================
        // GAME EVENTS
        // ========================================

        // Player Move
        socket.on("player_move", (data: { x: number; y: number }) => {
            const partyId = socketToParty.get(socket.id);
            if (!partyId) return;

            const party = parties.get(partyId);
            if (!party) return;

            const player = party.players[socket.id];
            if (!player) return;

            // Update player position
            player.x = data.x;
            player.y = data.y;

            // Throttle broadcasts to reduce network traffic
            const now = Date.now();
            const lastTime = lastBroadcast.get(party.partyCode) || 0;
            
            if (now - lastTime >= BROADCAST_THROTTLE) {
                lastBroadcast.set(party.partyCode, now);
                
                // Broadcast to all players in the room
                io.to(party.partyCode).emit("players_update", {
                    players: party.players,
                });
            }
        });

        // Leave Game
        socket.on("leave_game", () => {
            handlePlayerLeave(socket);
        });

        // ========================================
        // DISCONNECT
        // ========================================

        socket.on("disconnect", () => {
            handlePlayerLeave(socket);
            logger.info(`Socket disconnected: ${socket.id}`);
        });
    });

    // Helper function to handle player leaving
    function handlePlayerLeave(socket: Socket) {
        const partyId = socketToParty.get(socket.id);
        if (!partyId) return;

        const party = parties.get(partyId);
        if (!party) return;

        // Remove player
        delete party.players[socket.id];
        socketToParty.delete(socket.id);

        // If party is empty, delete it
        if (Object.keys(party.players).length === 0) {
            parties.delete(partyId);
            logger.info(`Party deleted: ${party.partyCode}`);
            return;
        }

        // If host left, assign new host
        if (party.hostId === socket.id) {
            const newHostId = Object.keys(party.players)[0];
            party.hostId = newHostId;
            party.players[newHostId].isHost = true;
            party.hostName = party.players[newHostId].name;
            logger.info(`New host assigned in party ${party.partyCode}: ${party.hostName}`);
        }

        // Notify remaining players
        io.to(party.partyCode).emit("party_player_update", {
            players: Object.values(party.players),
        });

        if (party.phase === "GAME") {
            io.to(party.partyCode).emit("players_update", {
                players: party.players,
            });
        }
    }

    logger.info("Socket.IO server initialized");
    return io;
}
