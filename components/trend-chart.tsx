"use client";

import { useState, useMemo, useRef, useEffect } from "react";

interface TrendDataPoint {
  date: string;
  value: number;
}

export function TrendChart({
  data,
  height = 240,
}: {
  data: TrendDataPoint[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const padding = { t: 18, r: 16, b: 28, l: 44 };
  const [w, setW] = useState(800);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(e.contentRect.width);
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  const maxV = useMemo(
    () => Math.max(...data.map((d) => d.value), 0.01) * 1.15,
    [data]
  );

  if (data.length === 0) {
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6E6E76",
          fontSize: 12,
          fontFamily: "JetBrains Mono",
          letterSpacing: "0.1em",
        }}
      >
        NO USAGE DATA
      </div>
    );
  }

  const innerW = Math.max(0, w - padding.l - padding.r);
  const innerH = height - padding.t - padding.b;

  const xAt = (i: number) => padding.l + (i / Math.max(data.length - 1, 1)) * innerW;
  const yAt = (v: number) =>
    padding.t + innerH - (v / maxV) * innerH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(d.value)}`)
    .join(" ");
  const areaPath = `${linePath} L${xAt(data.length - 1)},${padding.t + innerH} L${xAt(0)},${padding.t + innerH} Z`;

  const yTicks = 4;
  const ticks = Array.from(
    { length: yTicks + 1 },
    (_, i) => (maxV / yTicks) * i
  );

  const onMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < padding.l || x > padding.l + innerW) {
      setHover(null);
      return;
    }
    const ratio = (x - padding.l) / innerW;
    const idx = Math.round(ratio * (data.length - 1));
    setHover(idx);
  };

  return (
    <div
      ref={ref}
      style={{ position: "relative", width: "100%" }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg width={w} height={height} style={{ display: "block" }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FFB020" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFB020" stopOpacity="0" />
          </linearGradient>
          <pattern
            id="gridDots"
            x="0"
            y="0"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.6" fill="#26262A" />
          </pattern>
        </defs>

        {/* grid bg */}
        <rect
          x={padding.l}
          y={padding.t}
          width={innerW}
          height={innerH}
          fill="url(#gridDots)"
          opacity="0.4"
        />

        {/* y grid + labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.l}
              x2={padding.l + innerW}
              y1={yAt(t)}
              y2={yAt(t)}
              stroke="#1d1d22"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "0" : "2 4"}
            />
            <text
              x={padding.l - 8}
              y={yAt(t) + 3}
              textAnchor="end"
              fontSize="10"
              fontFamily="JetBrains Mono"
              fill="#6E6E76"
              letterSpacing="0.05em"
            >
              ${t.toFixed(0)}
            </text>
          </g>
        ))}

        {/* x labels — every 5 days */}
        {data.map((d, i) =>
          i % 5 === 0 || i === data.length - 1 ? (
            <text
              key={`x-${i}`}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fontFamily="JetBrains Mono"
              fill="#6E6E76"
              letterSpacing="0.08em"
            >
              {d.date}
            </text>
          ) : null
        )}

        {/* budget guideline */}
        <line
          x1={padding.l}
          x2={padding.l + innerW}
          y1={yAt(16.67)}
          y2={yAt(16.67)}
          stroke="#FFB020"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.45"
        />
        <text
          x={padding.l + innerW - 4}
          y={yAt(16.67) - 6}
          textAnchor="end"
          fontSize="9.5"
          fontFamily="JetBrains Mono"
          fill="#FFB020"
          letterSpacing="0.1em"
        >
          DAILY BUDGET / $16.67
        </text>

        {/* area + line */}
        <path d={areaPath} fill="url(#trendFill)" />
        <path
          d={linePath}
          fill="none"
          stroke="#FFB020"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* hover crosshair */}
        {hover != null && (
          <g>
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={padding.t}
              y2={padding.t + innerH}
              stroke="#E5E5E7"
              strokeWidth="1"
              strokeDasharray="2 3"
              opacity="0.4"
            />
            <circle
              cx={xAt(hover)}
              cy={yAt(data[hover].value)}
              r="4"
              fill="#0A0A0B"
              stroke="#FFB020"
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* end marker */}
        <circle
          cx={xAt(data.length - 1)}
          cy={yAt(data[data.length - 1].value)}
          r="3.5"
          fill="#FFB020"
        />
        <circle
          cx={xAt(data.length - 1)}
          cy={yAt(data[data.length - 1].value)}
          r="3.5"
          fill="none"
          stroke="#FFB020"
          opacity="0.4"
        >
          <animate
            attributeName="r"
            from="3.5"
            to="10"
            dur="1.6s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            from="0.5"
            to="0"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </circle>
      </svg>

      {hover != null && (
        <div
          style={{
            position: "absolute",
            left: Math.min(xAt(hover) + 10, w - 160),
            top: padding.t + 4,
            background: "var(--bg-elev-1)",
            border: "1px solid var(--border-strong)",
            borderRadius: 6,
            padding: "8px 10px",
            pointerEvents: "none",
            minWidth: 140,
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 9.5,
              color: "var(--fg-faint)",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              marginBottom: 4,
            }}
          >
            {data[hover].date} · 2026
          </div>
          <div
            className="mono tabular"
            style={{ fontSize: 18, color: "var(--amber)", fontWeight: 500 }}
          >
            ${data[hover].value.toFixed(2)}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 4,
              fontSize: 10,
            }}
            className="mono"
          >
            <span style={{ color: "var(--fg-mute)" }}>vs avg</span>
            <span
              style={{
                color: data[hover].value > 12 ? "var(--red)" : "var(--green)",
              }}
            >
              {data[hover].value > 12 ? "+" : ""}
              {(((data[hover].value - 12) / 12) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
