import type { GamePhase } from "@shared/schema";
import { cn } from "@/lib/utils";

const PHASES: GamePhase[] = ["LOBBY", "ROLE", "TASK", "AUDIT", "VOTING", "REVEAL"];

export default function PhaseStepper({ phase, "data-testid": dataTestId }: { phase: GamePhase; "data-testid"?: string }) {
  const idx = Math.max(0, PHASES.indexOf(phase));

  return (
    <div className="w-full" data-testid={dataTestId}>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>Protocol phase</span>
        <span className="font-medium text-foreground/80">
          {idx + 1}/{PHASES.length}
        </span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {PHASES.map((p, i) => {
          const active = i === idx;
          const done = i < idx;
          return (
            <div
              key={p}
              className={cn(
                "h-2 rounded-full border transition-all",
                done
                  ? "bg-accent/30 border-accent/30"
                  : active
                    ? "bg-primary/35 border-primary/40 pulse-glow"
                    : "bg-white/5 border-white/10",
              )}
              title={p}
            />
          );
        })}
      </div>
    </div>
  );
}
