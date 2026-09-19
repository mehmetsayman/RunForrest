"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";

const RunMap = dynamic(
  () => import("./run-map").then((mod) => mod.RunMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <div className="flex flex-col items-center gap-2">
          <div className="size-6 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <span className="text-xs text-muted-foreground">Loading map...</span>
        </div>
      </div>
    ),
  }
);

export { RunMap };
