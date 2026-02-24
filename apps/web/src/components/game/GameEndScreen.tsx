import React from "react";
import { useGameStore } from "@/stores/useGameStore";

export default function GameEndScreen() {
  const { winner, role } = useGameStore();

  if (!winner) return null;

  const isWinner = (winner === "CREWMATE" && role === "CREWMATE") || (winner === "IMPOSTER" && role === "IMPOSTER");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-black/60 absolute inset-0" />
      <div className="relative bg-white rounded-lg p-6 w-96 text-center">
        <h2 className="text-2xl font-bold mb-2">{isWinner ? "Victory" : "Defeat"}</h2>
        <p className="mb-4">
          {winner === "CREWMATE" ? (
            role === "IMPOSTER" ? "You have been pwned" : "Crewmates win"
          ) : (
            role === "IMPOSTER" ? "Your Tamper Was Great" : "You have lost"
          )}
        </p>
      </div>
    </div>
  );
}
