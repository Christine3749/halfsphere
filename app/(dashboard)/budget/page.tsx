"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardHeader, CardLabel, Badge, SegmentedProgress } from "@/components/primitives";

interface Budget {
  id?: string;
  monthly_limit_usd: number;
  warn_threshold: number;
  alert_threshold: number;
  email_alerts: boolean;
  telegram_chat_id: string | null;
}

interface BudgetResponse {
  data: Budget[];
}

interface SaveBudgetResponse {
  data: Budget;
}

const DEFAULT_BUDGET: Budget = {
  monthly_limit_usd: 500,
  warn_threshold: 80,
  alert_threshold: 95,
  email_alerts: true,
  telegram_chat_id: "",
};

export default function BudgetPage() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Budget | null>(null);

  const { data, isLoading } = useQuery<BudgetResponse>({
    queryKey: ["budget"],
    queryFn: async () => {
      const res = await fetch("/api/budget");
      if (!res.ok) throw new Error("获取预算失败");
      return res.json();
    },
  });

  const savedBudget = data?.data?.[0];
  const form = draft ?? (savedBudget ? {
    monthly_limit_usd: savedBudget.monthly_limit_usd,
    warn_threshold: savedBudget.warn_threshold,
    alert_threshold: savedBudget.alert_threshold,
    email_alerts: savedBudget.email_alerts,
    telegram_chat_id: savedBudget.telegram_chat_id || "",
  } : DEFAULT_BUDGET);

  const saveMutation = useMutation<SaveBudgetResponse, Error, Budget>({
    mutationFn: async (payload: Budget) => {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "保存失败");
      }
      return res.json();
    },
    onSuccess: (response) => {
      queryClient.setQueryData<BudgetResponse>(["budget"], { data: [response.data] });
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: ["budget"] });
    },
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate(form);
  }

  if (isLoading) {
    return (
      <div style={{ padding: "24px 28px" }}>
        <div className="mono" style={{ color: "var(--fg-mute)", fontSize: 12 }}>加载中...</div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.22em", marginBottom: 6 }}>
          CONTROLS · BUDGET
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--fg)" }}>
          预算
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardLabel badge={<Badge tone="amber">CONFIG</Badge>}>预算配置 / Budget config</CardLabel>
        </CardHeader>
        <form onSubmit={handleSave} style={{ padding: "20px 18px", display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 月度上限 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                月度上限（美元）
              </label>
              <span className="mono tabular" style={{ fontSize: 20, color: "var(--amber)", fontWeight: 500 }}>
                ${form.monthly_limit_usd}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={2000}
              step={10}
              value={form.monthly_limit_usd}
              onChange={(e) => setDraft({ ...form, monthly_limit_usd: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--amber)" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between" }} className="mono">
              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>$0</span>
              <span style={{ fontSize: 10, color: "var(--fg-faint)" }}>$2000</span>
            </div>
          </div>

          {/* 黄色警告阈值 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                黄色警告阈值
              </label>
              <span className="mono tabular" style={{ fontSize: 16, color: "var(--amber)", fontWeight: 500 }}>
                {form.warn_threshold}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={form.warn_threshold}
              onChange={(e) => setDraft({ ...form, warn_threshold: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--amber)" }}
            />
            <SegmentedProgress value={form.warn_threshold} max={100} segments={40} warn={0.6} danger={0.9} />
          </div>

          {/* 红色告警阈值 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <label className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                红色告警阈值
              </label>
              <span className="mono tabular" style={{ fontSize: 16, color: "var(--red)", fontWeight: 500 }}>
                {form.alert_threshold}%
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={form.alert_threshold}
              onChange={(e) => setDraft({ ...form, alert_threshold: Number(e.target.value) })}
              style={{ width: "100%", accentColor: "var(--red)" }}
            />
            <SegmentedProgress value={form.alert_threshold} max={100} segments={40} warn={0.6} danger={0.9} />
          </div>

          {/* 告警通道 */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-elev-1)", padding: 16 }}>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-mute)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
              告警通道 / Alert channels
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: "var(--fg)" }}>邮件告警</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--fg-mute)" }}>发送告警到注册邮箱</div>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: 40, height: 22 }}>
                <input
                  type="checkbox"
                  checked={form.email_alerts}
                  onChange={(e) => setDraft({ ...form, email_alerts: e.target.checked })}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: "absolute",
                    cursor: "pointer",
                    inset: 0,
                    background: form.email_alerts ? "var(--amber)" : "var(--border-strong)",
                    borderRadius: 999,
                    transition: "background .2s ease",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      height: 16,
                      width: 16,
                      left: form.email_alerts ? 20 : 3,
                      bottom: 3,
                      background: "var(--fg)",
                      borderRadius: 999,
                      transition: "left .2s ease",
                    }}
                  />
                </span>
              </label>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label className="mono" style={{ fontSize: 10, color: "var(--fg-mute)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Telegram Chat ID（可选）
              </label>
              <input
                value={form.telegram_chat_id || ""}
                onChange={(e) => setDraft({ ...form, telegram_chat_id: e.target.value })}
                placeholder="例如：123456789"
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "var(--fg)",
                  fontSize: 13,
                }}
              />
            </div>
          </div>

          {saveMutation.isError && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--red)" }}>
              {saveMutation.error instanceof Error ? saveMutation.error.message : "保存失败"}
            </p>
          )}
          {saveMutation.isSuccess && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--green)" }}>保存成功</p>
          )}

          <button
            type="submit"
            disabled={saveMutation.isPending}
            style={{
              background: "var(--amber)",
              border: "1px solid var(--amber)",
              color: "#0A0A0B",
              borderRadius: 6,
              padding: "11px 0",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: saveMutation.isPending ? "not-allowed" : "pointer",
              opacity: saveMutation.isPending ? 0.7 : 1,
              width: "fit-content",
              paddingLeft: 24,
              paddingRight: 24,
            }}
          >
            {saveMutation.isPending ? "保存中..." : "保存预算配置"}
          </button>
        </form>
      </Card>
    </div>
  );
}
