/**
 * Socket.IO Server Implementation
 * 
 * Handles all real-time multiplayer communication using rooms
 */
import { Server as HTTPServer } from "http";
import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
import { logger } from "../logging/logger";
import { gameService } from "../../modules/game/services/game.service";
import { roomService } from "../../modules/room/services/room.service";
import { taskService } from "../../modules/task/services/task.service";
import { TaskModel } from "../../modules/task/models/task.model";
import { meetingService } from "../../modules/meeting/services/meeting.service";
import { voteService } from "../../modules/vote/services/vote.service";
import { RoomModel } from "../../modules/room/models/room.model";
import { UserModel } from "../../modules/auth/models/user.model";

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

// Helper to get or create user from socket/username
async function getOrCreateUser(socketId: string, username: string): Promise<Types.ObjectId> {
    // Use socket ID as wallet address for temporary users (prefixed to avoid conflicts)
    const walletAddress = `socket_${socketId}`.toLowerCase();

    let user = await UserModel.findOne({ walletAddress });
    if (!user) {
        user = new UserModel({
            walletAddress,
            username: username || `Player_${socketId.substring(0, 8)}`,
        });
        await user.save();
        logger.info(`Created temporary user for socket ${socketId}: ${user._id}`);
    }

    return user._id as Types.ObjectId;
}

export function initializeSocketIO(httpServer: HTTPServer) {
    console.log("🔧 Initializing Socket.IO server...");

    const io = new Server(httpServer, {
        cors: {
            origin: process.env.CLIENT_URL || "http://localhost:3000",
            credentials: true,
            methods: ["GET", "POST"],
        },
        path: "/socket.io",
        transports: ["websocket", "polling"],
        allowEIO3: true,
    });

    console.log(`✅ Socket.IO CORS configured for: ${process.env.CLIENT_URL || "http://localhost:3000"}`);

    io.on("connection", (socket: Socket) => {
        console.log(`🔌 New socket connection: ${socket.id}`);
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
            logger.info(`[join_party event] Socket ${socket.id} attempting to join party: ${data.partyCode} as ${data.name}`);
            try {
                // Find party by code
                let targetParty: Party | undefined;
                logger.info(`[join_party] Looking for party with code: ${data.partyCode}, Available parties: ${Array.from(parties.values()).map(p => p.partyCode).join(", ")}`);
                for (const party of parties.values()) {
                    if (party.partyCode === data.partyCode) {
                        targetParty = party;
                        break;
                    }
                }

                if (!targetParty) {
                    logger.warn(`[join_party] Party not found for code: ${data.partyCode}`);
                    socket.emit("error", { message: "Party not found" });
                    return;
                }

                if (Object.keys(targetParty.players).length >= targetParty.maxPlayers) {
                    logger.warn(`[join_party] Party ${targetParty.partyCode} is full`);
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
                logger.info(`[join_party] Player ${data.name} (${socket.id}) successfully joined party ${data.partyCode}. Emitting party_joined event.`);
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

        // Frontend: join_room (maps roomId to partyCode or creates party)
        socket.on("join_room", async (data: { roomId: string; username: string }) => {
            try {
                // Try to find existing room by roomId (treat as partyCode)
                let targetParty: Party | undefined;
                for (const party of parties.values()) {
                    if (party.partyCode === data.roomId.toUpperCase() || party.id === data.roomId) {
                        targetParty = party;
                        break;
                    }
                }

                // If no party found, create one (for backward compatibility)
                if (!targetParty) {
                    const partyCode = data.roomId.length === 6 ? data.roomId.toUpperCase() : generatePartyCode();
                    const partyId = `party-${Date.now()}`;
                    const playerId = socket.id;

                    const player: Player = {
                        id: playerId,
                        name: data.username,
                        x: 278,
                        y: 264,
                        color: generateColor(),
                        isHost: true,
                    };

                    targetParty = {
                        id: partyId,
                        partyCode,
                        hostId: playerId,
                        hostName: data.username,
                        maxPlayers: 8,
                        players: { [playerId]: player },
                        phase: "LOBBY",
                    };

                    parties.set(partyId, targetParty);
                    socketToParty.set(socket.id, partyId);
                    socket.join(partyCode);

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

                    // Also emit player_joined for frontend compatibility
                    io.to(partyCode).emit("player_joined", {
                        id: playerId,
                        username: data.username,
                        isHost: true,
                    });

                    logger.info(`Party created via join_room: ${partyCode} by ${data.username}`);
                    return;
                }

                // Join existing party
                if (Object.keys(targetParty.players).length >= targetParty.maxPlayers) {
                    socket.emit("error", { message: "Room is full" });
                    return;
                }

                const playerId = socket.id;
                const player: Player = {
                    id: playerId,
                    name: data.username,
                    x: 278,
                    y: 264,
                    color: generateColor(),
                    isHost: false,
                };

                targetParty.players[playerId] = player;
                socketToParty.set(socket.id, targetParty.id);
                socket.join(targetParty.partyCode);

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

                io.to(targetParty.partyCode).emit("party_player_update", {
                    players: Object.values(targetParty.players),
                });

                // Emit player_joined for frontend compatibility
                io.to(targetParty.partyCode).emit("player_joined", {
                    id: playerId,
                    username: data.username,
                    isHost: false,
                });

                if (targetParty.phase === "GAME") {
                    socket.emit("game_started");
                }

                logger.info(`${data.username} joined room via join_room: ${targetParty.partyCode}`);
            } catch (error) {
                logger.error("Error in join_room:", error);
                socket.emit("error", { message: "Failed to join room" });
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
        socket.on("start_game", async () => {
            const partyId = socketToParty.get(socket.id);
            if (!partyId) {
                socket.emit("error", { message: "Not in a party" });
                return;
            }

            const party = parties.get(partyId);
            if (!party) {
                socket.emit("error", { message: "Party not found" });
                return;
            }

            // Verify host
            if (party.hostId !== socket.id) {
                socket.emit("error", { message: "Only the host can start the game" });
                return;
            }

            try {
                // Find or create room in database
                let room = await RoomModel.findOne({ roomCode: party.partyCode });
                if (!room) {
                    // Create room from party - need to get/create user for host
                    const hostPlayer = party.players[party.hostId];
                    const hostUserId = await getOrCreateUser(party.hostId, hostPlayer.name);

                    room = await roomService.createRoom(
                        hostUserId,
                        hostPlayer.name,
                        party.maxPlayers,
                        party.hostId
                    );

                    // Update socket data with user ID for host
                    (socket as any).data = { ...((socket as any).data || {}), userId: hostUserId.toString() };
                } // End of if (!room) for creation

                if (!room) {
                    throw new Error("Failed to find or create room");
                }

                // Add all players from party to room (if not already added)
                for (const [socketId, player] of Object.entries(party.players)) {
                    const userId = await getOrCreateUser(socketId, player.name);

                    // Check if player already in room
                    const existingPlayer = room.players.find(
                        (p) => (p.userId as Types.ObjectId).toString() === userId.toString()
                    );

                    if (!existingPlayer) {
                        // Add player to room
                        room.players.push({
                            userId,
                            socketId,
                            isAlive: true,
                        });
                    } else {
                        // Update socket ID for existing player
                        existingPlayer.socketId = socketId;
                    }

                    // Store user ID in socket data
                    const playerSocket = io.sockets.sockets.get(socketId);
                    if (playerSocket) {
                        (playerSocket as any).data = { ...((playerSocket as any).data || {}), userId: userId.toString() };
                    }
                }

                // Save room with all players
                await room.save();
                logger.info(`Room ${room.roomCode} now has ${room.players.length} players`);

                // Start game
                const game = await gameService.startGame(room._id);

                // Update party phase
                party.phase = "GAME";

                // Emit role to each player
                const roomDoc = await RoomModel.findById(room._id).populate("players.userId");
                if (roomDoc) {
                    for (const roomPlayer of roomDoc.players) {
                        const role = roomPlayer.role || "CREWMATE";
                        const socketId = roomPlayer.socketId;

                        // Find socket by socketId (direct lookup)
                        const playerSocket = io.sockets.sockets.get(socketId);
                        if (!playerSocket) {
                            logger.warn(`Socket not found for player ${socketId}`);
                            continue;
                        }

                        playerSocket.emit("role_assigned", {
                            role,
                            encryptedWord: role === "CREWMATE" ? game.encryptedWord : undefined,
                            secretWord: undefined, // Never send secret word to client
                        });

                        // Emit word update to crewmates
                        if (role === "CREWMATE") {
                            playerSocket.emit("word_update", {
                                encryptedWord: game.encryptedWord,
                                decryptedPercentage: game.decryptedPercentage,
                            });
                        }
                    }
                }

                // Notify all players: transition to TASKS phase
                io.to(party.partyCode).emit("game_started", {
                    gameId: game._id,
                    roomId: room._id,
                    imposterId: game.imposterId,
                    phase: "TASKS",
                    round: game.round || 1,
                });

                logger.info(`Game started in party: ${party.partyCode}`);
            } catch (error: any) {
                logger.error("Error starting game:", error);
                socket.emit("error", { message: error.message });
            }
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

        // Frontend: submit_task (maps to task_completed)
        socket.on("submit_task", async (data: { round: number; role: string; payload: Record<string, any> }) => {
            try {
                const partyId = socketToParty.get(socket.id);
                if (!partyId) {
                    socket.emit("error", { message: "Not in a game" });
                    return;
                }

                const party = parties.get(partyId);
                if (!party || party.phase !== "GAME") {
                    socket.emit("error", { message: "Game not active" });
                    return;
                }

                const userId = (socket as any).data?.userId || socket.id;
                const taskId = (data.payload as any)?.taskId || (data.payload as any)?.id || "unknown";
                const points = (data.payload as any)?.points || (data as any).points || 10;

                // Get player position from party
                const player = party.players[socket.id];
                const playerX = player?.x || 0;
                const playerY = player?.y || 0;

                // Find room and game
                const room = await RoomModel.findOne({ roomCode: party.partyCode });
                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                const game = await gameService.getInMemoryState(room._id);
                if (!game) {
                    socket.emit("error", { message: "Game not found" });
                    return;
                }

                // Complete task using task service
                const result = await taskService.completeTask(
                    taskId as any,
                    userId as any,
                    playerX,
                    playerY,
                    points
                );

                // Fetch task and user info for richer update
                try {
                    // resolve task doc by id or name
                    let taskDoc: any = null;
                    try {
                        if (Types.ObjectId.isValid(taskId)) taskDoc = await TaskModel.findById(taskId);
                    } catch (e) { taskDoc = null; }
                    if (!taskDoc && typeof taskId === 'string') {
                        taskDoc = await TaskModel.findOne({ playerId: userId, name: taskId });
                    }
                    const userDoc = await UserModel.findById(userId);
                    io.to(party.partyCode).emit("task_update", {
                        taskId,
                        completed: true,
                        playerId: userId?.toString() || null,
                        playerSocketId: socket.id,
                        playerName: userDoc?.username || party.players[socket.id]?.name || null,
                        taskName: taskDoc?.name || null,
                        taskProgress: result.taskProgress || 0,
                    });
                } catch (err) {
                    io.to(party.partyCode).emit("task_update", {
                        taskId,
                        completed: true,
                    });
                }

                // Emit state update for frontend
                io.to(party.partyCode).emit("state_updated", {
                    phase: game.phase,
                });

                if (result.shouldStartMeeting) {
                    await gameService.startMeeting(game.gameId);
                    io.to(party.partyCode).emit("meeting_started", { duration: 60 });

                    setTimeout(async () => {
                        await gameService.endMeeting(game.gameId);
                        io.to(party.partyCode).emit("meeting_ended");
                        io.to(party.partyCode).emit("voting_started");
                    }, 60000);
                }

                if (result.encryptedWord) {
                    const roomDoc = await RoomModel.findById(room._id);
                    if (roomDoc) {
                        for (const player of roomDoc.players) {
                            if (player.role === "CREWMATE") {
                                const playerSocket = Array.from(io.sockets.sockets.values()).find(
                                    (s: any) => s.data?.userId === player.userId.toString() || s.id === socket.id
                                );
                                if (playerSocket) {
                                    playerSocket.emit("word_update", {
                                        encryptedWord: result.encryptedWord,
                                        taskProgress: result.taskProgress || 0,
                                    });
                                }
                            }
                        }
                    }
                }

                const winCheck = await gameService.checkWinConditions(game.gameId);
                if (winCheck.gameEnded) {
                    io.to(party.partyCode).emit("game_ended", {
                        winner: winCheck.winner,
                    });
                }
            } catch (error: any) {
                logger.error("Error in submit_task:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Task Completed
        socket.on("task_completed", async (data: { taskId: string; playerX?: number; playerY?: number }) => {
            try {
                const partyId = socketToParty.get(socket.id);
                if (!partyId) {
                    socket.emit("error", { message: "Not in a game" });
                    return;
                }

                const party = parties.get(partyId);
                if (!party || party.phase !== "GAME") {
                    socket.emit("error", { message: "Game not active" });
                    return;
                }

                // Get user ID from socket (should be set during auth)
                const userId = (socket as any).data?.userId;
                if (!userId) {
                    socket.emit("error", { message: "Not authenticated" });
                    return;
                }

                const points = (data as any).points || 10;
                const player = party.players[socket.id];

                // Use provided coordinates OR fall back to last known position from server-side state
                const playerX = data.playerX ?? player?.x ?? 0;
                const playerY = data.playerY ?? player?.y ?? 0;

                const result = await taskService.completeTask(
                    data.taskId as any,
                    userId as any,
                    playerX,
                    playerY,
                    points
                );

                // Emit task update with player/task info
                try {
                    // resolve task doc by id or name
                    let taskDoc: any = null;
                    try {
                        if (Types.ObjectId.isValid(data.taskId)) taskDoc = await TaskModel.findById(data.taskId);
                    } catch (e) { taskDoc = null; }
                    if (!taskDoc && typeof data.taskId === 'string') {
                        taskDoc = await TaskModel.findOne({ playerId: userId, name: data.taskId });
                    }
                    const userDoc = await UserModel.findById(userId);
                    io.to(party.partyCode).emit("task_update", {
                        taskId: data.taskId,
                        completed: true,
                        playerId: userId?.toString() || null,
                        playerSocketId: socket.id,
                        playerName: userDoc?.username || null,
                        taskName: taskDoc?.name || null,
                        taskProgress: result.taskProgress || 0,
                    });
                } catch (err) {
                    logger.error("Error fetching task/user details for update:", err);
                    // Still notify about completion at least
                    io.to(party.partyCode).emit("task_update", {
                        taskId: data.taskId,
                        completed: true,
                        taskProgress: result.taskProgress || 0,
                    });
                }

                // If meeting should start
                if (result.shouldStartMeeting) {
                    const room = await RoomModel.findOne({ roomCode: party.partyCode });
                    if (room) {
                        const game = await gameService.getGameByRoomId(room._id);
                        if (game) {
                            await gameService.startMeeting(game._id);
                            io.to(party.partyCode).emit("meeting_started", { duration: 60 });

                            // Auto-end meeting after 60 seconds
                            setTimeout(async () => {
                                await gameService.endMeeting(game._id);
                                io.to(party.partyCode).emit("meeting_ended");
                                io.to(party.partyCode).emit("voting_started");
                            }, 60000);
                        }
                    }
                }

                // Emit word update if needed
                if (result.encryptedWord) {
                    const room = await RoomModel.findOne({ roomCode: party.partyCode });
                    if (room) {
                        const roomDoc = await RoomModel.findById(room._id);
                        if (roomDoc) {
                            for (const player of roomDoc.players) {
                                if (player.role === "CREWMATE") {
                                    const playerSocket = Array.from(io.sockets.sockets.values()).find(
                                        (s: any) => s.data?.userId === player.userId.toString()
                                    );
                                    if (playerSocket) {
                                        playerSocket.emit("word_update", {
                                            encryptedWord: result.encryptedWord,
                                            taskProgress: result.taskProgress || 0,
                                        });
                                    }
                                } else if (player.role === "IMPOSTER" && result.decryptedPercentage !== undefined) {
                                    const playerSocket = Array.from(io.sockets.sockets.values()).find(
                                        (s: any) => s.data?.userId === player.userId.toString()
                                    );
                                    if (playerSocket) {
                                        playerSocket.emit("word_update", {
                                            decryptedPercentage: result.decryptedPercentage,
                                            taskProgress: result.taskProgress,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                // Check win conditions
                const room = await RoomModel.findOne({ roomCode: party.partyCode });
                if (room) {
                    const game = await gameService.getInMemoryState(room._id);
                    if (game) {
                        const winCheck = await gameService.checkWinConditions(game.gameId);
                        if (winCheck.gameEnded) {
                            io.to(party.partyCode).emit("game_ended", {
                                winner: winCheck.winner,
                            });
                        }
                    }
                }
            } catch (error: any) {
                logger.error("Error completing task:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Frontend: chat_message (maps to meeting_message)
        socket.on("chat_message", async (data: { message: string; at: string }) => {
            try {
                const partyId = socketToParty.get(socket.id);
                if (!partyId) {
                    socket.emit("error", { message: "Not in a game" });
                    return;
                }

                const party = parties.get(partyId);
                if (!party || party.phase !== "GAME") {
                    socket.emit("error", { message: "Game not active" });
                    return;
                }

                const userId = (socket as any).data?.userId || socket.id;
                const room = await RoomModel.findOne({ roomCode: party.partyCode });
                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                const game = await gameService.getInMemoryState(room._id);
                if (!game) {
                    socket.emit("error", { message: "Game not found" });
                    return;
                }

                const meetingMessage = await meetingService.sendMessage(
                    game.gameId as any,
                    userId as any,
                    data.message
                );

                // Emit to all players in the game
                io.to(party.partyCode).emit("chat_message", {
                    playerId: userId,
                    message: meetingMessage.message,
                    timestamp: meetingMessage.createdAt.getTime(),
                    at: data.at,
                });
            } catch (error: any) {
                logger.error("Error in chat_message:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Meeting Message
        socket.on("meeting_message", async (data: { gameId: string; message: string }) => {
            try {
                const userId = (socket as any).data?.userId;
                if (!userId) {
                    socket.emit("error", { message: "Not authenticated" });
                    return;
                }

                const meetingMessage = await meetingService.sendMessage(
                    data.gameId as any,
                    userId as any,
                    data.message
                );

                // Emit to all players in the game
                const room = await RoomModel.findOne({
                    "players.userId": userId
                });
                if (room) {
                    io.to(room.roomCode).emit("meeting_message", {
                        playerId: userId,
                        message: meetingMessage.message,
                        timestamp: meetingMessage.createdAt.getTime(),
                    });
                }
            } catch (error: any) {
                logger.error("Error sending meeting message:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Frontend: cast_vote (maps to vote)
        socket.on("cast_vote", async (data: { round: number; targetPlayerId: string | null }) => {
            try {
                const partyId = socketToParty.get(socket.id);
                if (!partyId) {
                    socket.emit("error", { message: "Not in a game" });
                    return;
                }

                const party = parties.get(partyId);
                if (!party || party.phase !== "GAME") {
                    socket.emit("error", { message: "Game not active" });
                    return;
                }

                const userId = (socket as any).data?.userId || socket.id;
                const room = await RoomModel.findOne({ roomCode: party.partyCode });
                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                const game = await gameService.getInMemoryState(room._id);
                if (!game) {
                    socket.emit("error", { message: "Game not found" });
                    return;
                }

                const isSkip = !data.targetPlayerId;
                await voteService.castVote(
                    game.gameId as any,
                    userId as any,
                    data.targetPlayerId as any,
                    isSkip
                );

                // Emit vote cast confirmation
                socket.emit("voteCast", {
                    voterId: userId,
                });

                // Check if all voted and tally
                const gameDoc = await gameService.getGameByRoomId(room._id);
                if (gameDoc) {
                    const winCheck = await gameService.checkWinConditions(gameDoc._id);
                    if (winCheck.gameEnded) {
                        io.to(party.partyCode).emit("game_ended", {
                            winner: winCheck.winner,
                        });
                    } else {
                        const breakdown = await voteService.getVoteBreakdown(gameDoc._id);
                        const roomDoc = await RoomModel.findById(room._id);
                        if (roomDoc) {
                            for (const player of roomDoc.players) {
                                if (player.role === "IMPOSTER") {
                                    const playerSocket = Array.from(io.sockets.sockets.values()).find(
                                        (s: any) => s.data?.userId === player.userId.toString() || s.id === socket.id
                                    );
                                    if (playerSocket) {
                                        playerSocket.emit("voting_results", {
                                            voteBreakdown: breakdown,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error: any) {
                logger.error("Error in cast_vote:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Vote
        socket.on("vote", async (data: { gameId: string; votedFor?: string; isSkip?: boolean }) => {
            try {
                const userId = (socket as any).data?.userId;
                if (!userId) {
                    socket.emit("error", { message: "Not authenticated" });
                    return;
                }

                await voteService.castVote(
                    data.gameId as any,
                    userId as any,
                    data.votedFor as any,
                    data.isSkip || false
                );

                // Check if all voted (tally happens in service)
                const room = await RoomModel.findOne({
                    "players.userId": userId
                });
                if (room) {
                    const gameDoc = await gameService.getGameByRoomId(room._id);
                    if (gameDoc) {
                        // Tally will be called automatically when all voted
                        // Emit results after tally
                        const winCheck = await gameService.checkWinConditions(gameDoc._id);
                        if (winCheck.gameEnded) {
                            io.to(room.roomCode).emit("game_ended", {
                                winner: winCheck.winner,
                            });
                        } else {
                            // Get vote breakdown for imposter
                            const breakdown = await voteService.getVoteBreakdown(gameDoc._id);
                            const roomDoc = await RoomModel.findById(room._id);
                            if (roomDoc) {
                                for (const player of roomDoc.players) {
                                    if (player.role === "IMPOSTER") {
                                        const playerSocket = Array.from(io.sockets.sockets.values()).find(
                                            (s: any) => s.data?.userId === player.userId.toString()
                                        );
                                        if (playerSocket) {
                                            playerSocket.emit("voting_results", {
                                                voteBreakdown: breakdown,
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (error: any) {
                logger.error("Error casting vote:", error);
                socket.emit("error", { message: error.message });
            }
        });

        // Frontend: call_emergency (starts emergency meeting)
        socket.on("call_emergency", async (data: { reason?: string }) => {
            try {
                const partyId = socketToParty.get(socket.id);
                if (!partyId) {
                    socket.emit("error", { message: "Not in a game" });
                    return;
                }

                const party = parties.get(partyId);
                if (!party || party.phase !== "GAME") {
                    socket.emit("error", { message: "Game not active" });
                    return;
                }

                const room = await RoomModel.findOne({ roomCode: party.partyCode });
                if (!room) {
                    socket.emit("error", { message: "Room not found" });
                    return;
                }

                const game = await gameService.getInMemoryState(room._id);
                if (!game) {
                    socket.emit("error", { message: "Game not found" });
                    return;
                }

                // Start emergency meeting
                await gameService.startMeeting(game.gameId);
                io.to(party.partyCode).emit("meeting_started", {
                    duration: 60,
                    reason: data.reason || "Emergency meeting called",
                });

                // Auto-end meeting after 60 seconds
                setTimeout(async () => {
                    await gameService.endMeeting(game.gameId);
                    io.to(party.partyCode).emit("meeting_ended");
                    io.to(party.partyCode).emit("voting_started");
                }, 60000);

                logger.info(`Emergency meeting called in party: ${party.partyCode}`);
            } catch (error: any) {
                logger.error("Error in call_emergency:", error);
                socket.emit("error", { message: error.message });
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

        const playerId = socket.id;

        // Remove player
        delete party.players[socket.id];
        socketToParty.delete(socket.id);

        // Emit player_left for frontend compatibility
        io.to(party.partyCode).emit("player_left", {
            playerId: playerId,
        });

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
                players: Object.values(party.players),
            });
        }
    }

    logger.info("Socket.IO server initialized");
    console.log("✅ Socket.IO server ready");
    console.log(`🔌 WebSocket endpoint: ws://localhost:${process.env.PORT || 5000}/socket.io`);
    console.log("");
    return io;
}
