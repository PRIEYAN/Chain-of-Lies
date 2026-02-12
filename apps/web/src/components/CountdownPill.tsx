import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CountdownPill({
  seconds,
  label,
  intent = "primary",
  "data-testid": dataTestId,
}: {
  seconds: number;
  label?: string;
  intent?: "primary" | "accent" | "danger";
  "data-testid"?: string;
}) {
  const s = Math.max(0, Math.floor(seconds));
  const color =
    intent === "danger"
      ? "text-destructive border-destructive/30 bg-destructive/10"
      : intent === "accent"
        ? "text-accent border-accent/30 bg-accent/10"
        : "text-primary border-primary/30 bg-primary/10";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 border",
        "shadow-[0_10px_35px_-24px_rgba(0,0,0,0.9)] backdrop-blur",
        color,
      )}
      data-testid={dataTestId}
    >
      <Timer className="h-4 w-4" />
      <span className="text-xs font-medium text-foreground/80">{label ?? "Timer"}</span>
      <span className="text-sm font-semibold tabular-nums">{s}s</span>
    </div>
  );
}
