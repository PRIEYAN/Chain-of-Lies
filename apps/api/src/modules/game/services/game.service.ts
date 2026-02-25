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

    // Task locations matching frontend map.ts taskZones
    const locations = [
      { x: 450, y: 250 },   // task1 - Cafeteria
      { x: 950, y: 200 },   // task2 - Weapons
      { x: 1500, y: 250 },  // task3 - Navigation
      { x: 2000, y: 250 },  // task4 - Shields
      { x: 2600, y: 250 },  // task5 - O2
      { x: 1450, y: 750 },  // task6 - Admin
      { x: 250, y: 850 },   // task7 - Storage
      { x: 250, y: 1350 },  // task8 - Electrical
      { x: 850, y: 1500 },  // task9 - Lower Engine (Elevator)
      { x: 1300, y: 1450 }, // task10 - Security
      { x: 1850, y: 1500 }, // task11 - Reactor
      { x: 2600, y: 850 },  // task12 - Upper Engine
      { x: 2450, y: 1500 }, // task13 - Medbay
      { x: 1350, y: 200 },  // task14 - Navigation (extra)
      { x: 2450, y: 300 },  // task15 - O2 (extra)
    ];

    const tasks: Array<{
      gameId: Types.ObjectId;
      playerId: Types.ObjectId;
      type: "CREW" | "IMPOSTER";
      name: string;
      taskKey?: string;
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
            taskKey: `task${i + 1}`,
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
            taskKey: `task${i + 1}`,
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
    taskId: Types.ObjectId,
    points: number = 10
  ): Promise<{
    encryptedWord: string;
    shouldStartMeeting: boolean;
    taskProgress: number;
    decryptedPercentage?: number;
  }> {
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

    // Calculate global task progress (Encryption Bar)
    // Always do this even if in-memory state is missing
    const room = await RoomModel.findById(game.roomId);
    let currentProgress = game.taskProgress;

    if (room) {
      const totalCrew = room.players.filter(p => !p.role || p.role === "CREWMATE").length;
      const tasksPerPlayer = 15;
      const totalPossibleTasks = Math.max(1, totalCrew) * tasksPerPlayer;
      const totalCompletedTasks = await TaskModel.countDocuments({
        gameId,
        type: "CREW",
        completed: true
      });

      logger.info(`Progress: completed=${totalCompletedTasks}, possible=${totalPossibleTasks}, crewCount=${totalCrew}`);

      currentProgress = totalPossibleTasks > 0
        ? Math.round((totalCompletedTasks / totalPossibleTasks) * 100)
        : 0;

      game.taskProgress = currentProgress;
      await game.save();
    }

    // Update in-memory state if available
    const state = gameStates.get(game.roomId.toString());
    let shouldStartMeeting = false;
    let encryptedWord = game.encryptedWord;

    if (state && room) {
      state.crewTasksCompleted += 1;

      // Check if all crew completed one round
      const aliveCrew = room.players.filter(
        (p) => p.role === "CREWMATE" && p.isAlive
      );
      const requiredCompletions = aliveCrew.length;

      if (state.crewTasksCompleted >= requiredCompletions) {
        // Encrypt word by provided percent (default 10%)
        const pct = points && points > 0 ? points : 10;
        state.encryptionState = encryptWord(state.encryptionState, pct);
        state.crewTasksCompleted = 0; // Reset counter
        state.encryptionState.decryptedPercentage = currentProgress;

        // Update database
        game.encryptedWord = state.encryptionState.encryptedWord;
        await game.save();

        shouldStartMeeting = true;
        encryptedWord = state.encryptionState.encryptedWord;

        // Log
        await GameLogModel.create({
          gameId,
          type: "TASK_COMPLETED",
          metadata: { playerId, taskType: "CREW", encryptionTriggered: true, progress: currentProgress },
        });
      }
    }

    return {
      encryptedWord,
      shouldStartMeeting,
      taskProgress: currentProgress,
      decryptedPercentage: game.decryptedPercentage,
    };
  }

  /**
   * Handle imposter task completion
   */
  async completeImposterTask(
    gameId: Types.ObjectId,
    playerId: Types.ObjectId,
    taskId: Types.ObjectId,
    points: number = 10
  ): Promise<{
    encryptedWord: string;
    decryptedPercentage: number;
    taskProgress: number;
  }> {
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

    // Calculate global task progress (Encryption Bar)
    // Even though this is an imposter task, we need the latest crew progress for the HUD
    let currentTaskProgress = game.taskProgress;
    if (room) {
      const totalCrew = room.players.filter(p => p.role === "CREWMATE").length;
      const tasksPerPlayer = 15;
      const totalPossibleTasks = totalCrew * tasksPerPlayer;
      const totalCompletedTasks = await TaskModel.countDocuments({
        gameId,
        type: "CREW",
        completed: true
      });

      currentTaskProgress = totalPossibleTasks > 0
        ? Math.round((totalCompletedTasks / totalPossibleTasks) * 100)
        : 0;

      game.taskProgress = currentTaskProgress;
      await game.save();
    }

    // Update in-memory state
    const state = gameStates.get(game.roomId.toString());
    if (state) {
      state.imposterTasksCompleted += 1;

      // Decrypt word by provided percent (default 5% for slower progression)
      const pct = points && points > 0 ? points : 5;
      state.encryptionState = decryptWord(state.encryptionState, pct);

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
        taskProgress: currentTaskProgress,
      };
    }

    return {
      encryptedWord: game.encryptedWord,
      decryptedPercentage: game.decryptedPercentage,
      taskProgress: currentTaskProgress,
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
