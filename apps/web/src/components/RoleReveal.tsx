import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import NeonShell from "@/components/NeonShell";
import NeonTopbar from "@/components/NeonTopbar";
import GlowCard from "@/components/GlowCard";
import CountdownPill from "@/components/CountdownPill";
import PhaseStepper from "@/components/PhaseStepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Lock, ArrowRight, Shield, Skull } from "lucide-react";
import type { Role } from "@tamper-hunt/types";
import { useSetPhase, useGameState } from "@/hooks/use-game";
import { useToast } from "@/hooks/use-toast";
import { useGameSocket } from "@/hooks/use-websocket";
import { cn } from "@/lib/utils";

const ROLE_DESCRIPTIONS: Record<string, { title: string; desc: string; accent: "primary" | "accent" | "danger" }> = {
  Validator: { title: "Validator", desc: "Check block integrity and confirm state transitions.", accent: "primary" },
  Auditor: { title: "Auditor", desc: "Inspect ledger patterns and flag anomalous entries.", accent: "accent" },
  Indexer: { title: "Indexer", desc: "Organize data shards and catch missing references.", accent: "primary" },
  Miner: { title: "Miner", desc: "Produce candidate blocks under time pressure.", accent: "primary" },
  SmartContractDev: { title: "Smart Contract Dev", desc: "Reason about logic; detect subtle exploits.", accent: "accent" },
  BridgeOperator: { title: "Bridge Operator", desc: "Guard cross-chain transfers; validate proofs.", accent: "accent" },
  Oracle: { title: "Oracle", desc: "Verify off-chain data integrity and timestamps.", accent: "primary" },
  Tamperer: { title: "Tamperer", desc: "Inject anomalies, evade detection, and break consensus.", accent: "danger" },
};

function pickMockRole(): { role: Role; isTamperer: boolean } {
  const roles = Object.keys(ROLE_DESCRIPTIONS) as Role[];
  const role = roles[Math.floor(Math.random() * roles.length)];
  return { role, isTamperer: role === "Tamperer" };
}

export default function RoleReveal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { connected } = useGameSocket();
  const setPhase = useSetPhase();

  const { data: gs } = useGameState();
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(10);

  const assigned = useMemo(() => {
    if (gs?.role) return { role: gs.role as Role, isTamperer: Boolean(gs.isTamperer) };
    return pickMockRole();
  }, [gs?.role, gs?.isTamperer]);

  const meta = ROLE_DESCRIPTIONS[assigned.role] ?? ROLE_DESCRIPTIONS.Validator;
  const isTamperer = assigned.isTamperer;

  useEffect(() => {
    setRevealed(false);
    setSeconds(10);
  }, [assigned.role]);

  useEffect(() => {
    const t = window.setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (seconds === 0) {
      setRevealed(true);
    }
  }, [seconds]);

  return (
    <NeonShell>
      <NeonTopbar connected={connected} phaseLabel="ROLE" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="animate-float-in">
          <GlowCard glow={meta.accent === "danger" ? "danger" : meta.accent}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="role-chip">
                  Role assignment
                </Badge>
                <h1 className="mt-3 text-3xl sm:text-4xl leading-tight">
                  <span className={cn(isTamperer ? "text-destructive" : "text-gradient")}>
                    {revealed ? meta.title : "Encrypted"}
                  </span>
                </h1>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl" data-testid="role-desc">
                  {revealed ? meta.desc : "Your role is sealed until the countdown completes. Hold steady."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <CountdownPill
                  seconds={seconds}
                  label="Reveal in"
                  intent={isTamperer ? "danger" : "primary"}
                  data-testid="role-countdown"
                />
              </div>
            </div>

            <Separator className="my-6 bg-white/10" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-foreground/80">Secure capsule</div>
                  <Badge
                    className={cn(
                      "border",
                      revealed
                        ? isTamperer
                          ? "bg-destructive/10 text-destructive border-destructive/25"
                          : "bg-accent/10 text-accent border-accent/25"
                        : "bg-primary/10 text-primary border-primary/25",
                    )}
                    data-testid="role-state"
                  >
                    {revealed ? "decrypted" : "sealed"}
                  </Badge>
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <div
                    className={cn(
                      "relative w-full rounded-2xl p-6 sm:p-7 border overflow-hidden",
                      "bg-gradient-to-br from-white/6 to-white/2",
                      revealed
                        ? isTamperer
                          ? "border-destructive/30"
                          : "border-primary/25"
                        : "border-white/10",
                    )}
                    data-testid="role-card"
                  >
                    <div className="absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl bg-primary/10" />
                    <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl bg-accent/10" />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">Role</div>
                        {revealed ? (
                          <Eye className={cn("h-4 w-4", isTamperer ? "text-destructive" : "text-primary")} />
                        ) : (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      <div className="mt-3 text-2xl sm:text-3xl font-semibold">
                        {revealed ? meta.title : "••••••••"}
                      </div>

                      <div className="mt-3 text-sm text-muted-foreground">
                        {revealed ? (
                          <span>
                            Clearance:{" "}
                            <span className={cn("font-medium", isTamperer ? "text-destructive" : "text-accent")}>
                              {isTamperer ? "black-site" : "protocol"}
                            </span>
                          </span>
                        ) : (
                          <span>Decrypting clearance…</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs text-muted-foreground flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  Keep your role private. Disclosure compromises the hunt.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="text-xs font-semibold text-foreground/80">Phase map</div>
                <div className="mt-4">
                  <PhaseStepper phase="ROLE" data-testid="role-stepper" />
                </div>

                <Separator className="my-5 bg-white/10" />

                <div className="space-y-3">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Shield className="h-4 w-4 text-primary" />
                      Normal ops
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Submit clean task payloads, verify peers, and watch the ledger.
                    </div>
                  </div>

                  <div className={cn("rounded-xl border p-4", isTamperer ? "border-destructive/25 bg-destructive/10" : "border-white/10 bg-white/5")}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Skull className={cn("h-4 w-4", isTamperer ? "text-destructive" : "text-muted-foreground")} />
                      Secret clue
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground" data-testid="tamperer-clue">
                      {revealed ? (
                        isTamperer ? (
                          "Inject exactly one anomaly in the next audit window. Keep it subtle: plausible timestamp drift or hash inconsistency."
                        ) : (
                          "If something looks too perfect, it might be synthetic. Focus on patterns, not single outliers."
                        )
                      ) : (
                        "Clue encrypted until role decrypt completes."
                      )}
                    </div>
                  </div>
                </div>

                <Separator className="my-5 bg-white/10" />

                <Button
                  className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  onClick={async () => {
                    try {
                      await setPhase.mutateAsync("TASK");
                      toast({ title: "Entering tasks", description: "Round 1 tasks are now available." });
                    } catch (e: any) {
                      toast({ title: "Phase sync failed", description: e?.message ?? "Continuing locally.", variant: "destructive" });
                    } finally {
                      setLocation("/game");
                    }
                  }}
                  data-testid="continue-to-game"
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </GlowCard>
        </div>
      </main>
    </NeonShell>
  );
}
