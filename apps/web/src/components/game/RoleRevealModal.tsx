import React from "react";
import { useGameStore } from "@/stores/useGameStore";

export default function RoleRevealModal() {
  const { role, encryptedWord } = useGameStore();

  if (!role) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div className="bg-black/60 absolute inset-0" />
      <div className="relative bg-white rounded-lg p-6 w-96 shadow-lg">
        <h2 className="text-xl font-bold mb-2">
          {role === "CREWMATE" ? "You are an Inmate" : "You are the Tamperer"}
        </h2>
        {role === "CREWMATE" ? (
          <div>
            <p className="text-sm text-muted-foreground">Encrypted data:</p>
            <div className="mt-3 font-mono text-lg">{encryptedWord ?? "----"}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">You do not see the secret word.</div>
        )}
      </div>
    </div>
  );
}
