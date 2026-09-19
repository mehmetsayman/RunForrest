import { cn } from "@/lib/utils";

type MobileContainerProps = {
  children: React.ReactNode;
  className?: string;
  withNav?: boolean;
};

export function MobileContainer({
  children,
  className,
  withNav = false,
}: MobileContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-lg px-5",
        withNav && "pb-28",
        className
      )}
    >
      {children}
    </div>
  );
}
