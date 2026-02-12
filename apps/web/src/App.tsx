import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GameProvider } from "@/contexts/GameContext";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/LandingPage";
import LobbyPage from "@/pages/LobbyPage";
import RoleRevealPage from "@/pages/RoleRevealPage";
import GameEngine from "@/components/GameEngine";
import HUD from "@/components/HUD";
import TaskOverlay from "@/components/overlays/TaskOverlay";
import VotingOverlay from "@/components/overlays/VotingOverlay";
import EmergencyOverlay from "@/components/overlays/EmergencyOverlay";
import RevealOverlay from "@/components/overlays/RevealOverlay";

function GameView() {
  return (
    <>
      <GameEngine />
      <HUD />
      <TaskOverlay />
      <VotingOverlay />
      <EmergencyOverlay />
      <RevealOverlay />
    </>
  );
}

function Router() {
  const [location] = useLocation();
  const isInGame = ["/game", "/task", "/audit", "/voting", "/reveal"].some(path => 
    location.startsWith(path)
  );

  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/lobby" component={LobbyPage} />
      <Route path="/role" component={RoleRevealPage} />
      
      {/* All game phases now use the same GameView with overlays */}
      <Route path="/game" component={GameView} />
      <Route path="/task" component={GameView} />
      <Route path="/audit" component={GameView} />
      <Route path="/voting" component={GameView} />
      <Route path="/reveal" component={GameView} />
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GameProvider>
          <Toaster />
          <Router />
        </GameProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
