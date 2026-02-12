import React, { useEffect, useMemo, useState } from "react";
import type { Role } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import CountdownPill from "@/components/CountdownPill";
import { Separator } from "@/components/ui/separator";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameSocket } from "@/hooks/use-websocket";

type Fields = {
  primary: string;
  secondary: string;
  notes: string;
};

function roleFields(role: Role) {
  switch (role) {
    case "Validator":
      return { a: "Block height", b: "State root hash" };
    case "Auditor":
      return { a: "Suspicious tx id", b: "Anomaly hypothesis" };
    case "Indexer":
      return { a: "Shard index", b: "Missing reference" };
    case "Miner":
      return { a: "Nonce candidate", b: "Gas estimate" };
    case "SmartContractDev":
      return { a: "Contract address", b: "Invariant checked" };
    case "BridgeOperator":
      return { a: "Source chain", b: "Proof hash" };
    case "Oracle":
      return { a: "Data feed", b: "Timestamp" };
    case "Tamperer":
      return { a: "Tamper vector", b: "Cover story" };
    default:
      return { a: "Field A", b: "Field B" };
  }
}

export default function TaskModal({
  open,
  onOpenChange,
  role,
  round,
  taskId,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  role: Role;
  round: number;
  taskId: string;
  onSubmitted: () => void;
}) {
  const { toast } = useToast();
  const { emit } = useGameSocket();
  const [seconds, setSeconds] = useState(45);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { a, b } = useMemo(() => roleFields(role), [role]);

  const [fields, setFields] = useState<Fields>({ primary: "", secondary: "", notes: "" });

  useEffect(() => {
    if (!open) return;
    setSeconds(45);
    setSubmitting(false);
    setSubmitted(false);
    setFields({ primary: "", secondary: "", notes: "" });
  }, [open, role, round, taskId]);

  useEffect(() => {
    if (!open) return;
    const t = window.setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [open]);

  const canSubmit = !submitted && !submitting && seconds > 0 && fields.primary.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl rounded-2xl border border-white/10 bg-[hsl(var(--card)/0.8)] backdrop-blur-xl shadow-2xl"
        data-testid="task-modal"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-xl sm:text-2xl">
                Task {taskId} — <span className="text-gradient">{role}</span>
              </DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Round {round}. Submit a payload before timeout to keep consensus stable.
              </DialogDescription>
            </div>
            <CountdownPill seconds={seconds} label="Task window" data-testid="task-timer" />
          </div>
        </DialogHeader>

        <Separator className="my-1 bg-white/10" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="task-payload-badge">
              payload
            </Badge>
            {submitted ? (
              <Badge className="bg-accent/10 text-accent border-accent/25" data-testid="task-submitted-badge">
                <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                submitted
              </Badge>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground/80">{a}</div>
              <Input
                value={fields.primary}
                onChange={(e) => setFields((p) => ({ ...p, primary: e.target.value }))}
                className="h-11 rounded-xl bg-white/5 border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/15"
                placeholder="Enter value…"
                data-testid="task-field-primary"
                disabled={submitted || submitting || seconds <= 0}
              />
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold text-foreground/80">{b}</div>
              <Input
                value={fields.secondary}
                onChange={(e) => setFields((p) => ({ ...p, secondary: e.target.value }))}
                className="h-11 rounded-xl bg-white/5 border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/15"
                placeholder="Optional…"
                data-testid="task-field-secondary"
                disabled={submitted || submitting || seconds <= 0}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-foreground/80">Notes</div>
            <Textarea
              value={fields.notes}
              onChange={(e) => setFields((p) => ({ ...p, notes: e.target.value }))}
              className="min-h-[110px] rounded-xl bg-white/5 border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/15"
              placeholder="Add context for auditors…"
              data-testid="task-field-notes"
              disabled={submitted || submitting || seconds <= 0}
            />
          </div>

          {seconds <= 0 && !submitted ? (
            <div className="rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" data-testid="task-expired">
              Task window expired. You can no longer submit this payload.
            </div>
          ) : null}
        </div>

        <DialogFooter className="mt-2 gap-2 sm:gap-3">
          <Button
            variant="outline"
            className="h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
            onClick={() => onOpenChange(false)}
            data-testid="task-cancel"
          >
            Close
          </Button>
          <Button
            disabled={!canSubmit}
            className="h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200"
            onClick={async () => {
              try {
                setSubmitting(true);
                emit("submitTask", {
                  round,
                  role,
                  payload: {
                    taskId,
                    primary: fields.primary,
                    secondary: fields.secondary,
                    notes: fields.notes,
                  },
                });

                // optimistic UI
                await new Promise((r) => setTimeout(r, 350));
                setSubmitted(true);
                onSubmitted();
                toast({ title: "Task submitted", description: "Payload sent to the network." });
              } catch (e: any) {
                toast({ title: "Submit failed", description: e?.message ?? "Unknown error", variant: "destructive" });
              } finally {
                setSubmitting(false);
              }
            }}
            data-testid="task-submit"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Submit Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
