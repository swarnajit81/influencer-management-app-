"use client";

import { useEffect, useRef, useState } from "react";

type Step = {
  n: string;
  title: string;
  blurb: string;
  keys: string[];
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "Build the shortlist",
    blurb:
      "Multi-select from your roster. Rate cards autofill. Margin is visible per row before you send.",
    keys: ["Roster", "Rate card", "Margin"],
  },
  {
    n: "02",
    title: "Send the package",
    blurb:
      "One click freezes a numbered snapshot. A signed link goes to the brand — no login, no app.",
    keys: ["Snapshot", "Signed link", "Version 1"],
  },
  {
    n: "03",
    title: "Brand decides live",
    blurb:
      "Approve, reject, or request revision per creator with a comment. Your inbox pings the second they act.",
    keys: ["Approve", "Reject", "Revision"],
  },
  {
    n: "04",
    title: "Chat on the same page",
    blurb:
      "Per-campaign thread. No parallel WhatsApp. Every message lands in the same audit log as the decisions.",
    keys: ["Thread", "Audit log", "One place"],
  },
];

export function Tutorial() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-advance every 4.2s when in view. Pauses if user hovers.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let interval: number | undefined;
    let progressTicker: number | undefined;
    let paused = false;

    const start = () => {
      stop();
      const stepMs = 4200;
      const tickMs = 30;
      let elapsed = 0;
      progressTicker = window.setInterval(() => {
        if (paused) return;
        elapsed += tickMs;
        setProgress(Math.min(100, (elapsed / stepMs) * 100));
        if (elapsed >= stepMs) {
          elapsed = 0;
          setActive((a) => (a + 1) % STEPS.length);
          setProgress(0);
        }
      }, tickMs);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      if (progressTicker) clearInterval(progressTicker);
    };

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) start();
          else stop();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);

    const onEnter = () => (paused = true);
    const onLeave = () => (paused = false);
    el.addEventListener("mouseenter", onEnter);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      io.disconnect();
      stop();
      el.removeEventListener("mouseenter", onEnter);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const handleClick = (i: number) => {
    setActive(i);
    setProgress(0);
  };

  return (
    <div
      ref={containerRef}
      className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_1.2fr]"
    >
      {/* Steps list */}
      <ol className="space-y-1">
        {STEPS.map((s, i) => {
          const isActive = i === active;
          return (
            <li key={s.n}>
              <button
                type="button"
                onClick={() => handleClick(i)}
                className={`relative w-full overflow-hidden rounded-md border p-4 text-left transition-colors hairline ${
                  isActive
                    ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
                    : "hover:bg-[var(--surface)]"
                }`}
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={`text-[11px] font-medium tabular ${
                      isActive ? "text-[var(--accent)]" : "text-[var(--subtle)]"
                    }`}
                  >
                    {s.n}
                  </span>
                  <span className="text-[14px] font-semibold">{s.title}</span>
                </div>
                <p
                  className={`mt-2 text-[13px] leading-relaxed ${
                    isActive
                      ? "text-[var(--foreground)]"
                      : "text-[var(--muted)]"
                  }`}
                >
                  {s.blurb}
                </p>
                {isActive && (
                  <span
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[var(--accent)] transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      {/* Live preview panel */}
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-2xl bg-[var(--accent-soft)] opacity-70 blur-2xl"
        />
        <div className="panel overflow-hidden">
          {/* Fake browser chrome */}
          <div className="flex items-center gap-2 border-b px-3 py-2 hairline">
            <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
            <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
            <span className="h-2 w-2 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-[10px] tabular text-[var(--subtle)]">
              step {STEPS[active].n} · {STEPS[active].title.toLowerCase()}
            </span>
          </div>

          {/* Frame body — different content per step. Key on active forces
              a re-mount so the enter animation replays on each switch. */}
          <div key={active} className="min-h-[300px] p-5">
            {active === 0 && <StepShortlist />}
            {active === 1 && <StepSend />}
            {active === 2 && <StepDecide />}
            {active === 3 && <StepChat />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Individual step previews ---------- */

function StepShortlist() {
  const rows = [
    { name: "Aditi Iyer", cost: 60, brand: 90, checked: true },
    { name: "Priya Menon", cost: 45, brand: 70, checked: true },
    { name: "Zara Bose", cost: 55, brand: 80, checked: true },
    { name: "Rohan Nair", cost: 80, brand: 120, checked: false },
    { name: "Vihaan Das", cost: 30, brand: 45, checked: false },
  ];
  return (
    <div>
      <p className="eyebrow">Roster · Diwali &apos;26 shortlist</p>
      <ul className="mt-3 divide-y overflow-hidden rounded-md border hairline">
        {rows.map((r, i) => (
          <li
            key={r.name}
            className="animate-in flex items-center gap-3 bg-[var(--surface)] px-3 py-2 text-[12px]"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
                r.checked
                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                  : "hairline"
              }`}
            >
              {r.checked && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </span>
            <span className="flex-1 font-medium">{r.name}</span>
            <span className="text-[11px] tabular text-[var(--subtle)]">
              cost ₹{r.cost}k
            </span>
            <span className="text-[11px] tabular text-[var(--muted)]">→</span>
            <span className="text-[12px] font-semibold tabular">₹{r.brand}k</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between text-[11px] tabular">
        <span className="text-[var(--muted)]">3 selected · cost ₹1.60L</span>
        <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          margin ₹80k (33%)
        </span>
      </div>
    </div>
  );
}

function StepSend() {
  return (
    <div>
      <p className="eyebrow">Package · about to send</p>
      <div className="mt-3 rounded-md border p-4 hairline">
        <div className="flex items-baseline justify-between">
          <p className="text-[14px] font-semibold">Diwali &apos;26 Skincare</p>
          <span className="text-[10px] tabular text-[var(--subtle)]">v1</span>
        </div>
        <p className="mt-1 text-[11px] text-[var(--muted)]">
          3 creators · brand price ₹2.40L
        </p>
        <div className="mt-4">
          <button
            type="button"
            className="relative w-full overflow-hidden rounded-md bg-[var(--accent)] px-3 py-2 text-[13px] font-medium text-white"
          >
            <span className="relative z-10">Send to brand →</span>
            <span
              aria-hidden
              className="absolute inset-0 z-0 bg-white/20"
              style={{
                animation: "shine 1600ms ease-out infinite",
                clipPath: "polygon(0 0, 20% 0, 40% 100%, 0 100%)",
              }}
            />
          </button>
        </div>
      </div>
      <ol className="mt-4 space-y-1.5 text-[11px] text-[var(--muted)]">
        <li className="animate-in" style={{ animationDelay: "200ms" }}>
          ✓ Snapshot frozen (v1)
        </li>
        <li className="animate-in" style={{ animationDelay: "500ms" }}>
          ✓ Signed link generated
        </li>
        <li className="animate-in" style={{ animationDelay: "800ms" }}>
          ✓ Email queued to contact@kirti.in
        </li>
      </ol>
    </div>
  );
}

function StepDecide() {
  const rows = [
    { name: "Aditi Iyer", state: "approved", delay: 200 },
    { name: "Priya Menon", state: "approved", delay: 900 },
    { name: "Zara Bose", state: "revision", delay: 1600 },
  ];
  return (
    <div>
      <p className="eyebrow">Brand · /p/package/…</p>
      <ul className="mt-3 space-y-2">
        {rows.map((r) => (
          <li
            key={r.name}
            className="animate-in flex items-center justify-between rounded-md border px-3 py-2 hairline"
            style={{ animationDelay: `${r.delay}ms` }}
          >
            <span className="text-[13px] font-medium">{r.name}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                r.state === "approved"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
              }`}
            >
              <span
                className={`signal-dot ${
                  r.state === "approved" ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
              {r.state}
            </span>
          </li>
        ))}
      </ul>
      <div
        className="animate-in mt-3 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] p-3 text-[12px]"
        style={{ animationDelay: "2200ms" }}
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--accent)]">
          Inbox ping · just now
        </p>
        <p className="mt-1 text-[var(--foreground)]">
          <span className="font-semibold">Kirti Media</span> made 3 decisions
          on Diwali &apos;26 Skincare.
        </p>
      </div>
    </div>
  );
}

function StepChat() {
  const msgs = [
    { from: "brand", body: "Can Zara add one story?", delay: 200 },
    { from: "agency", body: "Yes — same price. Confirming with her now.", delay: 900 },
    { from: "brand", body: "Perfect. Let's lock it.", delay: 1700 },
  ];
  return (
    <div>
      <p className="eyebrow">Message thread · Diwali &apos;26</p>
      <ul className="mt-3 space-y-2">
        {msgs.map((m, i) => (
          <li
            key={i}
            className={`animate-in flex ${
              m.from === "brand" ? "justify-end" : "justify-start"
            }`}
            style={{ animationDelay: `${m.delay}ms` }}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug ${
                m.from === "brand"
                  ? "rounded-br-sm bg-[var(--accent)] text-white"
                  : "rounded-bl-sm border bg-[var(--surface)] hairline"
              }`}
            >
              <p className="mb-0.5 text-[9px] font-medium uppercase tracking-[0.14em] opacity-70">
                {m.from}
              </p>
              <p>{m.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-2 rounded-md border px-3 py-2 hairline">
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]"
        />
        <span className="text-[11px] text-[var(--muted)]">
          Every message + decision lands in the campaign event log.
        </span>
      </div>
    </div>
  );
}
