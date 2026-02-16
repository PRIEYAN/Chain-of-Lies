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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, MessageSquare, ArrowRight, Loader2 } from "lucide-react";
import { useLedger, useSetPhase } from "@/hooks/use-game";
import { useGameSocket } from "@/hooks/use-websocket";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { LedgerEntry } from "@tamper-hunt/types";

type ChatMsg = { id: string; playerId: string; username: string; message: string; at: string };

function getQueryParam(loc: string, key: string) {
  try {
    const u = new URL(loc, window.location.origin);
    return u.searchParams.get(key);
  } catch {
    return null;
  }
}

function mockLedger(): LedgerEntry[] {
  const now = new Date();
  const mk = (i: number, status: "Normal" | "Anomaly"): LedgerEntry => ({
    role: i % 4 === 0 ? "Indexer" : i % 3 === 0 ? "Validator" : "Oracle",
    playerId: `p${i}`,
    playerName: ["Merkle-Sentinel-552", "Cipher-Node-104", "ZK-Runner-991", "Quorum-Archivist-337"][i % 4],
    dataHash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64)}`,
    timestamp: new Date(now.getTime() - i * 1000 * 22).toISOString(),
    status,
  });
  return Array.from({ length: 10 }).map((_, i) => mk(i + 1, i === 6 ? "Anomaly" : "Normal"));
}

export default function EmergencyMeeting() {
  const [loc, setLocation] = useLocation();
  const emergency = getQueryParam(loc, "emergency") === "1";

  const { toast } = useToast();
  const { connected, emit, on } = useGameSocket();
  const setPhase = useSetPhase();

  const { data: ledgerApi, isLoading, error, refetch } = useLedger();
  const ledger = ledgerApi?.length ? ledgerApi : mockLedger();

  const [seconds, setSeconds] = useState(90);

  const [chat, setChat] = useState<ChatMsg[]>(() => [
    {
      id: "c1",
      playerId: "p2",
      username: "Merkle-Sentinel-552",
      message: "Seeing a subtle timestamp drift on entry #7. Anyone else?",
      at: new Date(Date.now() - 40_000).toISOString(),
    },
    {
      id: "c2",
      playerId: "p3",
      username: "Cipher-Node-104",
      message: "Hash looks plausible but parent link feels inconsistent. Requesting audit focus.",
      at: new Date(Date.now() - 28_000).toISOString(),
    },
  ]);

  const [draft, setDraft] = useState("");

  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const offLedger = on("ledgerUpdated", (items) => {
      // Replace mock, not merging: keep predictable
      // eslint-disable-next-line no-console
      console.log("[ws] ledgerUpdated", items?.entries?.length);
    });
    // TODO: chatMessage is not defined in wsServerMessages, needs to be added to the websocket types
    // const offChat = on("chatMessage", (m) => setChat((prev) => [...prev, m]));
    return () => {
      offLedger?.();
      // offChat?.();
    };
  }, [on]);

  const anomalies = useMemo(() => ledger.filter((e) => e.status === "Anomaly").length, [ledger]);

  return (
    <NeonShell>
      <NeonTopbar connected={connected} phaseLabel="AUDIT" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="animate-float-in">
          <GlowCard glow="danger" className="relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-destructive/15 blur-3xl" />
              <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
            </div>

            <div className="relative">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-destructive/25 bg-destructive/10 px-3 py-1.5 text-destructive neon-glow">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-semibold tracking-wide" data-testid="emergency-banner">
                      {emergency ? "EMERGENCY MEETING" : "AUDIT WINDOW"}
                    </span>
                  </div>

                  <h1 className="mt-3 text-2xl sm:text-3xl">Ledger audit & discussion</h1>
                  <p className="mt-1 text-sm text-muted-foreground" data-testid="audit-subtitle">
                    Inspect ledger entries, discuss anomalies, then proceed to voting.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <CountdownPill seconds={seconds} label="Discussion" intent="danger" data-testid="discussion-timer" />
                </div>
              </div>

              <Separator className="my-6 bg-white/10" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                <section className="lg:col-span-8">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-white/5 border-white/10 text-foreground/80" data-testid="ledger-badge">
                        ledger
                      </Badge>
                      <Badge
                        className={cn(
                          "border",
                          anomalies > 0
                            ? "bg-destructive/10 text-destructive border-destructive/25"
                            : "bg-accent/10 text-accent border-accent/25",
                        )}
                        data-testid="anomaly-count"
                      >
                        anomalies: {anomalies}
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      className="h-10 rounded-xl border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
                      onClick={() => refetch()}
                      data-testid="refresh-ledger"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
                    </Button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 overflow-hidden" data-testid="ledger-table">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-white/10">
                          <TableHead className="text-muted-foreground">Role</TableHead>
                          <TableHead className="text-muted-foreground">Player</TableHead>
                          <TableHead className="text-muted-foreground">Hash</TableHead>
                          <TableHead className="text-muted-foreground hidden md:table-cell">Timestamp</TableHead>
                          <TableHead className="text-muted-foreground">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledger.map((e, idx) => (
                          <TableRow key={`${e.playerId}-${idx}`} className="border-white/10">
                            <TableCell className="font-medium">{e.role}</TableCell>
                            <TableCell className="max-w-[160px] truncate">{e.playerName}</TableCell>
                            <TableCell className="font-mono text-xs max-w-[240px] truncate" data-testid={`ledger-hash-${idx}`}>
                              {e.dataHash}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-xs text-muted-foreground tabular-nums">
                              {new Date(e.timestamp).toLocaleTimeString()}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={cn(
                                  "border",
                                  e.status === "Anomaly"
                                    ? "bg-destructive/10 text-destructive border-destructive/25"
                                    : "bg-accent/10 text-accent border-accent/25",
                                )}
                                data-testid={`ledger-status-${idx}`}
                              >
                                {e.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {error ? (
                    <div className="mt-4 rounded-xl border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive" data-testid="ledger-error">
                      Failed to load ledger from API. Showing mock data.
                    </div>
                  ) : null}
                </section>

                <aside className="lg:col-span-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-foreground/80">Phase map</div>
                      <Badge className="bg-primary/10 text-primary border-primary/25" data-testid="audit-phase">
                        AUDIT
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <PhaseStepper phase="AUDIT" data-testid="audit-stepper" />
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4 text-primary" />
                      <div className="text-sm font-semibold">Discussion</div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Chat is mock-friendly; when backend supports it, messages will sync in real time.
                    </p>

                    <div className="mt-3">
                      <ScrollArea className="h-56 rounded-xl border border-white/10 bg-background/20 p-3" data-testid="chat-scroll">
                        <div className="space-y-3">
                          {chat.map((m) => (
                            <div key={m.id} className="rounded-xl border border-white/10 bg-white/5 p-3" data-testid={`chat-${m.id}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-semibold truncate">{m.username}</div>
                                <div className="text-[11px] text-muted-foreground tabular-nums">
                                  {new Date(m.at).toLocaleTimeString()}
                                </div>
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">{m.message}</div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <Input
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder="Message…"
                        className="h-10 rounded-xl bg-white/5 border-white/10 focus:border-primary focus:ring-4 focus:ring-primary/15"
                        data-testid="chat-input"
                      />
                      <Button
                        className="h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/15 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                        onClick={() => {
                          const msg = draft.trim();
                          if (!msg) return;

                          const payload = { message: msg, at: new Date().toISOString() };
                          // TODO: chatMessage needs to be added to wsClientMessages
                          emit("chatMessage", payload);

                          // optimistic add
                          setChat((prev) => [
                            ...prev,
                            {
                              id: `local-${Date.now()}`,
                              playerId: "me",
                              username: "You",
                              message: msg,
                              at: payload.at,
                            },
                          ]);
                          setDraft("");
                        }}
                        data-testid="chat-send"
                      >
                        Send
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      className="w-full h-11 rounded-xl font-semibold bg-gradient-to-r from-primary to-accent text-[hsl(var(--primary-foreground))] shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                      onClick={async () => {
                        try {
                          await setPhase.mutateAsync("VOTING");
                          toast({ title: "Voting opened", description: "Cast your vote before the timer ends." });
                        } catch (e: any) {
                          toast({ title: "Phase sync failed", description: e?.message ?? "Continuing locally.", variant: "destructive" });
                        } finally {
                          setLocation("/voting");
                        }
                      }}
                      data-testid="proceed-to-voting"
                    >
                      Proceed to Voting
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </aside>
              </div>
            </div>
          </GlowCard>
        </div>
      </main>
    </NeonShell>
  );
}
