import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import NeonShell from "@/components/NeonShell";
import NeonTopbar from "@/components/NeonTopbar";
import GlowCard from "@/components/GlowCard";
import PhaseStepper from "@/components/PhaseStepper";
import NeonMeter from "@/components/NeonMeter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Crown, Users, Loader2, Play, RefreshCw, ArrowLeft } from "lucide-react";
import { useGameSocket } from "@/hooks/use-websocket";
import { useLobbyPlayers, useSetPhase } from "@/hooks/use-game";
import type { Player } from "@tamper-hunt/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function getQueryParam(loc: string, key: string) {
  try {
    const u = new URL(loc, window.location.origin);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

function initials(name: string) {
  const parts = name.split(/[\s-_]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "N";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "D";
  return (a + b).toUpperCase();
}

function mockPlayers(username: string): Player[] {
  const base: Player[] = [
    { id: "p1", username, isHost: true, isConnected: true },
    { id: "p2", username: "Merkle-Sentinel-552", isHost: false, isConnected: true },
    { id: "p3", username: "Cipher-Node-104", isHost: false, isConnected: true },
  ];
  return base;
}

export default function Lobby() {
  const [loc, setLocation] = useLocation();
  const username = useMemo(() => getQueryParam(loc, "username") ?? "Neon-Guest-000", [loc]);
  const { toast } = useToast();

  const { connected, emit, on } = useGameSocket();
  const { data: playersApi, isLoading, error, refetch } = useLobbyPlayers();
  const setPhase = useSetPhase();

  const [playersLocal, setPlayersLocal] = useState<Player[]>(() => mockPlayers(username));
  const players = playersApi?.length ? playersApi : playersLocal;

  const me = useMemo(() => players.find((p) => p.username === username) ?? players[0], [players, username]);
  const isHost = Boolean(me?.isHost);

  useEffect(() => {
    // Join room whenever we enter lobby.
    emit("joinRoom", { roomId: "takshashila", username });

    const offJoin = on("playerJoined", (p) => {
      setPlayersLocal((prev) => {
        if (prev.some((x) => x.id === p.id)) return prev;
        return [...prev, p];
      });
      toast({ title: "Player joined", description: p.username });
    });

    const offLeft = on("playerLeft", ({ playerId }) => {
      setPlayersLocal((prev) => prev.filter((p) => p.id !== playerId));
    });

    return () => {
      offJoin?.();
      offLeft?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const count = players.length;
  const maxPlayers = 12;

  return (
    <NeonShell>
      <NeonTopbar connected={connected} phaseLabel="LOBBY" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <section className="lg:col-span-7 animate-float-in">
            <GlowCard glow="primary">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl">Lobby handshake</h1>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="lobby-subtitle">
                    Establish presence, verify peers, and wait for host to start the protocol.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="room-id">
                    room: takshashila
                  </Badge>
                  <Badge
                    className={cn(
                      "border",
                      connected
                        ? "bg-accent/10 text-accent border-accent/25"
                        : "bg-destructive/10 text-destructive border-destructive/25",
                    )}
                    data-testid="lobby-connection"
                  >
                    {connected ? "synced" : "degraded"}
                  </Badge>
                </div>
              </div>

              <Separator className="my-5 bg-white/10" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-foreground/80">
                    <Users className="h-4 w-4 text-primary" />
                    Active peers
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <div className="text-3xl font-semibold tabular-nums" data-testid="player-count">
                      {count}
                      <span className="text-muted-foreground text-base font-medium">/{maxPlayers}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">max capacity</div>
                  </div>
                  <div className="mt-4">
                    <NeonMeter value={count} max={maxPlayers} label="Lobby fill" data-testid="lobby-fill-meter" />
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xs font-semibold text-foreground/80">Protocol</div>
                  <div className="mt-2">
                    <PhaseStepper phase="LOBBY" data-testid="phase-stepper" />
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    Host will assign roles and start Round 1. Stay online.
                  </div>
                </div>
              </div>

              <Separator className="my-5 bg-white/10" />

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
                  onClick={() => setLocation("/")}
                  data-testid="back-to-landing"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Exit
                </Button>

                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
                  onClick={() => refetch()}
                  data-testid="refresh-players"
                >
                  <RefreshCw className="h-4 w-4 mr-2 text-primary" />
                  Refresh
                </Button>

                <Button
                  disabled={!isHost || setPhase.isPending}
                  className="h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200 sm:ml-auto"
                  onClick={async () => {
                    try {
                      await setPhase.mutateAsync("ROLE");
                      toast({ title: "Protocol started", description: "Switching to Role Reveal." });
                      setLocation("/role");
                    } catch (e: any) {
                      toast({ title: "Start failed", description: e?.message ?? "Unknown error", variant: "destructive" });
                    }
                  }}
                  data-testid="start-game"
                >
                  {setPhase.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Start Game {isHost ? "" : "(host only)"}
                </Button>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" data-testid="players-error">
                  Failed to load lobby players from API. Showing local mock list.
                </div>
              ) : null}
              {isLoading ? (
                <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground" data-testid="players-loading">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Syncing lobby…
                </div>
              ) : null}
            </GlowCard>
          </section>

          <aside className="lg:col-span-5 animate-float-in" style={{ animationDelay: "110ms" }}>
            <GlowCard glow="accent">
              <div className="flex items-center justify-between">
                <h2 className="text-xl">Players</h2>
                <Badge className="bg-accent/10 text-accent border-accent/25" data-testid="you-badge">
                  you: {username}
                </Badge>
              </div>

              <p className="mt-1 text-sm text-muted-foreground">
                Host is responsible for initiating the phase transition.
              </p>

              <Separator className="my-5 bg-white/10" />

              <div className="space-y-3" data-testid="players-list">
                {players.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-all hover:border-white/20 hover:bg-white/7"
                    data-testid={`player-${p.id}`}
                  >
                    <Avatar className="h-10 w-10 border border-white/10">
                      <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/10 text-foreground/90">
                        {initials(p.username)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate font-semibold">{p.username}</div>
                        {p.isHost ? (
                          <Badge className="bg-primary/15 text-primary border-primary/30" data-testid={`host-badge-${p.id}`}>
                            <Crown className="h-3.5 w-3.5 mr-1" />
                            Host
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {p.isConnected ? "connected" : "disconnected"}
                      </div>
                    </div>

                    <div
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        p.isConnected ? "bg-[hsl(136_92%_56%)] shadow-[0_0_0_6px_hsl(136_92%_56%/0.14)]" : "bg-muted-foreground/60",
                      )}
                      aria-label={p.isConnected ? "connected" : "disconnected"}
                    />
                  </div>
                ))}
              </div>

              <Separator className="my-5 bg-white/10" />

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold text-foreground/80">Waiting for consensus…</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span data-testid="waiting-animation">Handshake in progress. Keep this tab open.</span>
                </div>
              </div>
            </GlowCard>
          </aside>
        </div>
      </main>
    </NeonShell>
  );
}
