import { cn } from "@/lib/utils";

export default function NeonMeter({
  value,
  max,
  label,
  intent = "primary",
  "data-testid": dataTestId,
}: {
  value: number;
  max: number;
  label: string;
  intent?: "primary" | "accent" | "danger";
  "data-testid"?: string;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const bar =
    intent === "accent"
      ? "from-accent/80 to-accent/20"
      : intent === "danger"
        ? "from-destructive/80 to-destructive/20"
        : "from-primary/80 to-primary/20";

  return (
    <div className="w-full" data-testid={dataTestId}>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
        <span>{label}</span>
        <span className="tabular-nums">
          {Math.max(0, value)} / {max}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-white/5 border border-white/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", bar, "transition-[width] duration-300 ease-out")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
