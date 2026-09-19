import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatPillProps = {
  label: string;
  value: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatPill({ label, value, icon: Icon, className }: StatPillProps) {
  return (
    <div
      className={cn(
        "glass card-elevated flex flex-col gap-1.5 rounded-xl px-3 py-3 min-w-0 transition-all duration-200 hover:bg-white/[0.06]",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="size-3.5 text-primary shrink-0" />}
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}
