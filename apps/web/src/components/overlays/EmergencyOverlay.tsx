import { useEffect, useState } from "react";
import { useGame } from "@/contexts/GameContext";
import { useSetPhase } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert, ArrowRight, Users } from "lucide-react";
import { socket } from "@/shared/socket";
import MeetingChat from "./MeetingChat";

interface MeetingData {
  meetingId: string;
  gameId: string;
  totalTasksCompleted: number;
  triggeredAt: string;
  reason: string;
}

export default function EmergencyOverlay() {
  const { activeOverlay, setActiveOverlay } = useGame();
  const setPhase = useSetPhase();
  const { toast } = useToast();

  const [meetingData, setMeetingData] = useState<MeetingData | null>(null);
  const [localPlayerName] = useState(() => {
    // Try to get from URL params or localStorage
    const params = new URLSearchParams(window.location.search);
    return params.get("username") || localStorage.getItem("playerName") || "Anonymous";
  });

  const isOpen = activeOverlay === "emergency";

  // Listen for EMERGENCY_MEETING socket event
  useEffect(() => {
    const handleEmergencyMeeting = (data: MeetingData) => {
      console.log("[Emergency] Meeting triggered:", data);
      setMeetingData(data);
      setActiveOverlay("emergency");
      toast({
        title: "🚨 Emergency Meeting!",
        description: `Task threshold reached (${data.totalTasksCompleted} tasks completed)`,
        variant: "destructive",
      });
    };

    const handleMeetingEnded = () => {
      setMeetingData(null);
      setActiveOverlay(null);
    };

    socket.on("EMERGENCY_MEETING", handleEmergencyMeeting);
    socket.on("MEETING_ENDED", handleMeetingEnded);

    return () => {
      socket.off("EMERGENCY_MEETING", handleEmergencyMeeting);
      socket.off("MEETING_ENDED", handleMeetingEnded);
    };
  }, [setActiveOverlay, toast]);

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
    socket.emit("dismiss_meeting", { meetingId: meetingData?.meetingId });
    setActiveOverlay(null);
    toast({
      title: "Emergency dismissed",
      description: "Returning to task phase.",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl mx-4 glass-card border-destructive/20 animate-float-in">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left side - Meeting info */}
          <div className="p-8 flex flex-col items-center text-center border-b lg:border-b-0 lg:border-r border-white/10">
            <div className="h-20 w-20 rounded-full bg-destructive/20 border-2 border-destructive/40 flex items-center justify-center mb-6 pulse-glow">
              <ShieldAlert className="h-10 w-10 text-destructive" />
            </div>

            <Badge className="bg-destructive/10 text-destructive border-destructive/25 mb-3">
              EMERGENCY MEETING
            </Badge>

            <h2 className="text-3xl font-bold mb-3">Emergency Called</h2>
            
            <p className="text-muted-foreground mb-4 max-w-md">
              A player has called an emergency meeting. Suspicious activity has been detected. 
              Discuss findings and proceed to vote when ready.
            </p>

            {meetingData && (
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-white/5 border-white/10">
                  <Users className="h-3 w-3 mr-1" />
                  {meetingData.totalTasksCompleted} tasks completed
                </Badge>
              </div>
            )}

            <div className="w-full space-y-3 mt-4">
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

          {/* Right side - Live chat */}
          <div className="h-[400px] lg:h-[500px]">
            <MeetingChat
              meetingId={meetingData?.meetingId || ""}
              localPlayerName={localPlayerName}
              className="h-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
