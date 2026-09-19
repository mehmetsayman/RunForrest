import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/constants";

type LogoProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

export function Logo({ className, size = "md" }: LogoProps) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
  };

  return (
    <span
      className={cn(
        "font-bold tracking-tight text-gradient-stellar font-heading select-none",
        sizes[size],
        className
      )}
    >
      {APP_NAME}
    </span>
  );
}
