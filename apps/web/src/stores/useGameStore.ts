/**
 * Global Game Store using Zustand
 * 
 * Manages all multiplayer state including party, players, and game phase
 */
import { create } from "zustand";

export interface Player {
    id: string;
    name: string;
    x: number;
    y: number;
    color: string;
    isHost: boolean;
    targetX?: number;
    targetY?: number;
    timestamp?: number;
}

export interface Party {
    id: string;
    partyCode: string;
    hostId: string;
    hostName: string;
    maxPlayers: number;
}

export type GamePhase = "LOBBY" | "PARTY" | "GAME" | "ENDED";

interface GameState {
    // Connection
    connected: boolean;

    // Party/Lobby
    partyId: string | null;
    partyCode: string | null;
    party: Party | null;

    // Players
    players: Record<string, Player>;
    localPlayerId: string | null;

    // Game Phase
    phase: GamePhase;

    // Actions
    setConnected: (connected: boolean) => void;
    setParty: (party: Party | null, partyCode?: string) => void;
    setPlayers: (players: Record<string, Player>) => void;
    updatePlayer: (playerId: string, updates: Partial<Player>) => void;
    setLocalPlayerId: (playerId: string) => void;
    setPhase: (phase: GamePhase) => void;
    reset: () => void;
}

const initialState = {
    connected: false,
    partyId: null,
    partyCode: null,
    party: null,
    players: {},
    localPlayerId: null,
    phase: "LOBBY" as GamePhase,
};

export const useGameStore = create<GameState>((set) => ({
    ...initialState,

    setConnected: (connected) => set({ connected }),

    setParty: (party, partyCode) =>
        set({
            party,
            partyId: party?.id || null,
            partyCode: partyCode || null,
        }),

    setPlayers: (players) => set({ players }),

    updatePlayer: (playerId, updates) =>
        set((state) => ({
            players: {
                ...state.players,
                [playerId]: {
                    ...state.players[playerId],
                    ...updates,
                },
            },
        })),

    setLocalPlayerId: (playerId) => set({ localPlayerId: playerId }),

    setPhase: (phase) => set({ phase }),

    reset: () => set(initialState),
}));
