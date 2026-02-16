import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import type { Role } from "@tamper-hunt/types";
import NeonShell from "@/components/NeonShell";
import NeonTopbar from "@/components/NeonTopbar";
import GlowCard from "@/components/GlowCard";
import CountdownPill from "@/components/CountdownPill";
import PhaseStepper from "@/components/PhaseStepper";
import NeonMeter from "@/components/NeonMeter";
import TaskModal from "@/components/TaskModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ShieldAlert, CheckCircle2, SquareAsterisk, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameSocket } from "@/hooks/use-websocket";
import { useGameState, useSetPhase } from "@/hooks/use-game";
import { cn } from "@/lib/utils";

function mockRole(): Role {
  const roles: Role[] = ["Validator", "Auditor", "Indexer", "Miner", "SmartContractDev", "BridgeOperator", "Oracle", "Tamperer"];
  return roles[Math.floor(Math.random() * roles.length)];
}

type Task = { id: string; title: string; blurb: string };

const TASKS: Task[] = [
  { id: "A1", title: "Block Header", blurb: "Validate header fields and parent link." },
  { id: "A2", title: "State Root", blurb: "Confirm root hash matches execution." },
  { id: "B1", title: "Tx Set", blurb: "Check ordering + signature validity." },
  { id: "B2", title: "Gas & Fees", blurb: "Verify totals and fee routing." },
  { id: "C1", title: "Cross-chain", blurb: "Inspect bridge proof envelope." },
  { id: "C2", title: "Oracle Feed", blurb: "Validate freshness and source." },
  { id: "D1", title: "Index Shards", blurb: "Spot missing references." },
  { id: "D2", title: "Anomaly Scan", blurb: "Look for drift or impossible timestamps." },
];

export default function GameBoard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { connected, emit, on } = useGameSocket();
  const setPhase = useSetPhase();

  const { data: gs } = useGameState();

  const round = gs?.round ?? 1;
  const role = (gs?.role ? (gs.role as Role) : mockRole()) as Role;
  const isTamperer = Boolean(gs?.isTamperer ?? (role === "Tamperer"));

  const [timer, setTimer] = useState<number>(gs?.timer ?? 120);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTimer(gs?.timer ?? 120);
  }, [gs?.timer]);

  useEffect(() => {
    const t = window.setInterval(() => setTimer((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const offState = on("stateUpdated", (state) => {
      // keep lightweight: timer/round/phase could be driven by backend
      if (typeof state.timer === "number") setTimer(state.timer);
    });
    return () => {
      offState?.();
    };
  }, [on]);

  const submittedCount = Object.values(submitted).filter(Boolean).length;

  const proceedToAudit = async () => {
    try {
      await setPhase.mutateAsync("AUDIT");
      toast({ title: "Audit window opened", description: "Ledger inspection begins." });
    } catch (e: any) {
      toast({ title: "Phase sync failed", description: e?.message ?? "Continuing locally.", variant: "destructive" });
    } finally {
      setLocation("/audit");
    }
  };

  return (
    <NeonShell>
      <NeonTopbar
        connected={connected}
        phaseLabel="TASK"
        rightSlot={
          <Badge className={cn("hidden lg:inline-flex border", isTamperer ? "bg-destructive/10 text-destructive border-destructive/25" : "bg-primary/10 text-primary border-primary/25")} data-testid="role-indicator">
            {role}
          </Badge>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <section className="lg:col-span-8 animate-float-in">
            <GlowCard glow="primary">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl">Round {round} — Task phase</h1>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="gameboard-subtitle">
                    Execute your duties. Submit payloads quickly; the audit window opens when consensus is ready.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <CountdownPill seconds={timer} label="Round timer" data-testid="round-timer" />
                </div>
              </div>

              <Separator className="my-6 bg-white/10" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="tasks-grid">
                {TASKS.map((t) => {
                  const done = Boolean(submitted[t.id]);
                  return (
                    <button
                      key={t.id}
                      className={cn(
                        "text-left rounded-2xl border p-4 transition-all duration-200",
                        "bg-white/5 border-white/10 hover:bg-white/7 hover:border-white/20",
                        "focus:outline-none focus:ring-4 focus:ring-primary/15",
                        done && "border-accent/30 bg-accent/10 hover:bg-accent/12",
                      )}
                      onClick={() => setOpenTaskId(t.id)}
                      disabled={done}
                      data-testid={`task-btn-${t.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Task {t.id}</div>
                          <div className="mt-1 text-lg font-semibold">{t.title}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{t.blurb}</div>
                        </div>

                        <div className="mt-1">
                          {done ? (
                            <Badge className="bg-accent/10 text-accent border-accent/25" data-testid={`task-done-${t.id}`}>
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              done
                            </Badge>
                          ) : (
                            <Badge className="bg-primary/10 text-primary border-primary/25" data-testid={`task-open-${t.id}`}>
                              <SquareAsterisk className="h-3.5 w-3.5 mr-1" />
                              open
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <Separator className="my-6 bg-white/10" />

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  className="h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 sm:ml-auto"
                  onClick={proceedToAudit}
                  data-testid="proceed-to-audit"
                >
                  Proceed to Audit
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </GlowCard>
          </section>

          <aside className="lg:col-span-4 animate-float-in" style={{ animationDelay: "110ms" }}>
            <GlowCard glow={isTamperer ? "danger" : "accent"}>
              <div className="flex items-center justify-between">
                <h2 className="text-xl">Network status</h2>
                <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="phase-badge">
                  TASK
                </Badge>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Submission progress and emergency controls.
              </p>

              <Separator className="my-5 bg-white/10" />

              <div className="space-y-4">
                <NeonMeter
                  value={submittedCount}
                  max={TASKS.length}
                  label="Your tasks completed"
                  intent="accent"
                  data-testid="tasks-progress"
                />

                <div className={cn("rounded-2xl border p-4", isTamperer ? "border-destructive/25 bg-destructive/10" : "border-white/10 bg-white/5")}>
                  <div className="text-xs font-semibold text-foreground/80">Role directive</div>
                  <div className="mt-2 text-sm text-muted-foreground" data-testid="role-directive">
                    {isTamperer
                      ? "Blend in. A single anomaly can destabilize consensus—choose the moment."
                      : "Stay sharp. Validate inputs; look for drift, mismatched hashes, and inconsistent timestamps."}
                  </div>
                </div>

                <Button
                  variant="destructive"
                  className="w-full h-11 rounded-xl shadow-lg shadow-destructive/15 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  onClick={() => {
                    emit("callEmergency", { reason: "Suspicious behavior detected during TASK phase." });
                    toast({ title: "Emergency signal broadcast", description: "Opening meeting overlay." });
                    setLocation("/audit?emergency=1");
                  }}
                  data-testid="call-emergency"
                >
                  <ShieldAlert className="h-4 w-4 mr-2" />
                  Call Emergency Meeting
                </Button>
              </div>
            </GlowCard>
          </aside>
        </div>
      </main>

      <TaskModal
        open={Boolean(openTaskId)}
        onOpenChange={(v) => setOpenTaskId(v ? openTaskId : null)}
        role={role}
        round={round}
        taskId={openTaskId ?? "A1"}
        onSubmitted={() => {
          if (!openTaskId) return;
          setSubmitted((p) => ({ ...p, [openTaskId]: true }));
        }}
      />
    </NeonShell>
  );
}
