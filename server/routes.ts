import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { api } from "@shared/routes";
import { storage } from "./storage";
import { ROLES } from "@shared/schema";

function seedHash(input: string): string {
  // lightweight deterministic-ish hash string (NOT crypto), for UI only
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, "0")}`;
}

async function seedIfEmpty() {
  const state = await storage.getState();
  if (state.players.length > 0) return;

  const now = Date.now();
  const players = [
    { id: "p1", username: "Asha", isHost: true, isConnected: true },
    { id: "p2", username: "Ravi", isHost: false, isConnected: true },
    { id: "p3", username: "Meera", isHost: false, isConnected: true },
    { id: "p4", username: "Kabir", isHost: false, isConnected: true },
    { id: "p5", username: "Nila", isHost: false, isConnected: true },
    { id: "p6", username: "Dev", isHost: false, isConnected: true },
  ];

  await storage.setPlayers(players);
  await storage.setRound(1);
  await storage.setTimer(0);
  await storage.setPhase("LOBBY");

  const ledger = ROLES.map((role, idx) => {
    const p = players[idx % players.length];
    const ts = new Date(now - idx * 120_000).toISOString();
    const status = role === "Tamperer" ? "Anomaly" : "Normal";
    const hashBase = `${role}:${p.username}:${ts}:${status}`;
    return {
      role,
      playerId: p.id,
      playerName: p.username,
      dataHash: seedHash(hashBase),
      timestamp: ts,
      status,
    };
  });

  await storage.setLedger(ledger);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  await seedIfEmpty();

  app.get(api.game.state.path, async (_req, res) => {
    const state = await storage.getState();
    res.json(state);
  });

  app.get(api.game.lobbyPlayers.path, async (_req, res) => {
    const state = await storage.getState();
    res.json(state.players);
  });

  app.post(api.game.setPhase.path, async (req, res) => {
    try {
      const input = api.game.setPhase.input.parse(req.body);
      await storage.setPhase(input.phase);
      res.json({ ok: true });
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

  app.get(api.game.ledger.path, async (_req, res) => {
    const ledger = await storage.getLedger();
    res.json(ledger);
  });

  return httpServer;
}
