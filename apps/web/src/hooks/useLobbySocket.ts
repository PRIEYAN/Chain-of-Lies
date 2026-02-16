/**
 * Lobby Socket Hook
 * 
 * Handles all socket events related to lobby and party management
 */
import { useEffect } from "react";
import { socket } from "@/shared/socket";
import { useGameStore, type Party, type Player } from "@/stores/useGameStore";

export interface PartyListItem {
    id: string;
    partyCode: string;
    hostName: string;
    playerCount: number;
    maxPlayers: number;
}

export function useLobbySocket() {
    const {
        setConnected,
        setParty,
        setPlayers,
        setLocalPlayerId,
        setPhase,
        partyCode,
    } = useGameStore();

    useEffect(() => {
        // Connect socket when lobby mounts
        if (!socket.connected) {
            socket.connect();
        }

        // Connection events
        const handleConnect = () => {
            console.log("[Lobby] Socket connected");
            setConnected(true);
            // Request party list
            socket.emit("get_parties");
        };

        const handleDisconnect = () => {
            console.log("[Lobby] Socket disconnected");
            setConnected(false);
        };

        // Party events
        const handlePartyJoined = (data: {
            party: Party;
            players: Player[];
            localPlayerId: string;
        }) => {
            console.log("[Lobby] Party joined:", data);
            setParty(data.party, data.party.partyCode);
            setLocalPlayerId(data.localPlayerId);

            // Convert players array to Record
            const playersRecord: Record<string, Player> = {};
            data.players.forEach((player) => {
                playersRecord[player.id] = player;
            });
            setPlayers(playersRecord);
            setPhase("PARTY");
        };

        const handlePartyPlayerUpdate = (data: { players: Player[] }) => {
            console.log("[Lobby] Party player update:", data);
            // Convert players array to Record
            const playersRecord: Record<string, Player> = {};
            data.players.forEach((player) => {
                playersRecord[player.id] = player;
            });
            setPlayers(playersRecord);
        };

        const handlePartyListUpdated = (data: { parties: PartyListItem[] }) => {
            console.log("[Lobby] Party list updated:", data);
            // This could be stored in a separate state if needed
        };

        const handleGameStarted = () => {
            console.log("[Lobby] Game started");
            setPhase("GAME");
        };

        const handleError = (data: { message: string }) => {
            console.error("[Lobby] Error:", data.message);
            // You can add toast notification here
        };

        // Register event listeners
        socket.on("connect", handleConnect);
        socket.on("disconnect", handleDisconnect);
        socket.on("party_joined", handlePartyJoined);
        socket.on("party_player_update", handlePartyPlayerUpdate);
        socket.on("party_list_updated", handlePartyListUpdated);
        socket.on("game_started", handleGameStarted);
        socket.on("error", handleError);

        // Cleanup
        return () => {
            socket.off("connect", handleConnect);
            socket.off("disconnect", handleDisconnect);
            socket.off("party_joined", handlePartyJoined);
            socket.off("party_player_update", handlePartyPlayerUpdate);
            socket.off("party_list_updated", handlePartyListUpdated);
            socket.off("game_started", handleGameStarted);
            socket.off("error", handleError);
        };
    }, [setConnected, setParty, setPlayers, setLocalPlayerId, setPhase]);

    // Return socket actions
    return {
        createParty: (name: string) => {
            socket.emit("create_party", { name });
        },
        joinParty: (partyCode: string, name: string) => {
            socket.emit("join_party", { partyCode, name });
        },
        leaveParty: () => {
            socket.emit("leave_party");
            setParty(null);
            setPlayers({});
            setPhase("LOBBY");
        },
        startGame: () => {
            socket.emit("start_game");
        },
        getParties: () => {
            socket.emit("get_parties");
        },
    };
}
