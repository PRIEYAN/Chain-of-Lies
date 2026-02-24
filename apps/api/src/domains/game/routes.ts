/**
 * Game Domain - HTTP Routes
 */
import type { Express } from "express";
import { z } from "zod";
import { gameService } from "./service";
import { GAME_PHASES } from "@tamper-hunt/types";

export function registerGameRoutes(app: Express) {
  // Get full game state (legacy route - returns empty state if no game active)
  app.get("/api/game/state", async (_req, res) => {
    try {
      const state = await gameService.getState();
      res.json(state);
    } catch (error: any) {
      // Return empty state if error (for backward compatibility)
      console.warn("[Legacy Route] /api/game/state error:", error.message);
      res.json({
        phase: "LOBBY",
        players: [],
        role: "",
        isTamperer: false,
        round: 1,
        timer: 0,
        submissions: [],
        votes: [],
      });
    }
  });

  // Get lobby players
  app.get("/api/game/players", async (_req, res) => {
    const players = await gameService.getPlayers();
    res.json(players);
  });

  // Set game phase
  app.post("/api/game/phase", async (req, res) => {
    try {
      const schema = z.object({ phase: z.enum(GAME_PHASES) });
      const input = schema.parse(req.body);
      const result = await gameService.setPhase(input.phase);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0]?.message ?? "Invalid request",
          field: err.errors[0]?.path?.join("."),
        });
      }
      throw err;
    }
  });

  // Get ledger
  app.get("/api/game/ledger", async (_req, res) => {
    const ledger = await gameService.getLedger();
    res.json(ledger);
  });
}
