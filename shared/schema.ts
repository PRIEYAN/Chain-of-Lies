import { z } from "zod";

export const GAME_PHASES = [
  "LOBBY",
  "ROLE",
  "TASK",
  "AUDIT",
  "VOTING",
  "REVEAL",
] as const;

export type GamePhase = (typeof GAME_PHASES)[number];

export const ROLES = [
  "Validator",
  "Auditor",
  "Indexer",
  "Miner",
  "SmartContractDev",
  "BridgeOperator",
  "Oracle",
  "Tamperer",
] as const;

export type Role = (typeof ROLES)[number];

export type LedgerStatus = "Normal" | "Anomaly";

export const playerSchema = z.object({
  id: z.string(),
  username: z.string(),
  isHost: z.boolean(),
  isConnected: z.boolean().default(true),
});

export type Player = z.infer<typeof playerSchema>;

export const ledgerEntrySchema = z.object({
  role: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  dataHash: z.string(),
  timestamp: z.string(),
  status: z.union([z.literal("Normal"), z.literal("Anomaly")]),
});

export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;

export const taskSubmissionSchema = z.object({
  id: z.string(),
  round: z.number().int().positive(),
  playerId: z.string(),
  role: z.string(),
  submittedAt: z.string(),
  payload: z.record(z.any()),
});

export type TaskSubmission = z.infer<typeof taskSubmissionSchema>;

export const voteSchema = z.object({
  id: z.string(),
  round: z.number().int().positive(),
  voterId: z.string(),
  targetPlayerId: z.string().nullable(),
  castAt: z.string(),
});

export type Vote = z.infer<typeof voteSchema>;

export type GameState = {
  phase: GamePhase;
  players: Player[];
  role: Role | "";
  isTamperer: boolean;
  round: number;
  timer: number;
  submissions: TaskSubmission[];
  votes: Vote[];
};

export type GameAction =
  | { type: "SET_PHASE"; phase: GamePhase }
  | { type: "SET_PLAYERS"; players: Player[] }
  | { type: "ADD_PLAYER"; player: Player }
  | { type: "SET_ROLE"; role: Role; isTamperer: boolean }
  | { type: "SET_TIMER"; timer: number }
  | { type: "SET_ROUND"; round: number }
  | { type: "ADD_SUBMISSION"; submission: TaskSubmission }
  | { type: "ADD_VOTE"; vote: Vote }
  | { type: "RESET" };

export function makeInitialState(): GameState {
  return {
    phase: "LOBBY",
    players: [],
    role: "",
    isTamperer: false,
    round: 1,
    timer: 0,
    submissions: [],
    votes: [],
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_PLAYERS":
      return { ...state, players: action.players };
    case "ADD_PLAYER":
      return { ...state, players: [...state.players, action.player] };
    case "SET_ROLE":
      return { ...state, role: action.role, isTamperer: action.isTamperer };
    case "SET_TIMER":
      return { ...state, timer: action.timer };
    case "SET_ROUND":
      return { ...state, round: action.round };
    case "ADD_SUBMISSION":
      return { ...state, submissions: [...state.submissions, action.submission] };
    case "ADD_VOTE":
      return { ...state, votes: [...state.votes, action.vote] };
    case "RESET":
      return makeInitialState();
    default:
      return state;
  }
}
