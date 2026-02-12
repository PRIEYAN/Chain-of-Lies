import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Wifi, WifiOff, ShieldAlert, Swords, Blocks } from "lucide-react";
import { cn } from "@/lib/utils";

export default function NeonTopbar({
  connected,
  phaseLabel,
  rightSlot,
}: {
  connected: boolean;
  phaseLabel?: string;
  rightSlot?: React.ReactNode;
}) {
  const [loc] = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/30 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="group inline-flex items-center gap-2 rounded-xl px-2 py-1 transition-all hover:bg-white/5"
          data-testid="nav-home"
        >
          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl bg-primary/10 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center neon-ring">
              <Blocks className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="leading-tight">
            <div className="text-[13px] text-muted-foreground font-medium">Takshashila</div>
            <div className="text-[15px] font-semibold tracking-tight text-gradient">Tamper Hunt</div>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-2 ml-2">
          <Badge
            variant="secondary"
            className="bg-white/5 border-white/10 text-foreground/90"
            data-testid="nav-location"
          >
            {loc === "/" ? "Landing" : loc.replace("/", "").toUpperCase()}
          </Badge>
          {phaseLabel ? (
            <Badge className="bg-primary/15 text-primary border-primary/30" data-testid="nav-phase">
              {phaseLabel}
            </Badge>
          ) : null}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Badge
            className={cn(
              "gap-1.5 border",
              connected
                ? "bg-[hsl(136_92%_56%/0.12)] text-[hsl(136_92%_56%)] border-[hsl(136_92%_56%/0.25)]"
                : "bg-destructive/10 text-destructive border-destructive/25",
            )}
            data-testid="ws-status"
          >
            {connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            {connected ? "Live" : "Offline"}
          </Badge>

          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              className="border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20 transition-all"
              onClick={() => {
                // purely UI affordance; no auth in spec
                window.dispatchEvent(new CustomEvent("tth:help"));
              }}
              data-testid="help-btn"
            >
              <ShieldAlert className="h-4 w-4 mr-2 text-primary" />
              Protocol
            </Button>

            <Button
              variant="secondary"
              className="bg-gradient-to-r from-primary/20 to-accent/10 border border-primary/20 hover:border-primary/40 hover:bg-white/5 transition-all"
              onClick={() => window.dispatchEvent(new CustomEvent("tth:quickstart"))}
              data-testid="quickstart-btn"
            >
              <Swords className="h-4 w-4 mr-2 text-accent" />
              Quickstart
            </Button>
          </div>

          {rightSlot}
        </div>
      </div>
    </header>
  );
}
