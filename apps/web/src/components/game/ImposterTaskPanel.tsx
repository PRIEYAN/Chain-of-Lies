import React from "react";
import { useGameStore } from "@/stores/useGameStore";

const SABOTAGE_TASKS = [
  "System Override",
  "Data Corruption",
  "Signal Interference",
  "Fake Wiring",
  "Decryption Minigame",
  "Reactor Meltdown",
  "Vent Sabotage",
  "Shield Corruption",
  "Oxygen Override",
  "Emergency System Hack",
];

export default function ImposterTaskPanel() {
  const { role } = useGameStore();
  if (role !== "IMPOSTER") return null;

  return (
    <div className="fixed right-4 top-24 w-64 bg-white/5 border border-white/10 rounded p-3 space-y-2">
      <h3 className="font-semibold">Sabotage Tasks</h3>
      <div className="grid grid-cols-1 gap-1">
        {SABOTAGE_TASKS.map((t, i) => (
          <div key={i} className="px-2 py-1 rounded bg-white/3">
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}
