import type { ReactNode } from "react";

// Wraps each word in a span that rises + fades in on load, staggered.
// Server component — pure output, animation is CSS-only.
export function RiseWords({
  text,
  className = "",
  delayStart = 0,
  stepMs = 60,
  wordClass = "",
}: {
  text: string;
  className?: string;
  delayStart?: number;
  stepMs?: number;
  wordClass?: string;
}) {
  const words = text.split(" ");
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span
          key={i}
          className={`rise-word ${wordClass}`}
          style={{ animationDelay: `${delayStart + i * stepMs}ms` }}
        >
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </span>
  );
}

// Same but allows nested ReactNode segments (for accent-colored phrases).
export function RiseSegments({
  segments,
  className = "",
  delayStart = 0,
  stepMs = 60,
}: {
  segments: Array<{ text: string; className?: string }>;
  className?: string;
  delayStart?: number;
  stepMs?: number;
}): ReactNode {
  let wordIndex = 0;
  return (
    <span className={className}>
      {segments.map((seg, si) => {
        const words = seg.text.split(" ");
        return (
          <span key={si} className={seg.className}>
            {words.map((w, wi) => {
              const idx = wordIndex++;
              return (
                <span
                  key={wi}
                  className="rise-word"
                  style={{ animationDelay: `${delayStart + idx * stepMs}ms` }}
                >
                  {w}
                  {wi < words.length - 1 ? " " : ""}
                </span>
              );
            })}
            {si < segments.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}
