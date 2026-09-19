import { cn } from "@/lib/utils";

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  strong?: boolean;
  glow?: boolean;
  hover?: boolean;
};

export function GlassCard({
  children,
  className,
  strong = false,
  glow = false,
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl transition-all duration-200",
        strong ? "glass-strong" : "glass",
        glow ? "card-elevated-glow" : "card-elevated",
        hover &&
          "cursor-pointer hover:bg-white/[0.06] hover:border-primary/20 hover:scale-[1.01] active:scale-[0.99]",
        className
      )}
    >
      {children}
    </div>
  );
}
