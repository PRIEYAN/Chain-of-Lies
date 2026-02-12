import React from "react";
import { cn } from "@/lib/utils";

export default function GlowCard({
  children,
  className,
  glow = "primary",
}: {
  children: React.ReactNode;
  className?: string;
  glow?: "primary" | "accent" | "danger" | "none";
}) {
  const glowClass =
    glow === "primary"
      ? "shadow-[0_0_0_1px_hsl(var(--primary)/0.2),_0_18px_70px_-42px_hsl(var(--primary)/0.75)]"
      : glow === "accent"
        ? "shadow-[0_0_0_1px_hsl(var(--accent)/0.2),_0_18px_70px_-42px_hsl(var(--accent)/0.65)]"
        : glow === "danger"
          ? "shadow-[0_0_0_1px_hsl(var(--destructive)/0.22),_0_18px_70px_-42px_hsl(var(--destructive)/0.7)]"
          : "shadow-[0_18px_70px_-52px_rgba(0,0,0,0.8)]";

  return (
    <div
      className={cn(
        "glass-card rounded-2xl p-5 sm:p-6",
        "transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg",
        glowClass,
        className,
      )}
    >
      {children}
    </div>
  );
}
