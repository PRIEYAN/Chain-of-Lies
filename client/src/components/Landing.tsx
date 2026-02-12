import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";
import NeonShell from "@/components/NeonShell";
import NeonTopbar from "@/components/NeonTopbar";
import GlowCard from "@/components/GlowCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Wallet, KeyRound, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function makeName() {
  const a = ["ZK", "Neon", "Hash", "Merkle", "L2", "Cipher", "Proof", "Nova", "Quorum", "Shard"];
  const b = ["Sage", "Runner", "Node", "Seeker", "Sentinel", "Miner", "Validator", "Archivist", "Pilot", "Drifter"];
  const pick = (x: string[]) => x[Math.floor(Math.random() * x.length)];
  return `${pick(a)}-${pick(b)}-${Math.floor(100 + Math.random() * 900)}`;
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [username, setUsername] = useState<string>(() => makeName());
  const [walletConnected, setWalletConnected] = useState(false);

  const canJoin = walletConnected && username.trim().length >= 2;

  const subtitle = useMemo(
    () =>
      "A multiplayer blockchain forensics game. Validate blocks, audit anomalies, and hunt the Tamperer—before consensus collapses.",
    [],
  );

  return (
    <NeonShell>
      <NeonTopbar
        connected={false}
        phaseLabel="LOBBY"
        rightSlot={
          <Badge className="hidden lg:inline-flex bg-white/5 border-white/10 text-foreground/80" data-testid="build-badge">
            build: lite
          </Badge>
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          <section className="lg:col-span-7 animate-float-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-primary neon-glow">
              <Sparkles className="h-4 w-4" />
              <span className="text-xs font-semibold tracking-wide" data-testid="landing-chip">
                DARK NEON LEDGER SIMULATION
              </span>
            </div>

            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl leading-[1.03]">
              <span className="block text-foreground">Takshashila</span>
              <span className="block text-gradient neon-glow">Tamper Hunt</span>
            </h1>

            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl" data-testid="landing-subtitle">
              {subtitle}
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <GlowCard glow="none" className="p-4">
                <div className="text-xs text-muted-foreground">Mode</div>
                <div className="mt-1 font-semibold">Multiplayer</div>
                <div className="mt-2 text-xs text-muted-foreground">Socket-driven state sync</div>
              </GlowCard>
              <GlowCard glow="none" className="p-4">
                <div className="text-xs text-muted-foreground">Objective</div>
                <div className="mt-1 font-semibold">Detect anomalies</div>
                <div className="mt-2 text-xs text-muted-foreground">Audit ledger + vote</div>
              </GlowCard>
              <GlowCard glow="none" className="p-4">
                <div className="text-xs text-muted-foreground">Threat</div>
                <div className="mt-1 font-semibold text-destructive">The Tamperer</div>
                <div className="mt-2 text-xs text-muted-foreground">Stealth role</div>
              </GlowCard>
            </div>
          </section>

          <aside className="lg:col-span-5 animate-float-in" style={{ animationDelay: "90ms" }}>
            <GlowCard glow="primary" className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl">Enter the network</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect a wallet (mock) and choose a handle. Then join the lobby.
                  </p>
                </div>
                <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="players-cap">
                  1–12 players
                </Badge>
              </div>

              <Separator className="my-5 bg-white/10" />

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-foreground/80">Wallet</div>
                  <Button
                    className={[
                      "w-full h-12 rounded-xl font-semibold",
                      walletConnected
                        ? "bg-gradient-to-r from-accent/75 to-accent/35 text-[hsl(var(--accent-foreground))] shadow-lg shadow-[hsl(var(--accent)/0.22)]"
                        : "bg-gradient-to-r from-primary/85 to-primary/45 text-primary-foreground shadow-lg shadow-primary/20",
                      "hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200",
                    ].join(" ")}
                    onClick={() => {
                      setWalletConnected((v) => {
                        const next = !v;
                        toast({
                          title: next ? "Wallet connected" : "Wallet disconnected",
                          description: next ? "Mock connection established." : "Connection closed.",
                        });
                        return next;
                      });
                    }}
                    data-testid="connect-wallet"
                  >
                    <Wallet className="h-4 w-4 mr-2" />
                    {walletConnected ? "Connected" : "Connect Wallet"}
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-foreground/80">Username</div>
                    <Button
                      variant="ghost"
                      className="h-8 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                      onClick={() => setUsername(makeName())}
                      data-testid="regen-username"
                    >
                      Generate
                    </Button>
                  </div>
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Your handle…"
                    className="h-12 rounded-xl bg-white/5 border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/15"
                    data-testid="username-input"
                  />
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>Used for lobby identity and ledger attribution.</span>
                  </div>
                </div>

                <Button
                  disabled={!canJoin}
                  className="w-full h-12 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none transition-all duration-200"
                  onClick={() => {
                    // pass username via query so Lobby can pick it up easily
                    const params = new URLSearchParams({ username: username.trim() });
                    setLocation(`/lobby?${params.toString()}`);
                  }}
                  data-testid="join-lobby"
                >
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Join Lobby
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>

                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="text-xs font-semibold text-foreground/80">On-chain etiquette</div>
                  <ul className="mt-2 text-xs text-muted-foreground space-y-1">
                    <li>• Submit tasks before timeout to keep consensus stable.</li>
                    <li>• During audit, watch for anomalies and suspicious hashes.</li>
                    <li>• Emergency meeting is powerful—call it only with signal.</li>
                  </ul>
                </div>
              </div>
            </GlowCard>
          </aside>
        </div>
      </main>
    </NeonShell>
  );
}
