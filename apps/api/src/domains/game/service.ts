/**
 * Game Domain - Business Logic Service
 */
import { gameStorage } from "./storage";
import type { GamePhase, Player, LedgerEntry, Role } from "@tamper-hunt/types";
import { ROLES } from "@tamper-hunt/types";

function generateHash(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `0x${(h >>> 0).toString(16).padStart(8, "0")}`;
}

export const gameService = {
  async getState() {
    return gameStorage.getState();
  },

  async getPlayers() {
    return gameStorage.getPlayers();
  },

  async setPhase(phase: GamePhase) {
    await gameStorage.setPhase(phase);
    return { ok: true };
  },

  async getLedger() {
    return gameStorage.getLedger();
  },

  async assignRoles(players: Player[]): Promise<Map<string, { role: Role; isTamperer: boolean }>> {
    const assignments = new Map<string, { role: Role; isTamperer: boolean }>();
    const shuffledRoles = [...ROLES].sort(() => Math.random() - 0.5);
    const tampererIndex = Math.floor(Math.random() * players.length);

    players.forEach((player, index) => {
      const roleIndex = index % shuffledRoles.length;
      assignments.set(player.id, {
        role: shuffledRoles[roleIndex],
        isTamperer: index === tampererIndex,
      });
    });

    return assignments;
  },

  async seedInitialData() {
    const state = await gameStorage.getState();
    if (state.players.length > 0) return;

    const now = Date.now();
    const players: Player[] = [
      { id: "p1", username: "Asha", isHost: true, isConnected: true },
      { id: "p2", username: "Ravi", isHost: false, isConnected: true },
      { id: "p3", username: "Meera", isHost: false, isConnected: true },
      { id: "p4", username: "Kabir", isHost: false, isConnected: true },
      { id: "p5", username: "Nila", isHost: false, isConnected: true },
      { id: "p6", username: "Dev", isHost: false, isConnected: true },
    ];

    await gameStorage.setPlayers(players);
    await gameStorage.setRound(1);
    await gameStorage.setTimer(0);
    await gameStorage.setPhase("LOBBY");

    const ledger: LedgerEntry[] = ROLES.map((role, idx) => {
      const p = players[idx % players.length];
      const ts = new Date(now - idx * 120_000).toISOString();
      const status = role === "Tamperer" ? "Anomaly" : "Normal";
      const hashBase = `${role}:${p.username}:${ts}:${status}`;
      return {
        role,
        playerId: p.id,
        playerName: p.username,
        dataHash: generateHash(hashBase),
        timestamp: ts,
        status,
      };
    });

    await gameStorage.setLedger(ledger);
  },
};
