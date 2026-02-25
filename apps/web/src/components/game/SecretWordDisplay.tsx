import React, { useEffect, useState } from "react";
import { useGameStore } from "@/stores/useGameStore";

export default function SecretWordDisplay() {
  const { role, encryptedWord, taskProgress, decryptedPercentage } = useGameStore();
  const [prev, setPrev] = useState<string | null>(null);

  useEffect(() => {
    setPrev(encryptedWord);
  }, [encryptedWord]);

  const isCrew = role === "CREWMATE";
  const label = isCrew ? "Encryption Bar" : "Decryption Bar";
  const progressLabel = isCrew ? "Progress" : "Decryption";
  const progress = isCrew ? taskProgress : decryptedPercentage;
  const barColor = isCrew ? "bg-blue-500" : "bg-purple-500";
  const shadowColor = isCrew ? "rgba(59,130,246,0.5)" : "rgba(168,85,247,0.5)";

  return (
    <div className="p-3 bg-white/5 rounded-lg border border-white/10">
      <div className="text-xs text-muted-foreground uppercase tracking-widest text-blue-400">{label}</div>
      <div className="font-mono text-2xl tracking-widest mt-2 animate-pulse">{encryptedWord ?? "----"}</div>
      <div className="mt-2 text-sm">{progressLabel}: {progress}%</div>
      <div className="w-full h-2 bg-white/10 rounded mt-2">
        <div
          style={{ width: `${progress}%`, boxShadow: `0 0 10px ${shadowColor}` }}
          className={`h-2 ${barColor} rounded transition-all duration-500`}
        />
      </div>
    </div>
  );
}
