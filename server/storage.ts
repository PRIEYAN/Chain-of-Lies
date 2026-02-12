import { randomUUID } from "crypto";
import type {
  GamePhase,
  GameState,
  LedgerEntry,
  Player,
  Role,
  TaskSubmission,
  Vote,
} from "@shared/schema";
import { makeInitialState } from "@shared/schema";

export interface IStorage {
  getState(): Promise<GameState>;
  setPhase(phase: GamePhase): Promise<void>;
  setPlayers(players: Player[]): Promise<void>;
  addPlayer(player: Player): Promise<void>;
  setRole(role: Role, isTamperer: boolean): Promise<void>;
  setRound(round: number): Promise<void>;
  setTimer(timer: number): Promise<void>;
  addSubmission(submission: Omit<TaskSubmission, "id" | "submittedAt">): Promise<TaskSubmission>;
  addVote(vote: Omit<Vote, "id" | "castAt">): Promise<Vote>;
  getLedger(): Promise<LedgerEntry[]>;
  setLedger(entries: LedgerEntry[]): Promise<void>;
}

export class MemStorage implements IStorage {
  private state: GameState;
  private ledger: LedgerEntry[];

  constructor() {
    this.state = makeInitialState();
    this.ledger = [];
  }

  async getState(): Promise<GameState> {
    return this.state;
  }

  async setPhase(phase: GamePhase): Promise<void> {
    this.state = { ...this.state, phase };
  }

  async setPlayers(players: Player[]): Promise<void> {
    this.state = { ...this.state, players };
  }

  async addPlayer(player: Player): Promise<void> {
    this.state = { ...this.state, players: [...this.state.players, player] };
  }

  async setRole(role: Role, isTamperer: boolean): Promise<void> {
    this.state = { ...this.state, role, isTamperer };
  }

  async setRound(round: number): Promise<void> {
    this.state = { ...this.state, round };
  }

  async setTimer(timer: number): Promise<void> {
    this.state = { ...this.state, timer };
  }

  async addSubmission(
    submission: Omit<TaskSubmission, "id" | "submittedAt">,
  ): Promise<TaskSubmission> {
    const full: TaskSubmission = {
      ...submission,
      id: randomUUID(),
      submittedAt: new Date().toISOString(),
    };
    this.state = { ...this.state, submissions: [...this.state.submissions, full] };
    return full;
  }

  async addVote(vote: Omit<Vote, "id" | "castAt">): Promise<Vote> {
    const full: Vote = {
      ...vote,
      id: randomUUID(),
      castAt: new Date().toISOString(),
    };
    this.state = { ...this.state, votes: [...this.state.votes, full] };
    return full;
  }

  async getLedger(): Promise<LedgerEntry[]> {
    return this.ledger;
  }

  async setLedger(entries: LedgerEntry[]): Promise<void> {
    this.ledger = entries;
  }
}

export const storage = new MemStorage();
