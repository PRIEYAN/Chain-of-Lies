/**
 * Game Socket Hook
 * 
 * Handles all socket events related to in-game multiplayer
 */
import { useEffect, useRef } from "react";
import { socket } from "@/shared/socket";
import { useGameStore, type Player } from "@/stores/useGameStore";

export function useGameSocket() {
  const { setPlayers, localPlayerId, partyCode } = useGameStore();
  const lastEmitTime = useRef(0);
  const EMIT_THROTTLE = 50; // 20fps

  useEffect(() => {
    // Game events
    const handlePlayersUpdate = (data: { players: Record<string, Player> }) => {
      console.log("[Game] Players update:", data);
      
      const updatedPlayers: Record<string, Player> = {};
      const currentTime = Date.now();
      
      Object.entries(data.players).forEach(([id, player]) => {
        const existingPlayer = useGameStore.getState().players[id];
        
        // For remote players, set target position for interpolation
        if (id !== localPlayerId) {
          updatedPlayers[id] = {
            ...player,
            x: existingPlayer?.x ?? player.x,
            y: existingPlayer?.y ?? player.y,
            targetX: player.x,
            targetY: player.y,
            timestamp: currentTime,
          };
        } else {
          // Keep local player as-is (already updated locally)
          updatedPlayers[id] = existingPlayer || player;
        }
      });
      
      setPlayers(updatedPlayers);
    };

    const handlePlayerJoined = (data: { player: Player }) => {
      console.log("[Game] Player joined:", data);
      // Update will come through players_update
    };

    const handlePlayerLeft = (data: { playerId: string }) => {
      console.log("[Game] Player left:", data);
      // Update will come through players_update
    };

    // Register event listeners
    socket.on("players_update", handlePlayersUpdate);
    socket.on("player_joined", handlePlayerJoined);
    socket.on("player_left", handlePlayerLeft);

    // Cleanup
    return () => {
      socket.off("players_update", handlePlayersUpdate);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
    };
  }, [setPlayers, localPlayerId]);

  // Return socket actions
  return {
    emitPlayerMove: (x: number, y: number) => {
      const now = Date.now();
      if (now - lastEmitTime.current < EMIT_THROTTLE) {
        return; // Throttle to 20fps
      }
      lastEmitTime.current = now;

      socket.emit("player_move", { x, y });
    },
    leaveGame: () => {
      socket.emit("leave_game");
    },
  };
}
