import React from "react";
import { useGameStore } from "@/stores/useGameStore";
import { socket } from "@/shared/socket";

export default function VotingOverlay() {
  const { voting, players, localPlayerId, setHasVoted, setSelectedPlayer } = useGameStore();

  if (voting.results || voting === undefined) return null;

  const alivePlayers = Object.values(players).filter((p) => true); // TODO: filter by isAlive when available

  const handleVote = (playerId: string | null) => {
    setSelectedPlayer(playerId);
    socket.emit("vote", { target: playerId });
    setHasVoted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-black/60 absolute inset-0" />
      <div className="relative bg-white rounded-lg p-6 w-96">
        <h3 className="font-semibold mb-3">Voting</h3>
        <div className="space-y-2">
          {alivePlayers.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <div>{p.name}</div>
              <button className="px-3 py-1 bg-blue-500 text-white rounded" disabled={voting.hasVoted} onClick={() => handleVote(p.id)}>
                Vote
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between mt-3">
            <div>Skip</div>
            <button className="px-3 py-1 bg-gray-500 text-white rounded" disabled={voting.hasVoted} onClick={() => handleVote(null)}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
