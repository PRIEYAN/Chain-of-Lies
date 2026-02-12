/**
 * Game Domain - HTTP Routes
 */
import type { Express } from "express";
import { z } from "zod";
import { gameService } from "./service";
import { GAME_PHASES } from "@tamper-hunt/types";

export function registerGameRoutes(app: Express) {
  // Get full game state
  app.get("/api/game/state", async (_req, res) => {
    const state = await gameService.getState();
    res.json(state);
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
