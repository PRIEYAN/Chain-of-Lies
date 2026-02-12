import { useGame } from "@/contexts/GameContext";
import { useGameState } from "@/hooks/use-game";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Users, Clock } from "lucide-react";

export default function HUD() {
  const { phase, players } = useGame();
  const { data: gameState } = useGameState();
  
  const role = gameState?.role ?? "Unknown";
  const isTamperer = gameState?.isTamperer ?? false;
  const round = gameState?.round ?? 1;
  const timer = gameState?.timer ?? 0;

  return (
    <div className="fixed top-0 left-0 right-0 z-10 pointer-events-none">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          {/* Left side - Phase and Round */}
          <div className="flex flex-col gap-2 pointer-events-auto">
            <Badge 
              className="bg-primary/10 text-primary border-primary/25 text-sm px-3 py-1.5"
            >
              {phase}
            </Badge>
            <Badge 
              className="bg-white/5 border-white/10 text-foreground/80 text-sm px-3 py-1.5"
            >
              Round {round}
            </Badge>
          </div>

          {/* Center - Timer */}
          <div className="pointer-events-auto">
            <div className="glass-card px-4 py-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-lg font-semibold tabular-nums">
                {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
              </span>
            </div>
          </div>

          {/* Right side - Role and Players */}
          <div className="flex flex-col gap-2 items-end pointer-events-auto">
            <Badge 
              className={cn(
                "text-sm px-3 py-1.5 border",
                isTamperer 
                  ? "bg-destructive/10 text-destructive border-destructive/25" 
                  : "bg-accent/10 text-accent border-accent/25"
              )}
            >
              {role}
            </Badge>
            <Badge 
              className="bg-white/5 border-white/10 text-foreground/80 text-sm px-3 py-1.5 flex items-center gap-1.5"
            >
              <Users className="h-3.5 w-3.5" />
              {players.size}
            </Badge>
          </div>
        </div>

        {/* Controls hint */}
        <div className="mt-4 flex justify-center">
          <div className="glass-card px-4 py-2 text-xs text-muted-foreground pointer-events-auto">
            <span className="font-semibold text-foreground">WASD</span> or <span className="font-semibold text-foreground">Arrow Keys</span> to move • <span className="font-semibold text-foreground">E</span> to interact
          </div>
        </div>
      </div>
    </div>
  );
}
