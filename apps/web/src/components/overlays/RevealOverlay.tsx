import { useGame } from "@/contexts/GameContext";
import { useGameState, useLobbyPlayers } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Skull, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RevealOverlay() {
  const { activeOverlay, setActiveOverlay } = useGame();
  const { data: gameState } = useGameState();
  const { data: players } = useLobbyPlayers();

  const isOpen = activeOverlay === "reveal";
  const isTamperer = gameState?.isTamperer ?? false;
  
  // Mock winner determination - in real app this comes from server
  const crewWon = Math.random() > 0.5;
  const didWin = (isTamperer && !crewWon) || (!isTamperer && crewWon);

  const handleNextRound = () => {
    setActiveOverlay(null);
    // In real app, this would trigger server to start next round
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-3xl mx-4 glass-card border-primary/20 p-8 animate-float-in">
        <div className="flex flex-col items-center text-center">
          {/* Winner Icon */}
          <div className={cn(
            "h-24 w-24 rounded-full border-4 flex items-center justify-center mb-6",
            didWin 
              ? "bg-accent/20 border-accent/40 pulse-glow" 
              : "bg-destructive/20 border-destructive/40"
          )}>
            {didWin ? (
              <Trophy className="h-12 w-12 text-accent" />
            ) : (
              <Skull className="h-12 w-12 text-destructive" />
            )}
          </div>

          {/* Result Badge */}
          <Badge className={cn(
            "mb-3 text-base px-4 py-1.5",
            didWin 
              ? "bg-accent/10 text-accent border-accent/25" 
              : "bg-destructive/10 text-destructive border-destructive/25"
          )}>
            {didWin ? "VICTORY" : "DEFEAT"}
          </Badge>

          {/* Title */}
          <h2 className="text-4xl font-bold mb-3">
            {crewWon ? "Crew Wins!" : "Tamperer Wins!"}
          </h2>

          {/* Description */}
          <p className="text-muted-foreground mb-8 max-w-md text-lg">
            {crewWon 
              ? "The Tamperer was successfully identified and eliminated. The ledger is secure."
              : "The Tamperer evaded detection and corrupted the blockchain. Consensus failed."
            }
          </p>

          {/* Player Roles Reveal */}
          <div className="w-full mb-8 max-h-[300px] overflow-y-auto">
            <div className="text-sm font-semibold text-muted-foreground mb-3">
              ROLE REVEAL
            </div>
            <div className="space-y-2">
              {players?.map(player => {
                // Mock role assignment - in real app comes from server
                const playerRole = player.id === "p1" ? "Tamperer" : "Validator";
                const wasTamperer = playerRole === "Tamperer";
                
                return (
                  <div
                    key={player.id}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3",
                      wasTamperer 
                        ? "border-destructive/30 bg-destructive/10" 
                        : "border-white/10 bg-white/5"
                    )}
                  >
                    <span className="font-semibold">{player.username}</span>
                    <Badge className={cn(
                      wasTamperer 
                        ? "bg-destructive/20 text-destructive border-destructive/30" 
                        : "bg-primary/10 text-primary border-primary/25"
                    )}>
                      {playerRole}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="w-full space-y-3">
            <Button
              onClick={handleNextRound}
              className="w-full h-12 bg-gradient-to-r from-primary to-accent text-lg font-semibold"
            >
              <RotateCcw className="h-5 w-5 mr-2" />
              Next Round
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.href = "/"}
              className="w-full h-12 border-white/10 bg-white/5"
            >
              Return to Lobby
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
