import { z } from "zod";
import {
  GAME_PHASES,
  ROLES,
  ledgerEntrySchema,
  playerSchema,
  taskSubmissionSchema,
  voteSchema,
} from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  game: {
    state: {
      method: "GET" as const,
      path: "/api/game/state" as const,
      responses: {
        200: z.object({
          phase: z.enum(GAME_PHASES),
          players: z.array(playerSchema),
          role: z.enum(ROLES).or(z.literal("")),
          isTamperer: z.boolean(),
          round: z.number(),
          timer: z.number(),
          submissions: z.array(taskSubmissionSchema),
          votes: z.array(voteSchema),
        }),
      },
    },
    lobbyPlayers: {
      method: "GET" as const,
      path: "/api/game/players" as const,
      responses: {
        200: z.array(playerSchema),
      },
    },
    setPhase: {
      method: "POST" as const,
      path: "/api/game/phase" as const,
      input: z.object({ phase: z.enum(GAME_PHASES) }),
      responses: {
        200: z.object({ ok: z.literal(true) }),
        400: errorSchemas.validation,
      },
    },
    ledger: {
      method: "GET" as const,
      path: "/api/game/ledger" as const,
      responses: {
        200: z.array(ledgerEntrySchema),
      },
    },
  },
};

export function buildUrl(
  path: string,
  params?: Record<string, string | number>
): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export const ws = {
  send: {
    joinRoom: z.object({ roomId: z.string(), username: z.string() }),
    submitTask: z.object({
      round: z.number().int().positive(),
      role: z.string(),
      payload: z.record(z.any()),
    }),
    castVote: z.object({
      round: z.number().int().positive(),
      targetPlayerId: z.string().nullable(),
    }),
    callEmergency: z.object({ reason: z.string().optional() }),
    chatMessage: z.object({ message: z.string().min(1), at: z.string() }),
  },
  receive: {
    playerJoined: playerSchema,
    playerLeft: z.object({ playerId: z.string() }),
    stateUpdated: api.game.state.responses[200],
    ledgerUpdated: z.array(ledgerEntrySchema),
    chatMessage: z.object({
      id: z.string(),
      playerId: z.string(),
      username: z.string(),
      message: z.string(),
      at: z.string(),
    }),
  },
};

export type GameStateResponse = z.infer<typeof api.game.state.responses[200]>;
export type PlayersResponse = z.infer<typeof api.game.lobbyPlayers.responses[200]>;
export type LedgerResponse = z.infer<typeof api.game.ledger.responses[200]>;

export type JoinRoomInput = z.infer<typeof ws.send.joinRoom>;
export type SubmitTaskInput = z.infer<typeof ws.send.submitTask>;
export type CastVoteInput = z.infer<typeof ws.send.castVote>;
export type CallEmergencyInput = z.infer<typeof ws.send.callEmergency>;
export type ChatMessageInput = z.infer<typeof ws.send.chatMessage>;
