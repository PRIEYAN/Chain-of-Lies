/**
 * Party Room Page
 * 
 * Waiting room where players gather before starting the game
 */
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useGameStore } from "@/stores/useGameStore";
import { useLobbySocket } from "@/hooks/useLobbySocket";
import PlayerList from "@/components/lobby/PlayerList";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Copy, Check } from "lucide-react";

export default function PartyRoom() {
  const [, setLocation] = useLocation();
  const { party, players, localPlayerId, phase } = useGameStore();
  const { leaveParty, startGame } = useLobbySocket();
  const [copied, setCopied] = useState(false);

  // Redirect if not in a party
  useEffect(() => {
    if (!party || phase === "LOBBY") {
      setLocation("/lobby");
    } else if (phase === "GAME") {
      setLocation("/multiplayer");
    }
  }, [party, phase, setLocation]);

  if (!party || !localPlayerId) {
    return null;
  }

  const playersArray = Object.values(players);
  const localPlayer = players[localPlayerId];
  const isHost = localPlayer?.isHost || false;

  const handleLeaveParty = () => {
    leaveParty();
    setLocation("/lobby");
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleCopyPartyCode = () => {
    navigator.clipboard.writeText(party.partyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={handleLeaveParty}
            className="mb-4 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Leave Party
          </Button>

          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                {party.hostName}'s Party
              </h1>
              <p className="text-muted-foreground">
                Share the party code with players to join
              </p>
            </div>
            {isHost && (
              <Badge className="bg-primary/15 text-primary border-primary/30">
                You are the host
              </Badge>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Party Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Party Code Card */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle>Party Code</CardTitle>
                <CardDescription>Share this code with players</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-4 py-3 bg-background border border-primary/30 rounded text-2xl font-mono font-bold text-center tracking-widest text-primary">
                      {party.partyCode}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyPartyCode}
                    className="w-full gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Code
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Game Settings Card */}
            <Card>
              <CardHeader>
                <CardTitle>Game Settings</CardTitle>
                <CardDescription>Current configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Max Players</span>
                  <span className="font-semibold">{party.maxPlayers}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Current Players</span>
                  <span className="font-semibold">{playersArray.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <Badge variant="secondary">Waiting</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Start Game Button */}
            {isHost && (
              <Button
                onClick={handleStartGame}
                disabled={playersArray.length < 2}
                className="w-full h-12 bg-gradient-to-r from-primary to-accent text-lg font-semibold"
              >
                <Play className="h-5 w-5 mr-2" />
                Start Game
              </Button>
            )}

            {!isHost && (
              <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                  <p className="text-sm text-center text-muted-foreground">
                    Waiting for host to start the game...
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Player List */}
          <div className="lg:col-span-2">
            <PlayerList
              players={playersArray.map(p => ({
                id: p.id,
                name: p.name,
                isHost: p.isHost,
              }))}
              currentUserId={localPlayerId}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
