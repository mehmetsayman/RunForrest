import Link from "next/link";
import { cn } from "@/lib/utils";

type NeonButtonProps = {
  children: React.ReactNode;
  href?: string;
  className?: string;
  size?: "default" | "lg";
  variant?: "primary" | "outline";
  onClick?: () => void;
  disabled?: boolean;
};

const baseClasses =
  "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-200 select-none";

const variants = {
  primary:
    "bg-primary text-primary-foreground neon-glow hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
  outline:
    "border border-white/10 bg-white/5 text-foreground backdrop-blur hover:bg-white/10 hover:border-primary/30 active:scale-[0.97]",
};

export function NeonButton({
  children,
  href,
  className,
  size = "default",
  variant = "primary",
  onClick,
  disabled = false,
}: NeonButtonProps) {
  const classes = cn(
    baseClasses,
    variants[variant],
    size === "lg" ? "h-12 px-8 text-base gap-2" : "h-10 px-6 text-sm gap-1.5",
    className
  );

  if (href && !disabled) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}
