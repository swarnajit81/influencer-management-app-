"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = {
  from: "agency" | "brand";
  body: string;
  delayMs?: number; // wait AFTER previous before this one starts
  typingMs?: number; // typing-dots duration
};

const SCRIPT: Msg[] = [
  {
    from: "agency",
    body: "Sending v2 for Diwali. Swapped Rhea for Priya Menon — better fit for skincare.",
    delayMs: 400,
    typingMs: 900,
  },
  {
    from: "brand",
    body: "Opening now.",
    delayMs: 800,
    typingMs: 500,
  },
  {
    from: "brand",
    body: "Priya's engagement is way better. Approved. Rejecting Rohan though — audience is too fitness-heavy.",
    delayMs: 900,
    typingMs: 1400,
  },
  {
    from: "agency",
    body: "Copy. Also confirming — is ₹80k okay for Zara or should we come down?",
    delayMs: 700,
    typingMs: 1100,
  },
  {
    from: "brand",
    body: "₹80k is fine. Let's lock it and move.",
    delayMs: 900,
    typingMs: 700,
  },
];

const TOTAL_MS = SCRIPT.reduce(
  (s, m) => s + (m.delayMs ?? 0) + (m.typingMs ?? 0) + 1200,
  400,
);

export function AnimatedChat() {
  const [visibleCount, setVisibleCount] = useState(0);
  const [typingIdx, setTypingIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const play = () => {
      if (runningRef.current) return;
      runningRef.current = true;
      setVisibleCount(0);
      setTypingIdx(null);

      let elapsed = 0;
      const timers: number[] = [];

      SCRIPT.forEach((m, i) => {
        elapsed += m.delayMs ?? 0;
        // Show typing dots.
        timers.push(
          window.setTimeout(() => setTypingIdx(i), elapsed),
        );
        elapsed += m.typingMs ?? 0;
        // Reveal the message + clear typing.
        timers.push(
          window.setTimeout(() => {
            setVisibleCount(i + 1);
            setTypingIdx(null);
          }, elapsed),
        );
        elapsed += 1200;
      });

      // Loop.
      timers.push(
        window.setTimeout(() => {
          runningRef.current = false;
          play();
        }, TOTAL_MS + 2200),
      );

      return () => {
        timers.forEach(clearTimeout);
        runningRef.current = false;
      };
    };

    let cleanup: (() => void) | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !runningRef.current) {
            cleanup = play();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cleanup?.();
    };
  }, []);

  // Auto-scroll to bottom when a new message lands.
  useEffect(() => {
    const s = scrollerRef.current;
    if (s) s.scrollTo({ top: s.scrollHeight, behavior: "smooth" });
  }, [visibleCount, typingIdx]);

  const items = useMemo(() => SCRIPT.slice(0, visibleCount), [visibleCount]);

  return (
    <div ref={containerRef} className="relative mx-auto max-w-md">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[36px] bg-[var(--accent-soft)] blur-2xl"
      />

      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-[36px] border hairline bg-[var(--surface)] p-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
        {/* Notch */}
        <div className="mx-auto mb-2 flex h-4 items-center justify-center">
          <span className="h-2 w-24 rounded-full bg-[var(--border-strong)]" />
        </div>

        {/* Screen */}
        <div className="overflow-hidden rounded-[24px] border hairline bg-[var(--background)]">
          {/* Header */}
          <div className="flex items-center gap-3 border-b px-4 py-3 hairline">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-semibold text-white">
              KM
            </div>
            <div className="flex-1">
              <p className="text-[13px] font-semibold leading-tight">
                Kirti Media
              </p>
              <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--subtle)]">
                Diwali &apos;26 · v2
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600">
              <span className="signal-dot bg-emerald-500" />
              live
            </span>
          </div>

          {/* Scroll area */}
          <div
            ref={scrollerRef}
            className="max-h-[360px] min-h-[360px] space-y-2.5 overflow-y-auto px-4 py-4"
          >
            {items.map((m, i) => (
              <ChatBubble key={i} msg={m} />
            ))}
            {typingIdx != null && typingIdx === visibleCount && (
              <TypingBubble from={SCRIPT[typingIdx].from} />
            )}
          </div>

          {/* Composer */}
          <div className="flex items-center gap-2 border-t px-3 py-2 hairline">
            <input
              type="text"
              disabled
              placeholder="Message the agency…"
              className="flex-1 rounded-md border bg-[var(--surface)] px-3 py-2 text-[12px] outline-none hairline placeholder:text-[var(--subtle)] disabled:opacity-80"
            />
            <button
              type="button"
              disabled
              className="rounded-md bg-[var(--accent)] px-3 py-2 text-[12px] font-medium text-white opacity-90"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ msg }: { msg: Msg }) {
  const mine = msg.from === "brand";
  return (
    <div
      className={`flex ${mine ? "justify-end" : "justify-start"} animate-in`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${
          mine
            ? "rounded-br-sm bg-[var(--accent)] text-white"
            : "rounded-bl-sm bg-[var(--surface)] text-[var(--foreground)] border hairline"
        }`}
      >
        <p className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.14em] opacity-70">
          {msg.from}
        </p>
        <p className="whitespace-pre-wrap">{msg.body}</p>
      </div>
    </div>
  );
}

function TypingBubble({ from }: { from: "agency" | "brand" }) {
  const mine = from === "brand";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`inline-flex gap-1 rounded-2xl px-3 py-2.5 ${
          mine
            ? "rounded-br-sm bg-[var(--accent)]/80"
            : "rounded-bl-sm bg-[var(--surface)] border hairline"
        }`}
      >
        <span className="typing-dot" style={{ animationDelay: "0ms" }} />
        <span className="typing-dot" style={{ animationDelay: "160ms" }} />
        <span className="typing-dot" style={{ animationDelay: "320ms" }} />
      </div>
    </div>
  );
}
