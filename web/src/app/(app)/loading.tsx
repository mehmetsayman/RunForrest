import { Logo } from "@/components/runforrest/logo";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6">
      <div className="relative">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/20 animate-pulse-glow">
          <svg
            className="size-8 text-primary animate-spin"
            style={{ animationDuration: "1.5s" }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="50 14"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <Logo size="sm" />
        <p className="mt-1 text-xs text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
