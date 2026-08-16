"use client";

import { useRef, type ReactNode } from "react";

// Card wrapper that follows the cursor with a soft radial spotlight.
// Sets --mx/--my custom props consumed by .glow-card::before.
export function GlowCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${x}%`);
    el.style.setProperty("--my", `${y}%`);
  };

  return (
    <div
      ref={ref}
      className={`glow-card ${className}`}
      onMouseMove={handleMove}
    >
      {children}
    </div>
  );
}
