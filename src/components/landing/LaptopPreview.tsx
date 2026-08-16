"use client";

import { useMemo, useRef, useState } from "react";

// 30-day pipeline value (in lakhs). Deterministic so SSR + hydration match.
const DAILY_VALUE_LAKHS = [
  12, 14, 13, 16, 18, 17, 20, 22, 21, 25,
  24, 28, 30, 29, 33, 35, 34, 38, 42, 40,
  45, 48, 46, 52, 55, 54, 58, 62, 60, 68,
];

type Point = { x: number; y: number; value: number; day: number };

export function LaptopPreview() {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const width = 640;
  const height = 240;
  const padX = 24;
  const padY = 24;

  const { points, path, area, maxV, minV } = useMemo(() => {
    const values = DAILY_VALUE_LAKHS;
    const maxV = Math.max(...values);
    const minV = Math.min(...values);
    const range = maxV - minV || 1;
    const w = width - padX * 2;
    const h = height - padY * 2;

    const pts: Point[] = values.map((v, i) => {
      const x = padX + (i / (values.length - 1)) * w;
      const y = padY + h - ((v - minV) / range) * h;
      return { x, y, value: v, day: i };
    });

    // Smooth catmull-rom-ish path.
    const path = pts.reduce((acc, p, i, arr) => {
      if (i === 0) return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      const prev = arr[i - 1];
      const cx = (prev.x + p.x) / 2;
      return `${acc} C ${cx.toFixed(2)} ${prev.y.toFixed(2)}, ${cx.toFixed(2)} ${p.y.toFixed(2)}, ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }, "");

    const area = `${path} L ${pts[pts.length - 1].x.toFixed(2)} ${height - padY} L ${pts[0].x.toFixed(2)} ${height - padY} Z`;

    return { points: pts, path, area, maxV, minV };
  }, [width, height, padX, padY]);

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    // Find nearest point by x.
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - x);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };

  const active = hoverIdx != null ? points[hoverIdx] : points[points.length - 1];
  const totalLakhs = DAILY_VALUE_LAKHS.reduce((s, v) => s + v, 0);
  const growth =
    ((DAILY_VALUE_LAKHS[DAILY_VALUE_LAKHS.length - 1] - DAILY_VALUE_LAKHS[0]) /
      DAILY_VALUE_LAKHS[0]) *
    100;

  return (
    <div className="relative mx-auto">
      {/* Ambient accent glow behind the laptop */}
      <div
        aria-hidden
        className="absolute -inset-10 -z-10 rounded-[48px] bg-[var(--accent-soft)] blur-3xl"
      />

      {/* Laptop chassis */}
      <div className="relative">
        {/* Screen bezel */}
        <div className="relative rounded-t-[18px] border border-b-0 hairline bg-[var(--surface)] p-3 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]">
          {/* Camera notch */}
          <div className="mx-auto mb-2 flex h-2.5 items-center justify-center">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--border-strong)]" />
          </div>

          {/* Browser window */}
          <div className="overflow-hidden rounded-lg border hairline bg-[var(--surface)]">
            {/* Browser chrome */}
            <div className="flex items-center gap-3 border-b px-3 py-2 hairline">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-md border px-2 py-1 hairline">
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-[var(--subtle)]"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <span className="text-[10px] tabular text-[var(--subtle)]">
                  prplatform.in/agency
                </span>
              </div>
            </div>

            {/* Inside — the "dashboard" */}
            <div className="grid gap-0 sm:grid-cols-[140px_minmax(0,1fr)]">
              {/* Mini sidebar */}
              <div className="hidden border-r px-3 py-4 hairline sm:block">
                <div className="flex items-center gap-2 rounded-md border px-2 py-1.5 hairline">
                  <span className="flex h-4 w-4 items-center justify-center rounded bg-[var(--accent)] text-[8px] font-semibold text-white">
                    QA
                  </span>
                  <span className="text-[10px] font-medium">Kirti Media</span>
                </div>
                <ul className="mt-3 space-y-0.5 text-[10px]">
                  <li className="rounded px-2 py-1 text-[var(--foreground)]">
                    Dashboard
                  </li>
                  <li className="rounded px-2 py-1 text-[var(--muted)]">
                    Inbox
                  </li>
                  <li className="rounded px-2 py-1 text-[var(--muted)]">
                    Campaigns
                  </li>
                  <li className="rounded px-2 py-1 text-[var(--muted)]">
                    Brands
                  </li>
                  <li className="rounded px-2 py-1 text-[var(--muted)]">
                    Influencers
                  </li>
                </ul>
              </div>

              {/* Chart panel */}
              <div className="px-5 py-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-[9px] font-medium uppercase tracking-[0.14em] text-[var(--subtle)]">
                      Pipeline value · 30d
                    </p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="display text-2xl tabular">
                        ₹{(active.value).toFixed(0)}.00L
                      </span>
                      <span className="text-[10px] font-medium tabular text-emerald-600">
                        +{growth.toFixed(1)}%
                      </span>
                    </p>
                    <p className="mt-0.5 text-[9px] tabular text-[var(--subtle)]">
                      day {active.day + 1} of 30 · total ₹{totalLakhs}L
                    </p>
                  </div>
                  <div className="flex gap-1 text-[9px]">
                    <span className="rounded border px-1.5 py-0.5 tabular text-[var(--muted)] hairline">
                      1D
                    </span>
                    <span className="rounded border px-1.5 py-0.5 tabular text-[var(--muted)] hairline">
                      7D
                    </span>
                    <span className="rounded border-[var(--accent-line)] border bg-[var(--accent-soft)] px-1.5 py-0.5 tabular text-[var(--accent)]">
                      30D
                    </span>
                    <span className="rounded border px-1.5 py-0.5 tabular text-[var(--muted)] hairline">
                      All
                    </span>
                  </div>
                </div>

                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${width} ${height}`}
                  className="mt-2 w-full cursor-crosshair"
                  onMouseMove={handleMove}
                  onMouseLeave={() => setHoverIdx(null)}
                >
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.24" />
                      <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal grid lines */}
                  {[0.25, 0.5, 0.75].map((frac) => (
                    <line
                      key={frac}
                      x1={padX}
                      x2={width - padX}
                      y1={padY + (height - padY * 2) * frac}
                      y2={padY + (height - padY * 2) * frac}
                      stroke="var(--border)"
                      strokeDasharray="2 4"
                    />
                  ))}

                  {/* Area */}
                  <path d={area} fill="url(#areaFill)" className="animate-area" />

                  {/* Line */}
                  <path
                    d={path}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-draw"
                  />

                  {/* Hover crosshair */}
                  {hoverIdx != null && (
                    <line
                      x1={points[hoverIdx].x}
                      x2={points[hoverIdx].x}
                      y1={padY}
                      y2={height - padY}
                      stroke="var(--border-strong)"
                      strokeDasharray="2 3"
                    />
                  )}

                  {/* Active dot */}
                  <circle
                    cx={active.x}
                    cy={active.y}
                    r="4"
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth="2"
                  />
                  {hoverIdx == null && (
                    <circle
                      cx={active.x}
                      cy={active.y}
                      r="8"
                      fill="var(--accent)"
                      opacity="0.4"
                      className="animate-pulse-dot"
                    />
                  )}

                  {/* Axis labels */}
                  <text
                    x={padX}
                    y={height - 4}
                    className="fill-[var(--subtle)]"
                    fontSize="9"
                  >
                    day 1
                  </text>
                  <text
                    x={width - padX}
                    y={height - 4}
                    textAnchor="end"
                    className="fill-[var(--subtle)]"
                    fontSize="9"
                  >
                    day 30
                  </text>
                  <text
                    x={padX}
                    y={padY - 6}
                    className="fill-[var(--subtle)]"
                    fontSize="9"
                  >
                    ₹{maxV}L
                  </text>
                  <text
                    x={padX}
                    y={height - padY - 4}
                    className="fill-[var(--subtle)]"
                    fontSize="9"
                  >
                    ₹{minV}L
                  </text>
                </svg>

                {/* KPI row below chart */}
                <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-md border hairline bg-[var(--border)]">
                  <div className="bg-[var(--surface)] px-2 py-1.5">
                    <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
                      Pitching
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold tabular">7</p>
                  </div>
                  <div className="bg-[var(--surface)] px-2 py-1.5">
                    <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
                      Approved
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold tabular text-[var(--accent)]">
                      4
                    </p>
                  </div>
                  <div className="bg-[var(--surface)] px-2 py-1.5">
                    <p className="text-[8px] font-medium uppercase tracking-[0.12em] text-[var(--subtle)]">
                      Pending
                    </p>
                    <p className="mt-0.5 text-[13px] font-semibold tabular">2</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Laptop base */}
        <div className="relative mx-auto h-3 max-w-[110%] rounded-b-[24px] bg-gradient-to-b from-[var(--border-strong)] to-[var(--border)]">
          <div className="absolute left-1/2 top-0 h-1.5 w-24 -translate-x-1/2 rounded-b-lg bg-[var(--border)]" />
        </div>
        <div className="mx-auto h-1 w-[92%] rounded-b-2xl bg-[var(--border)]/60" />
      </div>
    </div>
  );
}
