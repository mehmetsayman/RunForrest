import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type QuickActionProps = {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
  variant?: "primary" | "glass";
  className?: string;
};

export function QuickAction({
  href,
  icon: Icon,
  label,
  description,
  variant = "glass",
  className,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-2xl p-4 transition-all active:scale-[0.98]",
        variant === "primary"
          ? "bg-primary text-primary-foreground neon-glow hover:bg-primary/90"
          : "glass hover:border-primary/20 hover:bg-white/[0.06]",
        className
      )}
    >
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
          variant === "primary"
            ? "bg-white/20"
            : "bg-primary/15"
        )}
      >
        <Icon
          className={cn(
            "size-5",
            variant === "primary" ? "text-white" : "text-primary"
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        {description && (
          <p
            className={cn(
              "mt-0.5 truncate text-xs",
              variant === "primary"
                ? "text-white/70"
                : "text-muted-foreground"
            )}
          >
            {description}
          </p>
        )}
      </div>
    </Link>
  );
}
