"use client";

import { cn } from "@/lib/utils";

type PageWrapperProps = {
  children: React.ReactNode;
  className?: string;
};

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <div className={cn("animate-page-enter", className)}>
      {children}
    </div>
  );
}
