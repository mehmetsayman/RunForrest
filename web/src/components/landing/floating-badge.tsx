"use client";

import { cn } from "@/lib/utils";

type FloatingBadgeProps = {
  city: string;
  tier: string;
  delay?: number;
  className?: string;
};

export function FloatingBadge({
  city,
  tier,
  delay = 0,
  className,
}: FloatingBadgeProps) {
  return (
    <div
      className={cn(
        "glass-strong rounded-2xl p-3 neon-glow-sm animate-float",
        className
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/25">
          <svg
            className="size-4 text-primary"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-semibold text-foreground">{city}</p>
          <p className="text-[10px] text-primary">Tier {tier}</p>
        </div>
      </div>
    </div>
  );
}
