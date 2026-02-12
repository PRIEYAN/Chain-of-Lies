import { useState } from "react";
import { useGame } from "@/contexts/GameContext";
import { useGameState } from "@/hooks/use-game";
import { useGameSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

const TASK_DETAILS: Record<string, { title: string; description: string; hint: string }> = {
  "A1": {
    title: "Block Header Validation",
    description: "Validate the block header fields and verify the parent link integrity.",
    hint: "Check timestamp, nonce, and parent hash consistency."
  },
  "A2": {
    title: "State Root Verification",
    description: "Confirm that the state root hash matches the execution result.",
    hint: "Compare computed merkle root with the declared state root."
  },
  "B1": {
    title: "Transaction Set Audit",
    description: "Check transaction ordering and signature validity.",
    hint: "Verify all signatures and ensure no duplicate nonces."
  },
  "B2": {
    title: "Gas & Fees Calculation",
    description: "Verify gas totals and fee routing accuracy.",
    hint: "Sum all transaction gas and validate fee distribution."
  },
};

export default function TaskOverlay() {
  const { activeOverlay, setActiveOverlay, activeTaskId, setActiveTaskId } = useGame();
  const { data: gameState } = useGameState();
  const { emit } = useGameSocket();
  const { toast } = useToast();
  
  const [payload, setPayload] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isOpen = activeOverlay === "task" && activeTaskId !== null;
  const task = activeTaskId ? TASK_DETAILS[activeTaskId] : null;
  const role = gameState?.role ?? "Unknown";
  const round = gameState?.round ?? 1;

  const handleClose = () => {
    setActiveOverlay(null);
    setActiveTaskId(null);
    setPayload("");
  };

  const handleSubmit = async () => {
    if (!activeTaskId || !payload.trim()) return;

    setSubmitting(true);
    try {
      emit("submitTask", {
        round,
        role,
        payload: {
          taskId: activeTaskId,
          data: payload,
          timestamp: new Date().toISOString(),
        },
      });

      toast({
        title: "Task submitted",
        description: `${task?.title} completed successfully.`,
      });

      handleClose();
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] glass-card border-primary/20">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <span className="text-primary">Task {activeTaskId}</span>
            <span>•</span>
            <span>{task.title}</span>
          </DialogTitle>
          <DialogDescription className="text-base">
            {task.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
            <div className="text-xs font-semibold text-accent mb-1">Hint</div>
            <div className="text-sm text-muted-foreground">{task.hint}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="task-payload">Your Response</Label>
            <Textarea
              id="task-payload"
              placeholder="Enter your validation results, findings, or data..."
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              rows={6}
              className="resize-none bg-white/5 border-white/10"
            />
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!payload.trim() || submitting}
              className="flex-1 bg-gradient-to-r from-primary to-accent"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit Task
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
