/**
 * Game Service
 * 
 * Core game logic: role assignment, word management, phase transitions
 */
import { Types } from "mongoose";
import { GameModel, IGame, GamePhase } from "../models/game.model";
import { RoomModel, IRoom } from "../../room/models/room.model";
import { WordBankModel } from "../models/wordbank.model";
import { TaskModel } from "../../task/models/task.model";
import { GameLogModel } from "../../shared/models/log.model";
import {
  initializeEncryption,
  encryptWord,
  decryptWord,
  EncryptionState,
} from "../utils/encryption.util";
import { logger } from "../../../infrastructure/logging/logger";

// In-memory game state for performance
interface InMemoryGameState {
  gameId: Types.ObjectId;
  roomId: Types.ObjectId;
  phase: GamePhase;
  encryptionState: EncryptionState;
  crewTasksCompleted: number;
  imposterTasksCompleted: number;
  alivePlayers: Set<Types.ObjectId>;
}

const gameStates = new Map<string, InMemoryGameState>();

export class GameService {
  /**
   * Start a new game: assign roles, select word, create tasks
   */
  async startGame(roomId: Types.ObjectId): Promise<IGame> {
    const room = await RoomModel.findById(roomId).populate("players.userId");
    if (!room) {
      throw new Error("Room not found");
    }

    if (room.players.length < 2) {
      throw new Error("Need at least 2 players to start");
    }

    // Select random imposter
    const players = room.players;
    const imposterIndex = Math.floor(Math.random() * players.length);
    const imposter = players[imposterIndex];

    // Assign roles
    for (let i = 0; i < players.length; i++) {
      players[i].role = i === imposterIndex ? "IMPOSTER" : "CREWMATE";
      players[i].isAlive = true;
    }
    await room.save();

    // Get random word from wordbank
    const wordCount = await WordBankModel.countDocuments();
    if (wordCount === 0) {
      throw new Error("No words in wordbank. Please add words first.");
    }
    const randomIndex = Math.floor(Math.random() * wordCount);
    const wordDoc = await WordBankModel.findOne().skip(randomIndex);
    if (!wordDoc) {
      throw new Error("Failed to get word from wordbank");
    }

    const secretWord = wordDoc.word;
    const encryptionState = initializeEncryption(secretWord);

    // Create game document
    const game = new GameModel({
      roomId,
      imposterId: imposter.userId,
      secretWord,
      encryptedWord: encryptionState.encryptedWord,
      decryptedPercentage: 0,
      phase: "TASKS",
      round: 1,
    });
    await game.save();

    // Create tasks
    await this.createTasks(game._id, roomId, players);

    // Initialize in-memory state
    gameStates.set(roomId.toString(), {
      gameId: game._id,
      roomId,
      phase: "TASKS",
      encryptionState,
      crewTasksCompleted: 0,
      imposterTasksCompleted: 0,
      alivePlayers: new Set(players.map((p) => p.userId as Types.ObjectId)),
    });

    // Log role assignment
    await GameLogModel.create({
      gameId: game._id,
      type: "ROLE_ASSIGNED",
      metadata: {
        imposterId: imposter.userId,
        totalPlayers: players.length,
      },
    });

    logger.info(`Game started: room=${roomId}, imposter=${imposter.userId}`);

    return game;
  }

  /**
   * Create tasks for all players
   */
  private async createTasks(
    gameId: Types.ObjectId,
    roomId: Types.ObjectId,
    players: IRoom["players"]
  ): Promise<void> {
    const crewTasks = [
      "Fix Wiring",
      "Download Data",
      "Empty Garbage",
      "Prime Shields",
      "Calibrate Distributor",
      "Divert Power",
      "Inspect Sample",
      "Start Reactor",
      "Swipe Card",
      "Unlock Manifolds",
      "Align Engine Output",
      "Fuel Engines",
      "Chart Course",
      "Stabilize Steering",
      "Clean O2 Filter",
    ];

    const imposterTasks = [
      "System Override",
      "Data Corruption",
      "Signal Interference",
      "Fake Wiring",
      "Decryption Minigame",
      "Reactor Meltdown",
      "Vent Sabotage",
      "Shield Corruption",
      "Oxygen Override",
      "Emergency System Hack",
    ];

    // Random task locations (within map bounds)
    const locations: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < 50; i++) {
      locations.push({
        x: 100 + Math.random() * 2600,
        y: 100 + Math.random() * 1700,
      });
    }

    const tasks: Array<{
      gameId: Types.ObjectId;
      playerId: Types.ObjectId;
      type: "CREW" | "IMPOSTER";
      name: string;
      location: { x: number; y: number };
    }> = [];

    // Assign crew tasks (all players get same tasks)
    for (const player of players) {
      if (player.role === "CREWMATE") {
        for (let i = 0; i < Math.min(crewTasks.length, 15); i++) {
          tasks.push({
            gameId,
            playerId: player.userId as Types.ObjectId,
            type: "CREW",
            name: crewTasks[i],
            location: locations[i % locations.length],
          });
        }
      } else {
        // Imposter gets sabotage tasks
        for (let i = 0; i < Math.min(imposterTasks.length, 10); i++) {
          tasks.push({
            gameId,
            playerId: player.userId as Types.ObjectId,
            type: "IMPOSTER",
            name: imposterTasks[i],
            location: locations[(i + 15) % locations.length],
          });
        }
      }
    }

    await TaskModel.insertMany(tasks);
  }

  /**
   * Handle crew task completion
   */
  async completeCrewTask(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId,
    taskId: Types.ObjectId
  ): Promise<{ encryptedWord: string; shouldStartMeeting: boolean }> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.phase !== "TASKS") {
      throw new Error("Not in task phase");
    }

    // Verify task belongs to player and is crew task
    const task = await TaskModel.findOne({
      _id: taskId,
      gameId,
      playerId,
      type: "CREW",
      completed: false,
    });

    if (!task) {
      throw new Error("Task not found or already completed");
    }

    // Mark task as completed
    task.completed = true;
    task.completedAt = new Date();
    await task.save();

    // Update in-memory state
    const state = gameStates.get(game.roomId.toString());
    if (state) {
      state.crewTasksCompleted += 1;

      // Check if all crew completed one round
      const room = await RoomModel.findById(game.roomId);
      if (room) {
        const aliveCrew = room.players.filter(
          (p) => p.role === "CREWMATE" && p.isAlive
        );
        const requiredCompletions = aliveCrew.length;

        if (state.crewTasksCompleted >= requiredCompletions) {
          // Encrypt word by 10%
          state.encryptionState = encryptWord(state.encryptionState, 10);
          state.crewTasksCompleted = 0; // Reset counter

          // Update database
          game.encryptedWord = state.encryptionState.encryptedWord;
          await game.save();

          // Log
          await GameLogModel.create({
            gameId,
            type: "TASK_COMPLETED",
            metadata: { playerId, taskType: "CREW", encryptionTriggered: true },
          });

          return {
            encryptedWord: state.encryptionState.encryptedWord,
            shouldStartMeeting: true,
          };
        }
      }
    }

    await GameLogModel.create({
      gameId,
      type: "TASK_COMPLETED",
      metadata: { playerId, taskType: "CREW" },
    });

    return {
      encryptedWord: game.encryptedWord,
      shouldStartMeeting: false,
    };
  }

  /**
   * Handle imposter task completion
   */
  async completeImposterTask(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId,
    taskId: Types.ObjectId
  ): Promise<{ encryptedWord: string; decryptedPercentage: number }> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    if (game.phase !== "TASKS") {
      throw new Error("Not in task phase");
    }

    // Verify task belongs to player and is imposter task
    const task = await TaskModel.findOne({
      _id: taskId,
      gameId,
      playerId,
      type: "IMPOSTER",
      completed: false,
    });

    if (!task) {
      throw new Error("Task not found or already completed");
    }

    // Verify player is imposter
    const room = await RoomModel.findById(game.roomId);
    const player = room?.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === playerId.toString()
    );
    if (player?.role !== "IMPOSTER") {
      throw new Error("Only imposter can complete sabotage tasks");
    }

    // Mark task as completed
    task.completed = true;
    task.completedAt = new Date();
    await task.save();

    // Update in-memory state
    const state = gameStates.get(game.roomId.toString());
    if (state) {
      state.imposterTasksCompleted += 1;

      // Decrypt word by 10%
      state.encryptionState = decryptWord(state.encryptionState, 10);

      // Update database
      game.encryptedWord = state.encryptionState.encryptedWord;
      game.decryptedPercentage = state.encryptionState.decryptedPercentage;
      await game.save();

      await GameLogModel.create({
        gameId,
        type: "TASK_COMPLETED",
        metadata: { playerId, taskType: "IMPOSTER" },
      });

      return {
        encryptedWord: state.encryptionState.encryptedWord,
        decryptedPercentage: state.encryptionState.decryptedPercentage,
      };
    }

    return {
      encryptedWord: game.encryptedWord,
      decryptedPercentage: game.decryptedPercentage,
    };
  }

  /**
   * Start meeting phase
   */
  async startMeeting(gameId: Types.ObjectId): Promise<void> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    game.phase = "MEETING";
    game.meetingStartTime = new Date();
    await game.save();

    const state = gameStates.get(game.roomId.toString());
    if (state) {
      state.phase = "MEETING";
    }

    await GameLogModel.create({
      gameId,
      type: "MEETING_STARTED",
      metadata: { round: game.round },
    });
  }

  /**
   * End meeting and start voting
   */
  async endMeeting(gameId: Types.ObjectId): Promise<void> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    game.phase = "VOTING";
    await game.save();

    const state = gameStates.get(game.roomId.toString());
    if (state) {
      state.phase = "VOTING";
    }
  }

  /**
   * Check win conditions
   */
  async checkWinConditions(gameId: Types.ObjectId): Promise<{
    gameEnded: boolean;
    winner?: "CREWMATE" | "IMPOSTER";
  }> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const room = await RoomModel.findById(game.roomId);
    if (!room) {
      throw new Error("Room not found");
    }

    const state = gameStates.get(game.roomId.toString());
    if (!state) {
      return { gameEnded: false };
    }

    // Check if word is fully decrypted (imposter wins)
    if (state.encryptionState.decryptedPercentage >= 100) {
      game.phase = "ENDED";
      game.winner = "IMPOSTER";
      await game.save();

      await GameLogModel.create({
        gameId,
        type: "GAME_ENDED",
        metadata: { winner: "IMPOSTER", reason: "word_decrypted" },
      });

      return { gameEnded: true, winner: "IMPOSTER" };
    }

    // Check if imposter is eliminated (crew wins)
    const imposter = room.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === game.imposterId.toString()
    );
    if (imposter && !imposter.isAlive) {
      game.phase = "ENDED";
      game.winner = "CREWMATE";
      await game.save();

      await GameLogModel.create({
        gameId,
        type: "GAME_ENDED",
        metadata: { winner: "CREWMATE", reason: "imposter_eliminated" },
      });

      return { gameEnded: true, winner: "CREWMATE" };
    }

    // Check if imposter wins by survival
    const alivePlayers = room.players.filter((p) => p.isAlive);
    if (alivePlayers.length <= 3 && imposter?.isAlive) {
      game.phase = "ENDED";
      game.winner = "IMPOSTER";
      await game.save();

      await GameLogModel.create({
        gameId,
        type: "GAME_ENDED",
        metadata: { winner: "IMPOSTER", reason: "survival" },
      });

      return { gameEnded: true, winner: "IMPOSTER" };
    }

    return { gameEnded: false };
  }

  /**
   * Get game state for a player (role-aware)
   */
  async getPlayerGameState(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId
  ): Promise<{
    role: "CREWMATE" | "IMPOSTER";
    encryptedWord?: string;
    phase: GamePhase;
    round: number;
  }> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new Error("Game not found");
    }

    const room = await RoomModel.findById(game.roomId);
    const player = room?.players.find(
      (p) => (p.userId as Types.ObjectId).toString() === playerId.toString()
    );

    if (!player) {
      throw new Error("Player not in game");
    }

    const role = player.role || "CREWMATE";
    const isImposter = role === "IMPOSTER";

    return {
      role,
      encryptedWord: isImposter ? undefined : game.encryptedWord,
      phase: game.phase,
      round: game.round,
    };
  }

  /**
   * Get in-memory state (for socket handlers)
   */
  getInMemoryState(roomId: Types.ObjectId): InMemoryGameState | undefined {
    return gameStates.get(roomId.toString());
  }

  /**
   * Get game by room ID
   */
  async getGameByRoomId(roomId: Types.ObjectId): Promise<IGame | null> {
    return GameModel.findOne({ roomId });
  }
}

export const gameService = new GameService();
