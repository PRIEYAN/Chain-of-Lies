import { useState } from "react";
import { useGame } from "@/contexts/GameContext";
import { useGameState, useLobbyPlayers, useSetPhase } from "@/hooks/use-game";
import { useGameSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Vote, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function VotingOverlay() {
  const { activeOverlay, setActiveOverlay } = useGame();
  const { data: gameState } = useGameState();
  const { data: players } = useLobbyPlayers();
  const { emit } = useGameSocket();
  const { toast } = useToast();
  const setPhase = useSetPhase();
  
  const [selected, setSelected] = useState<string>("");
  const [voting, setVoting] = useState(false);

  const isOpen = activeOverlay === "voting";
  const round = gameState?.round ?? 1;
  const timer = gameState?.timer ?? 45;

  const handleVote = async () => {
    if (!selected) return;

    setVoting(true);
    try {
      emit("castVote", {
        round,
        targetPlayerId: selected === "abstain" ? null : selected,
      });

      toast({
        title: "Vote cast",
        description: selected === "abstain" 
          ? "You abstained this round." 
          : `You voted for ${players?.find(p => p.id === selected)?.username}`,
      });

      // Transition to reveal phase
      await setPhase.mutateAsync("REVEAL");
      setActiveOverlay("reveal");
    } catch (error: any) {
      toast({
        title: "Vote failed",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setVoting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 glass-card border-accent/20 p-6 animate-float-in">
        <div className="flex items-start justify-between mb-6">
          <div>
            <Badge className="bg-accent/10 text-accent border-accent/25 mb-2">
              VOTING PHASE
            </Badge>
            <h2 className="text-3xl font-bold">Cast Your Vote</h2>
            <p className="text-muted-foreground mt-1">
              Choose who you believe is the Tamperer
            </p>
          </div>
          <div className="glass-card px-4 py-2 flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            <span className="text-lg font-semibold tabular-nums">
              {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, "0")}
            </span>
          </div>
        </div>

        <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto pr-2">
          <RadioGroup value={selected} onValueChange={setSelected}>
            {players?.map(player => (
              <div
                key={player.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-4 transition-all cursor-pointer",
                  selected === player.id
                    ? "border-accent/40 bg-accent/10"
                    : "border-white/10 bg-white/5 hover:bg-white/7 hover:border-white/20"
                )}
              >
                <RadioGroupItem value={player.id} id={`vote-${player.id}`} />
                <Label htmlFor={`vote-${player.id}`} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{player.username}</span>
                    {player.isHost && (
                      <Badge className="bg-primary/10 text-primary border-primary/25">
                        Host
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>
            ))}

            <div
              className={cn(
                "flex items-center gap-3 rounded-xl border p-4 transition-all cursor-pointer",
                selected === "abstain"
                  ? "border-accent/40 bg-accent/10"
                  : "border-white/10 bg-white/5 hover:bg-white/7 hover:border-white/20"
              )}
            >
              <RadioGroupItem value="abstain" id="vote-abstain" />
              <Label htmlFor="vote-abstain" className="flex-1 cursor-pointer">
                <div className="font-semibold">Abstain</div>
                <div className="text-xs text-muted-foreground">
                  Skip voting this round
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleVote}
            disabled={!selected || voting}
            className="flex-1 h-12 bg-gradient-to-r from-primary to-accent text-lg font-semibold"
          >
            <Vote className="h-5 w-5 mr-2" />
            {voting ? "Casting Vote..." : "Cast Vote"}
          </Button>
        </div>
      </div>
    </div>
  );
}
