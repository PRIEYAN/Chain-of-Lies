/**
 * Game Domain - In-memory storage for game state
 * Replace with database operations in production
 */
import type { GameState, Player, LedgerEntry } from "@tamper-hunt/types";

let gameState: GameState = {
  phase: "LOBBY",
  players: [],
  role: "",
  isTamperer: false,
  round: 1,
  timer: 0,
  submissions: [],
  votes: [],
};

let ledger: LedgerEntry[] = [];

export const gameStorage = {
  // State operations
  async getState(): Promise<GameState> {
    return { ...gameState };
  },

  async setPhase(phase: GameState["phase"]): Promise<void> {
    gameState.phase = phase;
  },

  async setRound(round: number): Promise<void> {
    gameState.round = round;
  },

  async setTimer(timer: number): Promise<void> {
    gameState.timer = timer;
  },

  // Player operations
  async getPlayers(): Promise<Player[]> {
    return [...gameState.players];
  },

  async setPlayers(players: Player[]): Promise<void> {
    gameState.players = players;
  },

  async addPlayer(player: Player): Promise<void> {
    gameState.players.push(player);
  },

  async removePlayer(playerId: string): Promise<void> {
    gameState.players = gameState.players.filter((p) => p.id !== playerId);
  },

  // Ledger operations
  async getLedger(): Promise<LedgerEntry[]> {
    return [...ledger];
  },

  async setLedger(entries: LedgerEntry[]): Promise<void> {
    ledger = entries;
  },

  // Reset
  async reset(): Promise<void> {
    gameState = {
      phase: "LOBBY",
      players: [],
      role: "",
      isTamperer: false,
      round: 1,
      timer: 0,
      submissions: [],
      votes: [],
    };
    ledger = [];
  },
};
