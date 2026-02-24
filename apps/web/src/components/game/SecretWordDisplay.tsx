import React, { useEffect, useState } from "react";
import { useGameStore } from "@/stores/useGameStore";

export default function SecretWordDisplay() {
  const { role, encryptedWord, decryptedPercentage } = useGameStore();
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    setPrev(encryptedWord);
  }, [encryptedWord]);

  if (role !== "CREWMATE") {
    return <div className="text-sm text-muted-foreground">Unknown Data</div>;
  }

  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
      <div className="text-xs text-muted-foreground">Encrypted Word</div>
      <div className="font-mono text-2xl tracking-widest mt-2 animate-pulse">{encryptedWord ?? "----"}</div>
      <div className="mt-2 text-sm">Decrypted: {decryptedPercentage}%</div>
      <div className="w-full h-2 bg-white/10 rounded mt-2">
        <div style={{ width: `${decryptedPercentage}%` }} className="h-2 bg-green-400 rounded" />
      </div>
    </div>
  );
}
