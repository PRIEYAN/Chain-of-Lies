/**
 * Lobby Page
 * 
 * Entry point for multiplayer - create or join a party
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGameStore } from "@/stores/useGameStore";
import { useLobbySocket } from "@/hooks/useLobbySocket";
import JoinPartyForm from "@/components/lobby/JoinPartyForm";
import CreatePartyForm from "@/components/lobby/CreatePartyForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Wifi, WifiOff } from "lucide-react";

export default function LobbyPage() {
  const [, setLocation] = useLocation();
  const { connected, phase, party } = useGameStore();
  const { createParty, joinParty } = useLobbySocket();

  // Navigate to party room when joined
  useEffect(() => {
    if (phase === "PARTY" && party) {
      setLocation("/party");
    } else if (phase === "GAME") {
      setLocation("/multiplayer");
    }
  }, [phase, party, setLocation]);

  const handleCreateParty = (name: string) => {
    createParty(name);
  };

  const handleJoinParty = (partyCode: string, name: string) => {
    joinParty(partyCode, name);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <h1 className="text-4xl font-bold">Game Lobby</h1>
            {connected ? (
              <Wifi className="h-6 w-6 text-green-500" />
            ) : (
              <WifiOff className="h-6 w-6 text-red-500" />
            )}
          </div>
          <p className="text-muted-foreground">
            Create a party or join using a party code
          </p>
        </div>

        {/* Connection Status */}
        {!connected && (
          <Alert variant="destructive" className="mb-6 max-w-2xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Connecting to server...
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {/* Left Column - Create Party */}
          <div>
            <CreatePartyForm
              onCreateParty={handleCreateParty}
              isLoading={!connected}
            />
          </div>

          {/* Right Column - Join Party */}
          <div>
            <JoinPartyForm
              onJoinParty={handleJoinParty}
              isLoading={!connected}
            />
          </div>
        </div>

        {/* Info Section */}
        <div className="mt-12 max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-3">How to Play</h3>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">Host:</span> Create a party.
                You'll receive a 6-character party code to share with players.
              </p>
              <p>
                <span className="font-semibold text-foreground">Players:</span> Get the party code from your host
                and enter it along with your name to join the game.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
