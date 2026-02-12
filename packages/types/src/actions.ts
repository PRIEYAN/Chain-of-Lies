/**
 * Game Action Types for State Management
 */
import type { GamePhase, Role } from "./constants";
import type { Player, TaskSubmission, Vote } from "./schemas";

export type GameAction =
  | { type: "SET_PHASE"; phase: GamePhase }
  | { type: "SET_PLAYERS"; players: Player[] }
  | { type: "ADD_PLAYER"; player: Player }
  | { type: "REMOVE_PLAYER"; playerId: string }
  | { type: "SET_ROLE"; role: Role; isTamperer: boolean }
  | { type: "SET_TIMER"; timer: number }
  | { type: "SET_ROUND"; round: number }
  | { type: "ADD_SUBMISSION"; submission: TaskSubmission }
  | { type: "ADD_VOTE"; vote: Vote }
  | { type: "RESET" };
