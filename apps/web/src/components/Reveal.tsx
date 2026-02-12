import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import NeonShell from "@/components/NeonShell";
import NeonTopbar from "@/components/NeonTopbar";
import GlowCard from "@/components/GlowCard";
import PhaseStepper from "@/components/PhaseStepper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Shield, Skull, RotateCcw, ArrowLeftRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameSocket } from "@/hooks/use-websocket";
import { useSetPhase, useLobbyPlayers } from "@/hooks/use-game";
import type { Player } from "@shared/schema";

function mockPlayers(): Player[] {
  return [
    { id: "p1", username: "You", isHost: true, isConnected: true },
    { id: "p2", username: "Merkle-Sentinel-552", isHost: false, isConnected: true },
    { id: "p3", username: "Cipher-Node-104", isHost: false, isConnected: true },
    { id: "p4", username: "Quorum-Archivist-337", isHost: false, isConnected: true },
  ];
}

export default function Reveal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { connected } = useGameSocket();
  const setPhase = useSetPhase();

  const { data: playersApi } = useLobbyPlayers();
  const players = playersApi?.length ? playersApi : mockPlayers();

  const [tampererIdx] = useState(() => Math.floor(Math.random() * Math.max(1, players.length)));
  const tamperer = players[tampererIdx];

  const outcome = useMemo(() => {
    // MVP: simple deterministic narrative; backend would decide
    const caught = Math.random() > 0.45;
    return { caught };
  }, []);

  return (
    <NeonShell>
      <NeonTopbar connected={connected} phaseLabel="REVEAL" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="animate-float-in">
          <GlowCard glow={outcome.caught ? "accent" : "danger"}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="reveal-chip">
                  finality
                </Badge>
                <h1 className="mt-3 text-3xl sm:text-4xl leading-tight">
                  {outcome.caught ? (
                    <span className="text-gradient">Consensus restored</span>
                  ) : (
                    <span className="text-destructive">Consensus compromised</span>
                  )}
                </h1>
                <p className="mt-2 text-sm sm:text-base text-muted-foreground" data-testid="reveal-subtitle">
                  {outcome.caught
                    ? "The network isolated the anomaly source. The chain survives."
                    : "The anomaly propagated before containment. The chain forks into chaos."}
                </p>
              </div>

              <Badge
                className={
                  outcome.caught
                    ? "bg-accent/10 text-accent border-accent/25"
                    : "bg-destructive/10 text-destructive border-destructive/25"
                }
                data-testid="reveal-outcome"
              >
                {outcome.caught ? "Players win" : "Tamperer wins"}
              </Badge>
            </div>

            <Separator className="my-6 bg-white/10" />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-2">
                  {outcome.caught ? (
                    <Shield className="h-5 w-5 text-accent" />
                  ) : (
                    <Skull className="h-5 w-5 text-destructive" />
                  )}
                  <div className="text-sm font-semibold">Tamperer identity</div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-background/20 p-4" data-testid="tamperer-identity">
                  <div className="text-xs text-muted-foreground">The Tamperer was</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {tamperer ? tamperer.username : "Unknown"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    In a full game, this result is derived from votes + ledger anomaly provenance.
                  </div>
                </div>

                <div className="mt-4 text-xs text-muted-foreground">
                  Win condition: identify the Tamperer before anomalies exceed safe threshold.
                </div>
              </div>

              <div className="md:col-span-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-foreground/80">Phase map</div>
                  <div className="mt-3">
                    <PhaseStepper phase="REVEAL" data-testid="reveal-stepper" />
                  </div>
                </div>

                <Button
                  className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                  onClick={async () => {
                    try {
                      await setPhase.mutateAsync("LOBBY");
                      toast({ title: "Reset", description: "Returning to lobby." });
                    } catch (e: any) {
                      toast({ title: "Reset failed", description: e?.message ?? "Continuing locally.", variant: "destructive" });
                    } finally {
                      setLocation("/lobby");
                    }
                  }}
                  data-testid="play-again"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Play Again
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
                  onClick={() => setLocation("/")}
                  data-testid="back-to-landing-from-reveal"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-2 text-primary" />
                  Back to Landing
                </Button>
              </div>
            </div>
          </GlowCard>
        </div>
      </main>
    </NeonShell>
  );
}
