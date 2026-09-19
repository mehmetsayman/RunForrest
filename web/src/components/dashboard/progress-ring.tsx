"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ProgressRingProps = {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  icon?: React.ReactNode;
  className?: string;
  color?: string;
};

export function ProgressRing({
  value,
  max,
  size = 100,
  strokeWidth = 6,
  label,
  sublabel,
  icon,
  className,
  color = "stroke-primary",
}: ProgressRingProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const percent = Math.min((value / max) * 100, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animatedPercent / 100) * circumference;

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(percent), 100);
    return () => clearTimeout(timer);
  }, [percent]);

  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-white/[0.06]"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(color, "transition-all duration-1000 ease-out")}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            filter: "drop-shadow(0 0 6px rgba(253, 218, 36, 0.45))",
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center text-center">
        {icon}
        {label && <span className="text-sm font-bold tabular-nums">{label}</span>}
        {sublabel && (
          <span className="text-[9px] text-muted-foreground">{sublabel}</span>
        )}
      </div>
    </div>
  );
}
