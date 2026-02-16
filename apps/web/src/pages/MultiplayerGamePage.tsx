/**
 * Multiplayer Game Page
 * 
 * Main game view with real-time player synchronization
 */
import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGameStore } from "@/stores/useGameStore";
import { useLobbySocket } from "@/hooks/useLobbySocket";
import { useGameSocket } from "@/hooks/useGameSocket";
import MultiplayerGameCanvas from "../../game/MultiplayerGameCanvas";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function MultiplayerGamePage() {
  const [, setLocation] = useLocation();
  const { party, players, localPlayerId, phase } = useGameStore();
  const { leaveParty } = useLobbySocket();
  useGameSocket(); // Initialize game socket listeners

  // Redirect if not in game
  useEffect(() => {
    if (!party || phase !== "GAME") {
      setLocation("/lobby");
    }
  }, [party, phase, setLocation]);

  const handleLeaveGame = () => {
    leaveParty();
    setLocation("/lobby");
  };

  if (!party || !localPlayerId) {
    return null;
  }

  const playersArray = Object.values(players);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">
              {party.hostName}'s Game
            </h1>
            <p className="text-sm text-muted-foreground">
              Party Code: <span className="font-mono font-semibold text-primary">{party.partyCode}</span>
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleLeaveGame}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Leave Game
          </Button>
        </div>

        {/* Game Canvas */}
        <div className="flex justify-center">
          {localPlayerId ? (
            <MultiplayerGameCanvas />
          ) : (
            <div className="flex items-center justify-center h-[500px] w-[800px] border border-white/10 rounded-lg">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-muted-foreground">Connecting to game...</p>
              </div>
            </div>
          )}
        </div>

        {/* Player List */}
        <div className="mt-6 max-w-2xl mx-auto">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">
              Players ({playersArray.length})
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {playersArray.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: player.color }}
                  />
                  <span className="text-sm truncate">
                    {player.name}
                    {player.id === localPlayerId && " (You)"}
                  </span>
                  {player.isHost && <span className="text-xs">👑</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
