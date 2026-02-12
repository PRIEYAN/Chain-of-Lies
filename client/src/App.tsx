import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import LandingPage from "@/pages/LandingPage";
import LobbyPage from "@/pages/LobbyPage";
import RoleRevealPage from "@/pages/RoleRevealPage";
import GamePage from "@/pages/GamePage";
import AuditPage from "@/pages/AuditPage";
import VotingPage from "@/pages/VotingPage";
import RevealPage from "@/pages/RevealPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/lobby" component={LobbyPage} />
      <Route path="/role" component={RoleRevealPage} />
      <Route path="/game" component={GamePage} />
      <Route path="/audit" component={AuditPage} />
      <Route path="/voting" component={VotingPage} />
      <Route path="/reveal" component={RevealPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
