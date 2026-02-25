import React from "react";
import { useGameStore } from "@/stores/useGameStore";

export default function GameEndScreen() {
  const { winner, role } = useGameStore();

  if (!winner) return null;

  const isWinner = (winner === "CREWMATE" && role === "CREWMATE") || (winner === "IMPOSTER" && role === "IMPOSTER");
  const winColor = winner === "IMPOSTER" ? "text-red-500" : "text-blue-500";
  const bgGlow = winner === "IMPOSTER" ? "rgba(239, 68, 68, 0.2)" : "rgba(59, 130, 246, 0.2)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="bg-black/80 absolute inset-0 backdrop-blur-sm" />
      <div
        className="relative bg-zinc-900 border-2 border-white/10 rounded-xl p-8 w-[450px] text-center shadow-2xl"
        style={{ boxShadow: `0 0 40px ${bgGlow}` }}
      >
        <h2 className={`text-4xl font-black mb-4 uppercase tracking-tighter ${isWinner ? "text-white" : "text-zinc-500"}`}>
          {isWinner ? "Victory" : "Defeat"}
        </h2>

        <div className={`text-xl font-bold mb-6 ${winColor}`}>
          {winner === "IMPOSTER" ? (
            "IMPOSTER HAS DECRYPTED THE WORD! IMPOSTER WINS!"
          ) : (
            "CREWMATES HAVE ENCRYPTED THE WORD! CREWMATES WIN!"
          )}
        </div>

        <p className="text-muted-foreground text-sm italic">
          {winner === "CREWMATE" ? (
            role === "IMPOSTER" ? "The encryption was too strong for your override." : "The secret data is safe. Well done."
          ) : (
            role === "IMPOSTER" ? "Your tampering was absolute. The word is yours." : "The imposter managed to decrypt our secrets."
          )}
        </p>

        <div className="mt-8">
          <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className={`h-full ${winner === "IMPOSTER" ? "bg-red-500" : "bg-blue-500"} animate-pulse`} style={{ width: '100%' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
