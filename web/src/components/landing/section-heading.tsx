import { cn } from "@/lib/utils";

type SectionHeadingProps = {
  label: string;
  title: string;
  description?: string;
  className?: string;
  align?: "left" | "center";
};

export function SectionHeading({
  label,
  title,
  description,
  className,
  align = "center",
}: SectionHeadingProps) {
  return (
    <div
      className={cn(
        align === "center" && "text-center",
        className
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
        {label}
      </p>
      <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-gradient sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-3 max-w-md text-base text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
