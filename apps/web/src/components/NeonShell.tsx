import React from "react";
import { cn } from "@/lib/utils";

export default function NeonShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-[100dvh] bg-grid-neon", className)}>
      <div className="absolute inset-0 pointer-events-none opacity-70">
        <div className="absolute -top-24 left-[10%] h-80 w-80 rounded-full blur-3xl bg-primary/10" />
        <div className="absolute top-12 right-[8%] h-96 w-96 rounded-full blur-3xl bg-accent/10" />
        <div className="absolute bottom-[-8rem] left-[35%] h-[30rem] w-[30rem] rounded-full blur-3xl bg-[hsl(280_86%_70%/0.12)]" />
      </div>

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 opacity-[0.7]">
          <div className="scanlines absolute inset-0" />
        </div>

        <div className="relative grain-overlay">{children}</div>
      </div>
    </div>
  );
}
