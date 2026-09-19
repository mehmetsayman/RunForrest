import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex items-start justify-between gap-4 pt-2 safe-top", className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-gradient font-heading">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
