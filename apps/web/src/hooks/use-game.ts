import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@tamper-hunt/shared";  // ✅ Use package name
import type { GamePhase } from "@tamper-hunt/types";  // ✅ Import type from types package
import { z } from "zod";

function parseWithLogging<T>(schema: z.ZodSchema<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.error(`[Zod] ${label} validation failed:`, result.error.format());
    throw result.error;
  }
  return result.data;
}

export function useGameState() {
  return useQuery({
    queryKey: [api.game.state.path],
    queryFn: async () => {
      const res = await fetch(api.game.state.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch game state");
      const json = await res.json();
      return parseWithLogging(api.game.state.responses[200], json, "game.state");
    },
    refetchInterval: 1500,
  });
}

export function useLobbyPlayers() {
  return useQuery({
    queryKey: [api.game.lobbyPlayers.path],
    queryFn: async () => {
      const res = await fetch(api.game.lobbyPlayers.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch players");
      const json = await res.json();
      return parseWithLogging(api.game.lobbyPlayers.responses[200], json, "game.players");
    },
    refetchInterval: 1500,
  });
}

export function useLedger() {
  return useQuery({
    queryKey: [api.game.ledger.path],
    queryFn: async () => {
      const res = await fetch(api.game.ledger.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ledger");
      const json = await res.json();
      return parseWithLogging(api.game.ledger.responses[200], json, "game.ledger");
    },
    refetchInterval: 2500,
  });
}

export function useSetPhase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phase: GamePhase) => {
      const body = api.game.setPhase.input.parse({ phase });

      const res = await fetch(api.game.setPhase.path, {
        method: api.game.setPhase.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const err = parseWithLogging(api.game.setPhase.responses[400], await res.json(), "game.setPhase[400]");
          throw new Error(err.message);
        }
        throw new Error("Failed to set phase");
      }

      const json = await res.json();
      return parseWithLogging(api.game.setPhase.responses[200], json, "game.setPhase[200]");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [api.game.state.path] }),
        queryClient.invalidateQueries({ queryKey: [api.game.lobbyPlayers.path] }),
        queryClient.invalidateQueries({ queryKey: [api.game.ledger.path] }),
      ]);
    },
  });
}
