import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useGameSocket } from "@/hooks/use-websocket";
import { useGameState } from "@/hooks/use-game";
import type { GamePhase, Player as PlayerType } from "@tamper-hunt/types";

export interface PlayerPosition {
  id: string;
  username: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  isLocal: boolean;
}

export interface InteractionZone {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: "task" | "emergency" | "meeting";
  label: string;
  taskId?: string;
}

interface GameContextValue {
  // State
  phase: GamePhase;
  players: Map<string, PlayerPosition>;
  localPlayerId: string | null;
  interactionZones: InteractionZone[];
  
  // Actions
  updateLocalPlayer: (x: number, y: number, vx: number, vy: number) => void;
  triggerInteraction: (zoneId: string) => void;
  
  // Overlays
  activeOverlay: "task" | "voting" | "emergency" | "reveal" | null;
  setActiveOverlay: (overlay: "task" | "voting" | "emergency" | "reveal" | null) => void;
  activeTaskId: string | null;
  setActiveTaskId: (taskId: string | null) => void;
  
  // Movement control
  movementLocked: boolean;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const { emit, on } = useGameSocket();
  const { data: gameState } = useGameState();
  
  const [players, setPlayers] = useState<Map<string, PlayerPosition>>(new Map());
  const [localPlayerId] = useState(() => `player-${Math.random().toString(36).slice(2, 9)}`);
  const [activeOverlay, setActiveOverlay] = useState<"task" | "voting" | "emergency" | "reveal" | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  const phase = gameState?.phase ?? "LOBBY";
  const movementLocked = activeOverlay === "voting" || activeOverlay === "emergency";

  // Define interaction zones
  const interactionZones: InteractionZone[] = [
    { id: "task-A1", x: 150, y: 150, width: 80, height: 80, type: "task", label: "Block Header", taskId: "A1" },
    { id: "task-A2", x: 650, y: 150, width: 80, height: 80, type: "task", label: "State Root", taskId: "A2" },
    { id: "task-B1", x: 150, y: 350, width: 80, height: 80, type: "task", label: "Tx Set", taskId: "B1" },
    { id: "task-B2", x: 650, y: 350, width: 80, height: 80, type: "task", label: "Gas & Fees", taskId: "B2" },
    { id: "emergency", x: 400, y: 250, width: 100, height: 60, type: "emergency", label: "Emergency" },
  ];

  // Update local player position and emit to server
  const updateLocalPlayer = useCallback((x: number, y: number, vx: number, vy: number) => {
    setPlayers(prev => {
      const updated = new Map(prev);
      updated.set(localPlayerId, {
        id: localPlayerId,
        username: "You",
        x,
        y,
        vx,
        vy,
        isLocal: true,
      });
      return updated;
    });
    
    // Emit position to server
    emit("playerMove" as any, { x, y });
  }, [localPlayerId, emit]);

  // Handle interaction zone triggers
  const triggerInteraction = useCallback((zoneId: string) => {
    const zone = interactionZones.find(z => z.id === zoneId);
    if (!zone) return;
    
    if (zone.type === "task" && zone.taskId) {
      setActiveTaskId(zone.taskId);
      setActiveOverlay("task");
    } else if (zone.type === "emergency") {
      setActiveOverlay("emergency");
      emit("callEmergency", { reason: "Emergency button pressed" });
    }
  }, [emit, interactionZones]);

  // Listen for remote player updates
  useEffect(() => {
    const unsubscribe = on("playersUpdate" as any, (data: any) => {
      if (data.players) {
        setPlayers(prev => {
          const updated = new Map(prev);
          data.players.forEach((p: any) => {
            if (p.id !== localPlayerId) {
              updated.set(p.id, {
                ...p,
                isLocal: false,
              });
            }
          });
          return updated;
        });
      }
    });
    
    return unsubscribe;
  }, [on, localPlayerId]);

  // Phase-based overlay management
  useEffect(() => {
    if (phase === "VOTING") {
      setActiveOverlay("voting");
    } else if (phase === "REVEAL") {
      setActiveOverlay("reveal");
    } else if (phase === "TASK") {
      // Keep current overlay if it's a task modal
      if (activeOverlay !== "task") {
        setActiveOverlay(null);
      }
    } else {
      setActiveOverlay(null);
    }
  }, [phase]);

  const value: GameContextValue = {
    phase,
    players,
    localPlayerId,
    interactionZones,
    updateLocalPlayer,
    triggerInteraction,
    activeOverlay,
    setActiveOverlay,
    activeTaskId,
    setActiveTaskId,
    movementLocked,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
