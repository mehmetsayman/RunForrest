import { cn } from "@/lib/utils";

export function GradientBg({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10",
        className
      )}
    >
      {/* Main mesh gradient */}
      <div className="absolute inset-0 mesh-bg" />
      {/* Subtle animated ambient glow */}
      <div
        className="absolute top-0 left-1/2 h-[50vh] w-[80vw] -translate-x-1/2 rounded-full bg-primary/[0.07] blur-[120px] animate-pulse"
        style={{ animationDuration: "6s" }}
      />
    </div>
  );
}
