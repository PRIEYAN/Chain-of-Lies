/**
 * WebSocket Message Types
 * Defines the shape of messages sent between client and server
 */
import { z } from "zod";
import { playerSchema } from "./schemas";

/**
 * Client -> Server Messages
 */
export const wsClientMessages = {
  joinRoom: z.object({ 
    roomId: z.string(), 
    username: z.string() 
  }),
  submitTask: z.object({
    round: z.number().int().positive(),
    role: z.string(),
    payload: z.record(z.any()),
  }),
  castVote: z.object({
    round: z.number().int().positive(),
    targetPlayerId: z.string().nullable(),
  }),
  callEmergency: z.object({ 
    reason: z.string().optional() 
  }),
  chatMessage: z.object({ 
    message: z.string().min(1), 
    at: z.string() 
  }),
  playerMove: z.object({
    x: z.number(),
    y: z.number(),
  }),
};

/**
 * Server -> Client Messages
 */
export const wsServerMessages = {
  playerJoined: playerSchema,
  playerLeft: z.object({ playerId: z.string() }),
  phaseChanged: z.object({ phase: z.string() }),
  timerTick: z.object({ remaining: z.number() }),
  submissionReceived: z.object({ playerId: z.string(), role: z.string() }),
  voteCast: z.object({ voterId: z.string() }),
  gameEnded: z.object({ winner: z.enum(["Crew", "Tamperer"]) }),
  stateUpdated: z.object({ 
    timer: z.number().optional(),
    phase: z.string().optional(),
  }),
  ledgerUpdated: z.object({ 
    entries: z.array(z.any()) 
  }),
  playersUpdate: z.object({
    players: z.array(z.object({
      id: z.string(),
      username: z.string(),
      x: z.number(),
      y: z.number(),
      vx: z.number().optional(),
      vy: z.number().optional(),
    })),
  }),
};

export type WsClientMessage = {
  [K in keyof typeof wsClientMessages]: {
    type: K;
    payload: z.infer<(typeof wsClientMessages)[K]>;
  };
}[keyof typeof wsClientMessages];

export type WsServerMessage = {
  [K in keyof typeof wsServerMessages]: {
    type: K;
    payload: z.infer<(typeof wsServerMessages)[K]>;
  };
}[keyof typeof wsServerMessages];
