/**
 * API Route Definitions
 * Type-safe API contract shared between client and server
 */
import { z } from "zod";  // ✅ Add this line
import {
  GAME_PHASES,
  ROLES,
  ledgerEntrySchema,
  playerSchema,
  taskSubmissionSchema,
  voteSchema,
} from "@tamper-hunt/types";

/**
 * Common Error Response Schemas
 */
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

/**
 * API Route Contract
 * Defines all API endpoints with their methods, paths, and schemas
 */
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
  voting: {
    cast: {
      method: "POST" as const,
      path: "/api/voting/cast" as const,
      input: z.object({
        voterId: z.string(),
        targetPlayerId: z.string().nullable(),
        round: z.number().int().positive(),
      }),
      responses: {
        200: voteSchema,
        400: errorSchemas.validation,
      },
    },
    votes: {
      method: "GET" as const,
      path: "/api/voting/votes" as const,
      responses: {
        200: z.array(voteSchema),
      },
    },
  },
  submissions: {
    submit: {
      method: "POST" as const,
      path: "/api/submissions/submit" as const,
      input: z.object({
        playerId: z.string(),
        role: z.string(),
        round: z.number().int().positive(),
        payload: z.record(z.unknown()),
      }),
      responses: {
        200: taskSubmissionSchema,
        400: errorSchemas.validation,
      },
    },
    list: {
      method: "GET" as const,
      path: "/api/submissions" as const,
      responses: {
        200: z.array(taskSubmissionSchema),
      },
    },
  },
};

/**
 * Build URL with path parameters
 */
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

export type ApiContract = typeof api;
