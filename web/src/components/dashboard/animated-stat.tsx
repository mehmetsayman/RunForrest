"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type AnimatedStatProps = {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  delay?: number;
  className?: string;
};

export function AnimatedStat({
  label,
  value,
  icon: Icon,
  trend,
  trendUp = true,
  delay = 0,
  className,
}: AnimatedStatProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={cn(
        "glass flex flex-col gap-2 rounded-2xl p-3.5 transition-all duration-500",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
          <Icon className="size-4 text-primary" />
        </div>
        {trend && (
          <span
            className={cn(
              "text-[10px] font-medium",
              trendUp ? "text-emerald-400" : "text-red-400"
            )}
          >
            {trendUp ? "+" : ""}{trend}
          </span>
        )}
      </div>
      <div>
        <p className="text-xl font-bold tabular-nums">{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
    </div>
  );
}
