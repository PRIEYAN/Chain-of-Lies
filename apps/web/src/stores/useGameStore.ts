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
    role?: "CREWMATE" | "IMPOSTER";
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

export type GamePhase = "LOBBY" | "PARTY" | "TASKS" | "MEETING" | "VOTING" | "ENDED";

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

    // Game Logic
    role: "CREWMATE" | "IMPOSTER" | null;
    imposterId: string | null;
    secretWord: string | null;
    encryptedWord: string | null;
    decryptedPercentage: number;
    taskProgress: number;
    round: number;
    meeting: {
        startedAt: number | null;
        messages: Array<{ playerId: string; message: string }>;
        referenceSentences: string[];
        timeRemaining: number;
    };
    voting: {
        hasVoted: boolean;
        selectedPlayerId: string | null;
        results: Record<string, number> | null;
    };
    isAlive: boolean;
    winner: "CREWMATE" | "IMPOSTER" | null;
    // Task tracking
    completedTasks: Record<string, boolean>;
    taskCompletionCount: number;
    lastTaskMessage: string | null;

    // Actions
    setConnected: (connected: boolean) => void;
    setParty: (party: Party | null, partyCode?: string) => void;
    setPlayers: (players: Record<string, Player>) => void;
    updatePlayer: (playerId: string, updates: Partial<Player>) => void;
    setLocalPlayerId: (playerId: string) => void;
    setPhase: (phase: GamePhase) => void;
    setRole: (role: "CREWMATE" | "IMPOSTER" | null) => void;
    setImposterId: (imposterId: string | null) => void;
    setEncryptedWord: (encryptedWord: string | null) => void;
    setDecryptedPercentage: (decryptedPercentage: number) => void;
    setTaskProgress: (taskProgress: number) => void;
    setSecretWord?: (secretWord: string | null) => void;
    setIsAlive?: (isAlive: boolean) => void;
    startMeeting: (startedAt?: number) => void;
    // Task actions
    markTaskCompleted: (taskId: string) => void;
    incrementTaskCompletionCount: () => void;
    setLastTaskMessage: (msg: string | null) => void;
    addMeetingMessage: (message: { playerId: string; message: string }) => void;
    updateMeetingTimer: (timeRemaining: number) => void;
    endMeeting: () => void;
    startVoting: (candidates: Array<{ playerId: string; name: string }>) => void;
    setHasVoted: (hasVoted: boolean) => void;
    setSelectedPlayer: (selectedPlayerId: string | null) => void;
    setVotingResults: (results: Record<string, number> | null) => void;
    endVoting: () => void;
    endGame: (winner: "CREWMATE" | "IMPOSTER" | null) => void;
    setRound: (round: number) => void;
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
    role: null as "CREWMATE" | "IMPOSTER" | null,
    imposterId: null as string | null,
    secretWord: null,
    encryptedWord: null,
    decryptedPercentage: 0,
    taskProgress: 0,
    round: 1,
    completedTasks: {},
    taskCompletionCount: 0,
    lastTaskMessage: null,
    meeting: {
        startedAt: null,
        messages: [],
        referenceSentences: [],
        timeRemaining: 60,
    },
    voting: {
        hasVoted: false,
        selectedPlayerId: null,
        results: null,
    },
    isAlive: true,
    winner: null as "CREWMATE" | "IMPOSTER" | null,
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

    setRole: (role) => set({ role }),

    setImposterId: (imposterId: string | null) => set({ imposterId }),

    setEncryptedWord: (encryptedWord) => set({ encryptedWord }),

    setDecryptedPercentage: (decryptedPercentage) => set({ decryptedPercentage }),

    setTaskProgress: (taskProgress) => set({ taskProgress }),

    setSecretWord: (secretWord: string | null) => set({ secretWord }),

    setIsAlive: (isAlive: boolean) => set({ isAlive }),

    // Task actions
    markTaskCompleted: (taskId: string) =>
        set((state) => ({ completedTasks: { ...state.completedTasks, [taskId]: true } })),

    incrementTaskCompletionCount: () =>
        set((state) => ({ taskCompletionCount: (state.taskCompletionCount || 0) + 1 })),

    setLastTaskMessage: (msg: string | null) => set({ lastTaskMessage: msg }),

    startMeeting: (startedAt?: number) =>
        set({
            meeting: {
                startedAt: startedAt ?? Date.now(),
                messages: [],
                referenceSentences: [],
                timeRemaining: 60,
            },
            phase: "MEETING",
        }),

    addMeetingMessage: (message) =>
        set((state) => ({
            meeting: {
                ...state.meeting,
                messages: [...state.meeting.messages, message],
            },
        })),

    updateMeetingTimer: (timeRemaining) =>
        set((state) => ({
            meeting: {
                ...state.meeting,
                timeRemaining,
            },
        })),

    endMeeting: () =>
        set((state) => ({
            meeting: {
                ...state.meeting,
                startedAt: null,
                timeRemaining: 0,
            },
        })),

    startVoting: (candidates) =>
        set({
            voting: {
                hasVoted: false,
                selectedPlayerId: null,
                results: null,
            },
            phase: "VOTING",
        }),

    setHasVoted: (hasVoted) =>
        set((state) => ({
            voting: {
                ...state.voting,
                hasVoted,
            },
        })),

    setSelectedPlayer: (selectedPlayerId: string | null) =>
        set((state) => ({
            voting: {
                ...state.voting,
                selectedPlayerId,
            },
        })),

    setVotingResults: (results: Record<string, number> | null) =>
        set({ voting: { hasVoted: false, selectedPlayerId: null, results } }),

    endVoting: () =>
        set((state) => ({
            voting: {
                ...state.voting,
                hasVoted: false,
            },
        })),

    endGame: (winner) =>
        set({
            winner,
            phase: "ENDED",
        }),

    setRound: (round) => set({ round }),

    reset: () =>
        set({
            ...initialState,
            phase: "LOBBY",
            role: null,
            imposterId: null,
            secretWord: null,
            encryptedWord: null,
            decryptedPercentage: 0,
            taskProgress: 0,
            meeting: {
                startedAt: null,
                messages: [],
                referenceSentences: [],
                timeRemaining: 60,
            },
            voting: {
                hasVoted: false,
                selectedPlayerId: null,
                results: null,
            },
            isAlive: true,
            winner: null,
        }),
}));
