"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Wraps children in a div that fades + slides in when it enters the
// viewport. One-shot: unobserves once revealed so it doesn't re-run.
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            window.setTimeout(() => el.classList.add("is-in"), delay);
            io.unobserve(el);
          }
        }
      },
      // Generous rootMargin so anything within ~1 viewport below the fold
      // reveals early (feels snappier + avoids blank sections on scroll).
      { threshold: 0.08, rootMargin: "0px 0px 800px 0px" },
    );
    io.observe(el);

    // Safety fallback: guarantee reveal after 2s regardless of scroll.
    const fallback = window.setTimeout(() => el.classList.add("is-in"), 2000);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [delay]);

  return (
    <div ref={ref} className={`reveal ${className}`}>
      {children}
    </div>
  );
}
