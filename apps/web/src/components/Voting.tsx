import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import NeonShell from "@/components/NeonShell";
import NeonTopbar from "@/components/NeonTopbar";
import GlowCard from "@/components/GlowCard";
import CountdownPill from "@/components/CountdownPill";
import PhaseStepper from "@/components/PhaseStepper";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Vote as VoteIcon, ArrowRight } from "lucide-react";
import { useLobbyPlayers, useSetPhase } from "@/hooks/use-game";
import { useGameSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import type { Player } from "@tamper-hunt/types";
import { cn } from "@/lib/utils";

function mockPlayers(): Player[] {
  return [
    { id: "p1", username: "You", isHost: true, isConnected: true },
    { id: "p2", username: "Merkle-Sentinel-552", isHost: false, isConnected: true },
    { id: "p3", username: "Cipher-Node-104", isHost: false, isConnected: true },
    { id: "p4", username: "Quorum-Archivist-337", isHost: false, isConnected: true },
  ];
}

export default function Voting() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { connected, emit } = useGameSocket();
  const setPhase = useSetPhase();

  const { data: playersApi } = useLobbyPlayers();
  const players = playersApi?.length ? playersApi : mockPlayers();

  const [seconds, setSeconds] = useState(45);
  const [selected, setSelected] = useState<string>("");

  const canVote = selected.length > 0 && seconds > 0;

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  const selectedPlayer = useMemo(() => players.find((p) => p.id === selected), [players, selected]);

  return (
    <NeonShell>
      <NeonTopbar connected={connected} phaseLabel="VOTING" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="animate-float-in">
          <GlowCard glow="accent">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="voting-chip">
                  consensus vote
                </Badge>
                <h1 className="mt-3 text-2xl sm:text-3xl">Cast your vote</h1>
                <p className="mt-1 text-sm text-muted-foreground" data-testid="voting-subtitle">
                  Choose the player most likely to be the Tamperer. Abstain only if uncertain.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <CountdownPill seconds={seconds} label="Voting window" intent="accent" data-testid="voting-timer" />
              </div>
            </div>

            <Separator className="my-6 bg-white/10" />

            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-7 rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-foreground/80">Candidates</div>
                  <Badge className="bg-primary/10 text-primary border-primary/25" data-testid="voting-phase">
                    VOTING
                  </Badge>
                </div>

                <div className="mt-4" data-testid="voting-list">
                  <RadioGroup value={selected} onValueChange={setSelected}>
                    <div className="space-y-2">
                      {players.map((p) => (
                        <div
                          key={p.id}
                          className={cn(
                            "flex items-center gap-3 rounded-2xl border p-3 transition-all",
                            selected === p.id
                              ? "border-accent/35 bg-accent/10"
                              : "border-white/10 bg-white/5 hover:bg-white/7 hover:border-white/20",
                          )}
                          data-testid={`vote-option-${p.id}`}
                        >
                          <RadioGroupItem value={p.id} id={`rg-${p.id}`} />
                          <Label htmlFor={`rg-${p.id}`} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold truncate">{p.username}</div>
                              {p.isHost ? (
                                <Badge className="bg-primary/10 text-primary border-primary/25">host</Badge>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.isConnected ? "connected" : "disconnected"}</div>
                          </Label>
                        </div>
                      ))}

                      <div
                        className={cn(
                          "flex items-center gap-3 rounded-2xl border p-3 transition-all",
                          selected === "abstain"
                            ? "border-accent/35 bg-accent/10"
                            : "border-white/10 bg-white/5 hover:bg-white/7 hover:border-white/20",
                        )}
                        data-testid="vote-option-abstain"
                      >
                        <RadioGroupItem value="abstain" id="rg-abstain" />
                        <Label htmlFor="rg-abstain" className="flex-1 cursor-pointer">
                          <div className="font-semibold">Abstain</div>
                          <div className="text-xs text-muted-foreground">No confident target this round.</div>
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="md:col-span-5 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-foreground/80">Phase map</div>
                  <div className="mt-3">
                    <PhaseStepper phase="VOTING" data-testid="voting-stepper" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-foreground/80">Selected</div>
                  <div className="mt-2 text-sm text-muted-foreground" data-testid="vote-selected">
                    {selected === "abstain"
                      ? "Abstain"
                      : selectedPlayer
                        ? selectedPlayer.username
                        : "None"}
                  </div>
                </div>

                <Button
                  disabled={!canVote}
                  className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200"
                  onClick={async () => {
                    try {
                      emit("castVote", {
                        round: 1,
                        targetPlayerId: selected === "abstain" ? null : selected,
                      });

                      toast({
                        title: "Vote cast",
                        description:
                          selected === "abstain"
                            ? "You abstained this round."
                            : `Target: ${selectedPlayer?.username ?? selected}`,
                      });

                      await setPhase.mutateAsync("REVEAL");
                    } catch (e: any) {
                      toast({ title: "Vote failed", description: e?.message ?? "Continuing locally.", variant: "destructive" });
                    } finally {
                      setLocation("/reveal");
                    }
                  }}
                  data-testid="cast-vote"
                >
                  <VoteIcon className="h-4 w-4 mr-2" />
                  Cast Vote
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
                  onClick={() => {
                    setSelected("");
                    toast({ title: "Cleared selection", description: "Choose a target to cast your vote." });
                  }}
                  data-testid="clear-vote"
                >
                  <CheckCircle2 className="h-4 w-4 mr-2 text-accent" />
                  Clear Selection
                </Button>

                <Button
                  variant="secondary"
                  className="w-full h-11 rounded-xl bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20 hover:border-primary/40 hover:bg-white/5 transition-all"
                  onClick={() => setLocation("/audit")}
                  data-testid="back-to-audit"
                >
                  Back to Audit
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
