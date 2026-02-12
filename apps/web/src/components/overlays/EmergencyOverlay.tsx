import { useGame } from "@/contexts/GameContext";
import { useSetPhase } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ArrowRight } from "lucide-react";

export default function EmergencyOverlay() {
  const { activeOverlay, setActiveOverlay } = useGame();
  const setPhase = useSetPhase();
  const { toast } = useToast();

  const isOpen = activeOverlay === "emergency";

  const handleProceedToVoting = async () => {
    try {
      await setPhase.mutateAsync("VOTING");
      setActiveOverlay("voting");
      toast({
        title: "Emergency meeting concluded",
        description: "Proceeding to voting phase.",
      });
    } catch (error: any) {
      toast({
        title: "Phase transition failed",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = () => {
    setActiveOverlay(null);
    toast({
      title: "Emergency dismissed",
      description: "Returning to task phase.",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl mx-4 glass-card border-destructive/20 p-8 animate-float-in">
        <div className="flex flex-col items-center text-center">
          <div className="h-20 w-20 rounded-full bg-destructive/20 border-2 border-destructive/40 flex items-center justify-center mb-6 pulse-glow">
            <ShieldAlert className="h-10 w-10 text-destructive" />
          </div>

          <Badge className="bg-destructive/10 text-destructive border-destructive/25 mb-3">
            EMERGENCY MEETING
          </Badge>

          <h2 className="text-3xl font-bold mb-3">Emergency Called</h2>
          
          <p className="text-muted-foreground mb-8 max-w-md">
            A player has called an emergency meeting. Suspicious activity has been detected. 
            Discuss findings and proceed to vote when ready.
          </p>

          <div className="w-full space-y-3">
            <Button
              onClick={handleProceedToVoting}
              className="w-full h-12 bg-gradient-to-r from-destructive to-destructive/80 text-lg font-semibold"
            >
              Proceed to Voting
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>

            <Button
              variant="outline"
              onClick={handleDismiss}
              className="w-full h-12 border-white/10 bg-white/5"
            >
              Dismiss (Continue Tasks)
            </Button>
          </div>

          <div className="mt-6 text-xs text-muted-foreground">
            Emergency meetings allow immediate voting without completing all tasks
          </div>
        </div>
      </div>
    </div>
  );
}
