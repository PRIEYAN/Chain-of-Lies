/**
 * Multiplayer Game Types
 */

export type GamePhase = "LOBBY" | "GAME" | "TASK" | "VOTING" | "REVEAL";

export type GamePlayer = {
  id: string;
  name: string;
  x: number;
  y: number;
  color: string;
  isHost: boolean;
};

export type GameState = {
  players: Record<string, GamePlayer>;
  localPlayerId: string | null;
  phase: GamePhase;
  partyCode: string | null;
};

// Socket event payloads
export type PlayerMovePayload = {
  x: number;
  y: number;
};

export type PlayersUpdatePayload = {
  players: Record<string, GamePlayer>;
};

export type PlayerJoinedPayload = {
  player: GamePlayer;
};

export type PlayerLeftPayload = {
  playerId: string;
};

export type GameStartPayload = {
  players: Record<string, GamePlayer>;
  localPlayerId: string;
};
