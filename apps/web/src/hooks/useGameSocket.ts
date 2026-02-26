/**
 * Game Socket Hook
 * 
 * Handles all socket events related to in-game multiplayer
 */
import { useEffect, useRef } from "react";
import { socket } from "@/shared/socket";
import { useGameStore, type Player } from "@/stores/useGameStore";

export function useGameSocket() {
  const {
    setPlayers,
    localPlayerId,
    partyCode,
    setPhase,
    setRole,
    setEncryptedWord,
    setDecryptedPercentage,
    setTaskProgress,
    setSecretWord,
    startMeeting,
    addMeetingMessage,
    updateMeetingTimer,
    endMeeting,
    startVoting,
    setHasVoted,
    setSelectedPlayer,
    setVotingResults,
    setIsAlive,
    endGame,
    markTaskCompleted,
    incrementTaskCompletionCount,
    setLastTaskMessage,
  } = useGameStore();
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

    const handleRoleAssigned = (data: { role: "CREWMATE" | "IMPOSTER"; encryptedWord?: string; secretWord?: string }) => {
      console.log("[Game] role_assigned (duplicate, handled in lobby)", data);
      // Already handled in useLobbySocket, this is just a backup
    };

    const handleWordUpdate = (data: { encryptedWord?: string; decryptedPercentage?: number; taskProgress?: number }) => {
      console.log("[Game] word_update received", data);
      if (data.encryptedWord) setEncryptedWord(data.encryptedWord);
      if (typeof data.decryptedPercentage === "number") setDecryptedPercentage(data.decryptedPercentage);
      if (typeof data.taskProgress === "number") setTaskProgress(data.taskProgress);
    };

    const handleTaskUpdate = (data: any) => {
      console.log("[Game] task_update", data);
      const taskId = data?.taskId;
      const playerName = data?.playerName || null;

      if (taskId) {
        if (typeof data.taskProgress === "number") setTaskProgress(data.taskProgress);
        // Only mark the task completed for the client who performed it
        if ((data.playerId && data.playerId === localPlayerId) || (data.playerSocketId && data.playerSocketId === localPlayerId)) {
          markTaskCompleted(taskId);
          if (data.taskName) markTaskCompleted(String(data.taskName));
        }

        // Increment visible completion counter for everyone
        incrementTaskCompletionCount();

        // Show a short-lived message
        const msg = playerName ? `${playerName} completed a task` : `A player completed a task`;
        setLastTaskMessage(msg);
        setTimeout(() => setLastTaskMessage(null), 4000);
      }
    };

    const handleMeetingStarted = (data: { startedAt?: number; referenceSentences?: string[] }) => {
      console.log("[Game] meeting_started", data);
      startMeeting(data.startedAt);
      if (data.referenceSentences) {
        // store reference sentences
        useGameStore.setState((s) => ({ meeting: { ...s.meeting, referenceSentences: data.referenceSentences || [] } }));
      }
    };

    const handleMeetingMessage = (data: { playerId: string; message: string }) => {
      addMeetingMessage({ ...data });
    };

    const handleMeetingEnded = () => {
      endMeeting();
    };

    const handleVotingStarted = (data: { candidates: Array<{ playerId: string; name: string }> }) => {
      console.log("[Game] voting_started", data);
      // startVoting expects candidates but we refactored; set voting candidates via state directly
      useGameStore.setState((s) => ({ voting: { ...s.voting, hasVoted: false, selectedPlayerId: null }, phase: "VOTING" }));
    };

    const handleVotingResults = (data: { results: Record<string, number> }) => {
      setVotingResults(data.results);
    };

    const handlePlayerEliminated = (data: { playerId: string }) => {
      console.log("[Game] player_eliminated", data);
      // mark player not alive
      setIsAlive?.(false);
      // remove from players list handled by players_update
    };

    const handleGameEnded = (data: { winner: "CREWMATE" | "IMPOSTER" }) => {
      console.log("[Game] game_ended", data);
      endGame(data.winner);
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
    socket.on("role_assigned", handleRoleAssigned);
    socket.on("word_update", handleWordUpdate);
    socket.on("task_update", handleTaskUpdate);
    socket.on("meeting_started", handleMeetingStarted);
    socket.on("meeting_message", handleMeetingMessage);
    socket.on("meeting_ended", handleMeetingEnded);
    socket.on("voting_started", handleVotingStarted);
    socket.on("voting_results", handleVotingResults);
    socket.on("player_eliminated", handlePlayerEliminated);
    socket.on("game_ended", handleGameEnded);

    // Cleanup
    return () => {
      socket.off("players_update", handlePlayersUpdate);
      socket.off("player_joined", handlePlayerJoined);
      socket.off("player_left", handlePlayerLeft);
      socket.off("role_assigned", handleRoleAssigned);
      socket.off("word_update", handleWordUpdate);
      socket.off("task_update", handleTaskUpdate);
      socket.off("meeting_started", handleMeetingStarted);
      socket.off("meeting_message", handleMeetingMessage);
      socket.off("meeting_ended", handleMeetingEnded);
      socket.off("voting_started", handleVotingStarted);
      socket.off("voting_results", handleVotingResults);
      socket.off("player_eliminated", handlePlayerEliminated);
      socket.off("game_ended", handleGameEnded);
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
