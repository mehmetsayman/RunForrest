"use client";

import { useEffect, useRef, useState } from "react";

type AnimatedCounterProps = {
  target: string;
  suffix?: string;
  className?: string;
};

export function AnimatedCounter({
  target,
  suffix = "",
  className,
}: AnimatedCounterProps) {
  const [value, setValue] = useState("0");
  const ref = useRef<HTMLSpanElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          animateValue();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();

    function animateValue() {
      const numericPart = parseFloat(target.replace(/[^0-9.]/g, ""));
      const hasDecimal = target.includes(".");
      const duration = 1600;
      const startTime = performance.now();

      function tick(now: number) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 4);
        const current = numericPart * eased;

        if (hasDecimal) {
          setValue(current.toFixed(1));
        } else {
          setValue(Math.floor(current).toString());
        }

        if (progress < 1) requestAnimationFrame(tick);
        else setValue(target);
      }

      requestAnimationFrame(tick);
    }
  }, [target]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}
