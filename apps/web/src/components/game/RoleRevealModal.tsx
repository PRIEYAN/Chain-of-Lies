import React, { useState, useEffect } from "react";
import { useGameStore } from "@/stores/useGameStore";

export default function RoleRevealModal() {
  const { role, encryptedWord } = useGameStore();
  const [showReveal, setShowReveal] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);

  useEffect(() => {
    console.log("[RoleRevealModal] Role updated:", role);
    if (role) {
      console.log("[RoleRevealModal] Setting showReveal to true");
      setShowReveal(true);
      // Trigger reveal animation after a brief delay
      const timer = setTimeout(() => {
        console.log("[RoleRevealModal] Setting isRevealed to true");
        setIsRevealed(true);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [role]);

  console.log("[RoleRevealModal] Render - role:", role, "showReveal:", showReveal, "isRevealed:", isRevealed);

  if (!role || !showReveal) {
    console.log("[RoleRevealModal] Not rendering - role:", role, "showReveal:", showReveal);
    return null;
  }

  const isImposter = role === "IMPOSTER";

  const handleContinue = () => {
    console.log("[RoleRevealModal] User clicked continue");
    setShowReveal(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center">
      {/* Full screen background with blocking overlay */}
      <div
        className={`absolute inset-0 transition-all duration-1000 ${
          isRevealed
            ? isImposter
              ? "bg-gradient-to-br from-red-950 via-red-900 to-black"
              : "bg-gradient-to-br from-blue-950 via-blue-900 to-black"
            : "bg-black"
        }`}
      />

      {/* Content Container */}
      <div className="relative z-20 h-screen flex flex-col items-center justify-center w-full">
        {/* Main Role Display */}
        <div
          className={`text-center transition-all duration-700 transform ${
            isRevealed
              ? "scale-100 opacity-100"
              : "scale-50 opacity-0"
          }`}
        >
          {/* Role Title - HUGE */}
          <h1
            className={`text-8xl font-black mb-12 tracking-widest drop-shadow-2xl ${
              isImposter
                ? "text-red-300 animate-pulse-slow"
                : "text-blue-300 animate-pulse-slow"
            }`}
          >
            {isImposter ? "IMPOSTOR" : "IN-MATE"}
          </h1>

          {/* Character Icon representation */}
          <div className="mb-12 flex justify-center">
            {isImposter ? (
              <div className="text-9xl">🔴</div>
            ) : (
              <div className="text-9xl">🔵</div>
            )}
          </div>

          {/* Mission Brief */}
          <div className="max-w-2xl mx-auto mb-12">
            <p
              className={`text-2xl font-bold mb-6 ${
                isImposter ? "text-red-200" : "text-blue-200"
              }`}
            >
              {isImposter
                ? "Your Mission: Sabotage and Decrypt"
                : "Your Mission: Identify the Impostor"}
            </p>

            {/* Role-specific briefing */}
            {isImposter ? (
              <div className="space-y-3 text-lg text-red-300">
                <p>✗ You are the saboteur</p>
                <p>✗ Complete sabotage tasks to decrypt the secret word</p>
                <p>✗ Avoid getting voted out in meetings</p>
                <p>✗ If you decrypt 100%, you win</p>
              </div>
            ) : (
              <div className="space-y-3 text-lg text-blue-300">
                <p>✓ You are a loyal in-mate</p>
                <p>✓ Complete your encrypted task</p>
                <p>✓ Help identify and eliminate the impostor</p>
                <p>✓ Your encrypted task:</p>
                <div className="bg-black/50 rounded-lg px-6 py-3 font-mono text-blue-100 text-2xl tracking-widest mt-4">
                  {encryptedWord ?? "----"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Continue Button */}
        <div
          className={`absolute bottom-12 transition-all duration-700 ${
            isRevealed ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <button
            onClick={handleContinue}
            className={`px-8 py-3 text-lg font-bold rounded-lg transition-all hover:scale-105 ${
              isImposter
                ? "bg-red-600 hover:bg-red-500 text-white border-2 border-red-400"
                : "bg-blue-600 hover:bg-blue-500 text-white border-2 border-blue-400"
            }`}
          >
            Enter Game
          </button>
        </div>

        {/* Optional: Loading indicator before reveal */}
        {!isRevealed && (
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4" />
            <p className="text-white/60">Assigning Role...</p>
          </div>
        )}
      </div>
    </div>
  );
}
