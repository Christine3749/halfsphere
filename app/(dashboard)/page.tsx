"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardHeader,
  CardLabel,
  Badge,
  AnimatedNumber,
  Sparkline,
  SegmentedProgress,
  CornerMarks,
} from "@/components/primitives";
import { TrendChart } from "@/components/trend-chart";
import { BaseCard } from "./components/base-card";
import { useAuth } from "@/hooks/use-auth";

/* ── types ── */
interface UsageData {
  range: string;
  start_date: string;
  end_date: string;
  summary: {
    total_cost: number;
    total_input_tokens: number;
    total_output_tokens: number;
    count: number;
  };
  data: Record<string, { cost: number; input_tokens: number; output_tokens: number }>;
}

interface ProviderRow {
  id: string;
  name: string;
  display_name: string;
}

interface BudgetCfg {
  monthly_limit_usd: number;
  warn_threshold: number;
  alert_threshold: number;
}

/* ── helpers ── */
const fmtUSD = (n: number) => `$${n.toFixed(2)}`;

const ACTIVITY = [
  { t: "04m", code: "SYNC.OPENAI", msg: "完整同步 · 24 条新快照", tone: "green" as const },
  { t: "12m", code: "BURN.SPIKE", msg: "claude-sonnet-4.5 单次 $4.20 (>P95)", tone: "amber" as const },
  { t: "38m", code: "SYNC.ANTHROPIC", msg: "完整同步 · 9 条新快照", tone: "green" as const },
  { t: "1h", code: "BUDGET.WARN", msg: "日预算消耗 84% — 阈值 80%", tone: "amber" as const },
  { t: "3h", code: "PROVIDER.ADD", msg: "openrouter 已绑定 (sk-or…7f2a)", tone: "green" as const },
];

/* ════════════════════════════════════════ */
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  /* data hooks */
  const { data: usage } = useQuery<UsageData>({
    queryKey: ["usage", "30d"],
    queryFn: async () => {
      const res = await fetch("/api/usage?range=30d&group_by=date");
      if (!res.ok) throw new Error("获取 usage 失败");
      return res.json();
    },
  });

  const { data: providersData } = useQuery<{ data: ProviderRow[] }>({
    queryKey: ["providers"],
    queryFn: async () => {
      const res = await fetch("/api/providers");
      if (!res.ok) throw new Error("获取 providers 失败");
      return res.json();
    },
  });

  const { data: budget } = useQuery<{ data: BudgetCfg[] }>({
    queryKey: ["budget"],
    queryFn: async () => {
      const res = await fetch("/api/budget");
      if (!res.ok) throw new Error("获取预算失败");
      return res.json();
    },
  });

  const { data: usageByProvider } = useQuery<UsageData>({
    queryKey: ["usage", "30d", "provider"],
    queryFn: async () => {
      const res = await fetch("/api/usage?range=30d&group_by=provider");
      if (!res.ok) throw new Error("获取 provider usage 失败");
      return res.json();
    },
  });

  const trendData = useMemo(() => {
    if (!usage?.data) return [];
    return Object.entries(usage.data)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateStr, { cost }]) => {
        const d = new Date(dateStr + "T00:00:00Z");
        return { date: `${d.getMonth() + 1}/${d.getDate()}`, value: cost };
      });
  }, [usage]);

  const trendDelta = useMemo(() => {
    if (trendData.length < 10) return null;
    const half = Math.floor(trendData.length / 2);
    const first = trendData.slice(0, half).reduce((s, d) => s + d.value, 0);
    const last = trendData.slice(half).reduce((s, d) => s + d.value, 0);
    if (first === 0) return null;
    return ((last - first) / first) * 100;
  }, [trendData]);

  const totalCost = usage?.summary.total_cost ?? 0;
  const budgetCfg = budget?.data?.[0];
  const limit = budgetCfg?.monthly_limit_usd ?? 500;
  const used = totalCost;

  const providerList = providersData?.data ?? [];
  const { user } = useAuth();
  const isGuest = !user;

  if (!mounted) return null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", zIndex: 1 }}>
      <StatusBar isGuest={isGuest} />
      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          overflowY: "auto",
        }}
      >
        {/* heading */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <div
              className="mono"
              style={{
                fontSize: 10.5,
                color: "var(--fg-faint)",
                letterSpacing: "0.22em",
                marginBottom: 6,
              }}
            >
              MISSION CONTROL · BURNING
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                color: "var(--fg)",
              }}
            >
              {new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long" })} · 燃烧总览
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["7D", "30D", "90D", "MTD", "ALL"].map((l, i) => (
              <RangePill key={l} label={l} active={i === 1} />
            ))}
          </div>
        </div>

        {/* row 1: hero + budget */}
        <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 18 }}>
          <HeroPanel totalCost={totalCost} inputTokens={usage?.summary.total_input_tokens ?? 0} outputTokens={usage?.summary.total_output_tokens ?? 0} trendDelta={trendDelta} days={trendData.length} />
          <BudgetPanel used={used} limit={limit} warn={budgetCfg?.warn_threshold ?? 80} alert={budgetCfg?.alert_threshold ?? 95} />
        </div>

        {/* row 2: providers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          {providerList.length > 0 ? (
            providerList.map((p) => {
              const u = usageByProvider?.data?.[p.name];
              return (
                <ProviderCard
                  key={p.id}
                  name={p.display_name}
                  code={p.name}
                  spend={u?.cost ?? 0}
                  status={u ? "online" : "unlinked"}
                />
              );
            })
          ) : (
            <NoProviderCard />
          )}
        </div>

        {/* row 3: base + trend + activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1.65fr 1fr", gap: 18 }}>
          <Card>
            <CardHeader>
              <CardLabel badge={<Badge tone="amber">USD / DAY</Badge>}>30 天消耗趋势 / Burn trajectory</CardLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }} className="mono">
                <LegendDot color="var(--amber)" label="实际" />
                <LegendDot color="var(--amber)" dashed label="日预算" />
              </div>
            </CardHeader>
            <div style={{ padding: "10px 8px 8px" }}>
              <TrendChart data={trendData} height={240} />
            </div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <BaseCard />
            <ActivityFeed />
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "8px 0 20px",
            borderTop: "1px solid var(--border)",
            marginTop: 4,
          }}
        >
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.18em" }}
          >
            穹弯 · BURNING / 01 · INTERNAL OPS
          </span>
          <span
            className="mono"
            style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.18em" }}
          >
            DATA · 30D ROLLING · NEXT SYNC SOON
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── StatusBar ── */
function StatusBar({ isGuest }: { isGuest: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        padding: "10px 28px",
        borderBottom: "1px solid var(--border)",
        background: "rgba(10,10,11,0.7)",
        backdropFilter: "blur(8px)",
        fontSize: 11,
        height: 38,
      }}
      className="mono"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-faint)", letterSpacing: "0.18em" }}>MODULE</span>
        <span style={{ color: "var(--amber)", letterSpacing: "0.1em" }}>01 / BURNING</span>
      </div>
      <Divider />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-faint)", letterSpacing: "0.18em" }}>CYCLE</span>
        <span style={{ color: "var(--fg-dim)" }}>{new Date().toISOString().slice(0, 7)}</span>
        <span style={{ color: "var(--fg-faint)" }}>·</span>
        <span style={{ color: "var(--fg-dim)" }}>DAY {new Date().getDate()} / 31</span>
      </div>
      <Divider />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--fg-faint)", letterSpacing: "0.18em" }}>STREAM</span>
        <span
          className="dot green"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            display: "inline-block",
            background: "var(--green)",
            boxShadow: "0 0 0 3px var(--green-dim)",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: -4,
              borderRadius: 999,
              background: "var(--green)",
              opacity: 0.5,
              animation: "pulse-ring 1.8s ease-out infinite",
            }}
          />
        </span>
        <span style={{ color: "var(--green)", letterSpacing: "0.1em" }}>LIVE</span>
      </div>
      <div style={{ flex: 1 }} />

      {isGuest ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a
            href="/login"
            className="mono"
            style={{
              background: "var(--amber-dim)",
              border: "1px solid var(--amber-line)",
              color: "var(--amber)",
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "6px 14px",
              borderRadius: 4,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            sign in
          </a>
          <a
            href="/apply"
            className="mono"
            style={{
              background: "transparent",
              border: "1px solid var(--border-strong)",
              color: "var(--fg-dim)",
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "6px 14px",
              borderRadius: 4,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            apply
          </a>
        </div>
      ) : (
        <button
          className="mono"
          style={{
            background: "transparent",
            border: "1px solid var(--border-strong)",
            color: "var(--fg-dim)",
            fontSize: 10.5,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            padding: "6px 12px",
            borderRadius: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
          }}
          onClick={async () => {
            await fetch("/api/usage/sync", { method: "POST" });
            window.location.reload();
          }}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 3v3h-3" />
          </svg>
          sync now
        </button>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 14, background: "var(--border)" }} />;
}

/* ── HeroPanel ── */
function HeroPanel({ totalCost, inputTokens, outputTokens, trendDelta, days }: { totalCost: number; inputTokens: number; outputTokens: number; trendDelta?: number | null; days: number }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", minHeight: 220 }}>
        <div style={{ padding: "26px 30px", borderRight: "1px solid var(--border)", position: "relative" }}>
          <CornerMarks />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span
              className="mono"
              style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.18em", textTransform: "uppercase" }}
            >
              月度总消耗 · Month-To-Date Burn
            </span>
            <Badge tone="amber">USD</Badge>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
            <span
              className="mono tabular"
              style={{ fontSize: 64, fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.04em", lineHeight: 0.95 }}
            >
              <span style={{ color: "var(--fg-faint)" }}>$</span>
              <AnimatedNumber value={totalCost} format={(v) => v.toFixed(2)} />
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {trendDelta !== null && trendDelta !== undefined && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d={trendDelta >= 0 ? "M5 1 L9 6 L1 6 Z" : "M5 9 L9 4 L1 4 Z"} fill={trendDelta >= 0 ? "var(--red)" : "var(--green)"} />
                  </svg>
                  <span className="mono tabular" style={{ fontSize: 12, color: trendDelta >= 0 ? "var(--red)" : "var(--green)" }}>
                    {trendDelta > 0 ? "+" : ""}{trendDelta.toFixed(1)}%
                  </span>
                  <span className="mono" style={{ fontSize: 11, color: "var(--fg-mute)" }}>趋势</span>
                </div>
                <Divider />
              </>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--fg-mute)" }}>日均</span>
              <span className="mono tabular" style={{ fontSize: 12, color: "var(--fg)" }}>
                ${totalCost > 0 && days > 0 ? (totalCost / days).toFixed(2) : "0.00"}
              </span>
            </div>
          </div>

          <div style={{ position: "absolute", bottom: 22, left: 30, right: 30, display: "flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 9.5, color: "var(--fg-faint)", letterSpacing: "0.18em", textTransform: "uppercase" }}>
              BURN PULSE / 24H
            </span>
            <BurnPulseBar />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "1fr 1fr" }}>
          <SubStat label="TOTAL TOKENS · IN" value={inputTokens > 0 ? (inputTokens / 1e6).toFixed(2) + "M" : "0"} />
          <SubStat label="TOTAL TOKENS · OUT" value={outputTokens > 0 ? (outputTokens / 1e6).toFixed(2) + "M" : "0"} sep />
        </div>
      </div>
    </Card>
  );
}

function SubStat({ label, value, delta, sep }: { label: string; value: string; delta?: string; sep?: boolean }) {
  return (
    <div style={{ padding: "20px 24px", borderTop: sep ? "1px solid var(--border)" : "none", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="mono" style={{ fontSize: 10, color: "var(--fg-mute)", letterSpacing: "0.18em" }}>{label}</span>
        {delta && <span className="mono tabular" style={{ fontSize: 11, color: "var(--green)" }}>{delta}</span>}
      </div>
      <div className="mono tabular" style={{ fontSize: 30, color: "var(--fg)", fontWeight: 500, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <Sparkline data={[2, 3, 2, 4, 5, 4, 6, 5, 7, 6, 8, 9, 8, 10]} width={220} height={32} color="var(--fg-dim)" />
    </div>
  );
}

function BurnPulseBar() {
  const bars = [2, 3, 2, 4, 5, 3, 6, 5, 7, 8, 6, 9, 7, 8, 10, 9, 11, 8, 10, 12, 9, 11, 13, 15];
  const max = Math.max(...bars);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 22, flex: 1 }}>
      {bars.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: i === bars.length - 1 ? "var(--amber)" : "var(--border-strong)",
            opacity: i === bars.length - 1 ? 1 : 0.7,
            borderRadius: 1,
          }}
        />
      ))}
    </div>
  );
}

/* ── BudgetPanel ── */
function BudgetPanel({ used, limit, warn, alert }: { used: number; limit: number; warn: number; alert: number }) {
  const ratio = limit > 0 ? used / limit : 0;
  return (
    <Card>
      <CardHeader>
        <CardLabel badge={<Badge tone="amber">{Math.round(ratio * 100)}% USED</Badge>}>预算 / Monthly budget</CardLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)" }}>
            <span style={{ color: "var(--amber)" }}>●</span> warn {warn}%
          </span>
          <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)" }}>
            <span style={{ color: "var(--red)" }}>●</span> alert {alert}%
          </span>
        </div>
      </CardHeader>
      <div style={{ padding: "20px 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span className="mono tabular" style={{ fontSize: 26, fontWeight: 500, color: "var(--fg)", letterSpacing: "-0.02em" }}>
              {fmtUSD(used)}
            </span>
            <span className="mono" style={{ fontSize: 14, color: "var(--fg-faint)" }}>/ {fmtUSD(limit)}</span>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.14em", textTransform: "uppercase" }}>剩余</span>
            <span className="mono tabular" style={{ fontSize: 14, color: "var(--fg-dim)" }}>{fmtUSD(Math.max(0, limit - used))}</span>
          </div>
        </div>

        <SegmentedProgress value={used} max={limit} segments={68} warn={warn / 100} danger={alert / 100} />

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }} className="mono">
          <span style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.12em" }}>$0</span>
          <span style={{ fontSize: 10, color: "var(--amber)", letterSpacing: "0.12em" }}>WARN · ${(limit * (warn / 100)).toFixed(0)}</span>
          <span style={{ fontSize: 10, color: "var(--red)", letterSpacing: "0.12em" }}>ALERT · ${(limit * (alert / 100)).toFixed(0)}</span>
          <span style={{ fontSize: 10, color: "var(--fg-faint)", letterSpacing: "0.12em" }}>{fmtUSD(limit)}</span>
        </div>
      </div>
    </Card>
  );
}

/* ── ProviderCard ── */
function ProviderCard({ name, code, spend, status }: { name: string; code: string; spend: number; status: string }) {
  const empty = spend === 0;
  return (
    <Card style={{ padding: 0, position: "relative", opacity: empty ? 0.6 : 1 }}>
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-elev-1)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ProviderLogo which={code} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontSize: 13.5, fontWeight: 500 }}>{name}</span>
              <span className="mono" style={{ fontSize: 10, color: "var(--fg-mute)", letterSpacing: "0.08em", marginTop: 3 }}>{code}</span>
            </div>
          </div>
          {status === "online" && <Badge tone="green">● ONLINE</Badge>}
          {status === "idle" && <Badge tone="neutral">● IDLE</Badge>}
          {status === "unlinked" && <Badge tone="ghost">UNLINKED</Badge>}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
          <span className="mono tabular" style={{ fontSize: 26, fontWeight: 500, color: empty ? "var(--fg-faint)" : "var(--fg)", letterSpacing: "-0.02em" }}>
            <span style={{ color: "var(--fg-faint)" }}>$</span>{spend.toFixed(2)}
          </span>
          {!empty && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M5 1 L9 6 L1 6 Z" fill="var(--amber)" />
              </svg>
              <span className="mono tabular" style={{ fontSize: 11, color: "var(--amber)" }}>+8%</span>
            </div>
          )}
        </div>

        {empty && (
          <button
            style={{
              marginTop: 12,
              width: "100%",
              padding: "8px 0",
              background: "transparent",
              border: "1px dashed var(--border-strong)",
              borderRadius: 6,
              color: "var(--fg-mute)",
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            + 绑定 API key
          </button>
        )}
      </div>
    </Card>
  );
}

function NoProviderCard() {
  return (
    <Card style={{ padding: "30px 18px", gridColumn: "1 / -1", textAlign: "center" }}>
      <span className="mono" style={{ fontSize: 12, color: "var(--fg-mute)" }}>NO PROVIDERS CONFIGURED</span>
      <p style={{ fontSize: 13, color: "var(--fg-dim)", marginTop: 8 }}>
        前往 <a href="/settings" style={{ color: "var(--amber)", textDecoration: "none" }}>设置</a> 添加 Provider
      </p>
    </Card>
  );
}

function ProviderLogo({ which }: { which: string }) {
  const map: Record<string, React.ReactNode> = {
    openai: (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="10" fill="none" stroke="var(--green)" strokeWidth="1.4" />
        <path d="M8 12h8M12 8v8" stroke="var(--green)" strokeWidth="1.4" />
      </svg>
    ),
    anthropic: (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M8 18l4-12 4 12M9 14h6" fill="none" stroke="var(--amber)" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
    gemini: (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <path d="M12 3l3 6 6 3-6 3-3 6-3-6-6-3 6-3 3-6Z" fill="none" stroke="var(--fg-mute)" strokeWidth="1.3" />
      </svg>
    ),
    deepseek: (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--fg-faint)" strokeWidth="1.3" strokeDasharray="2 3" />
      </svg>
    ),
    openrouter: (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="12" cy="12" r="9" fill="none" stroke="var(--fg-faint)" strokeWidth="1.3" />
        <path d="M8 12h8M12 8v8" stroke="var(--fg-faint)" strokeWidth="1.3" />
      </svg>
    ),
  };
  return <>{map[which] ?? map["openrouter"]}</>;
}

/* ── ActivityFeed ── */
function ActivityFeed() {
  return (
    <Card style={{ display: "flex", flexDirection: "column" }}>
      <CardHeader>
        <CardLabel badge={<Badge tone="green">LIVE</Badge>}>活动日志 / Activity</CardLabel>
        <span className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)" }}>last 6h</span>
      </CardHeader>
      <div style={{ padding: "8px 0" }}>
        {ACTIVITY.map((a, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 18px",
              borderTop: i === 0 ? "none" : "1px solid rgba(38,38,42,0.5)",
            }}
          >
            <span
              className="dot"
              style={{
                marginTop: 6,
                width: 6,
                height: 6,
                borderRadius: 999,
                display: "inline-block",
                background: a.tone === "amber" ? "var(--amber)" : "var(--green)",
                boxShadow: a.tone === "amber" ? "0 0 0 3px var(--amber-dim)" : "0 0 0 3px var(--green-dim)",
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 2 }}>
                <span className="mono" style={{ fontSize: 10, color: a.tone === "amber" ? "var(--amber)" : "var(--green)", letterSpacing: "0.1em", fontWeight: 500 }}>{a.code}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--fg-faint)" }}>−{a.t}</span>
              </div>
              <div style={{ fontSize: 12, color: "var(--fg-dim)" }}>{a.msg}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── small bits ── */
function LegendDot({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 14, height: 2, background: dashed ? "transparent" : color, borderTop: dashed ? `1.5px dashed ${color}` : "none" }} />
      <span style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.08em" }}>{label}</span>
    </div>
  );
}

function RangePill({ label, active }: { label: string; active?: boolean }) {
  return (
    <button
      className="mono"
      style={{
        background: active ? "var(--amber-dim)" : "transparent",
        border: `1px solid ${active ? "var(--amber-line)" : "var(--border)"}`,
        color: active ? "var(--amber)" : "var(--fg-mute)",
        fontSize: 11,
        letterSpacing: "0.12em",
        padding: "5px 12px",
        borderRadius: 4,
        fontWeight: 500,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}


