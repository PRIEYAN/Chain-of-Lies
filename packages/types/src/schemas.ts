/**
 * Zod Schemas for Type Validation
 * Used for runtime validation of data structures
 */
import { z } from "zod";
import { GAME_PHASES, ROLES } from "./constants";

/**
 * Player Schema
 */
export const playerSchema = z.object({
  id: z.string(),
  username: z.string(),
  isHost: z.boolean(),
  isConnected: z.boolean().default(true),
});

export type Player = z.infer<typeof playerSchema>;

/**
 * Ledger Entry Schema
 */
export const ledgerEntrySchema = z.object({
  role: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  dataHash: z.string(),
  timestamp: z.string(),
  status: z.union([z.literal("Normal"), z.literal("Anomaly")]),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

/**
 * Task Submission Schema
 */
export const taskSubmissionSchema = z.object({
  id: z.string(),
  round: z.number().int().positive(),
  playerId: z.string(),
  role: z.string(),
  submittedAt: z.string(),
  payload: z.record(z.any()),
});

export type TaskSubmission = z.infer<typeof taskSubmissionSchema>;

/**
 * Vote Schema
 */
export const voteSchema = z.object({
  id: z.string(),
  round: z.number().int().positive(),
  voterId: z.string(),
  targetPlayerId: z.string().nullable(),
  castAt: z.string(),
});

export type Vote = z.infer<typeof voteSchema>;

/**
 * Game State Schema
 */
export const gameStateSchema = z.object({
  phase: z.enum(GAME_PHASES),
  players: z.array(playerSchema),
  role: z.enum(ROLES).or(z.literal("")),
  isTamperer: z.boolean(),
  round: z.number(),
  timer: z.number(),
  submissions: z.array(taskSubmissionSchema),
  votes: z.array(voteSchema),
});

export type GameState = z.infer<typeof gameStateSchema>;
