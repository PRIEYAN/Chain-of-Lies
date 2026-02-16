import React, { createContext, useContext, useState, useCallback } from "react";
import type { GameState, GamePlayer, GamePhase } from "@/types/game";

interface MultiplayerGameContextValue extends GameState {
  // Actions
  setPlayers: (players: Record<string, GamePlayer>) => void;
  updatePlayer: (playerId: string, updates: Partial<GamePlayer>) => void;
  addPlayer: (player: GamePlayer) => void;
  removePlayer: (playerId: string) => void;
  setLocalPlayerId: (playerId: string) => void;
  setPhase: (phase: GamePhase) => void;
  setPartyCode: (code: string) => void;
  reset: () => void;
}

const MultiplayerGameContext = createContext<MultiplayerGameContextValue | null>(null);

export function useMultiplayerGame() {
  const context = useContext(MultiplayerGameContext);
  if (!context) {
    throw new Error("useMultiplayerGame must be used within MultiplayerGameProvider");
  }
  return context;
}

const initialState: GameState = {
  players: {},
  localPlayerId: null,
  phase: "LOBBY",
  partyCode: null,
};

export function MultiplayerGameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(initialState);

  const setPlayers = useCallback((players: Record<string, GamePlayer>) => {
    setState((prev) => ({ ...prev, players }));
  }, []);

  const updatePlayer = useCallback((playerId: string, updates: Partial<GamePlayer>) => {
    setState((prev) => ({
      ...prev,
      players: {
        ...prev.players,
        [playerId]: {
          ...prev.players[playerId],
          ...updates,
        },
      },
    }));
  }, []);

  const addPlayer = useCallback((player: GamePlayer) => {
    setState((prev) => ({
      ...prev,
      players: {
        ...prev.players,
        [player.id]: player,
      },
    }));
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setState((prev) => {
      const { [playerId]: removed, ...rest } = prev.players;
      return { ...prev, players: rest };
    });
  }, []);

  const setLocalPlayerId = useCallback((playerId: string) => {
    setState((prev) => ({ ...prev, localPlayerId: playerId }));
  }, []);

  const setPhase = useCallback((phase: GamePhase) => {
    setState((prev) => ({ ...prev, phase }));
  }, []);

  const setPartyCode = useCallback((code: string) => {
    setState((prev) => ({ ...prev, partyCode: code }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const value: MultiplayerGameContextValue = {
    ...state,
    setPlayers,
    updatePlayer,
    addPlayer,
    removePlayer,
    setLocalPlayerId,
    setPhase,
    setPartyCode,
    reset,
  };

  return (
    <MultiplayerGameContext.Provider value={value}>
      {children}
    </MultiplayerGameContext.Provider>
  );
}
