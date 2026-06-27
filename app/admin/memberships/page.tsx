"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Boxes, KeyRound, RefreshCw, Save, ShieldCheck, Ticket } from "lucide-react";
import { Badge, Card, CardHeader, CardLabel, CornerMarks } from "@/components/primitives";

type Product = { id: string; code: string; name: string; public_name: string; description: string; is_active: boolean; sort_order: number };
type Plan = { id: string; product_code: string; code: string; name: string; description: string; price_cents: number; currency: string; billing_interval: string; features: Record<string, unknown>; is_active: boolean; sort_order: number };
type Subscription = { id: string; user_id: string; user_email: string; user_display_name: string; product_code: string; product_name: string; plan_id: string | null; plan_code: string; plan_name: string; status: string; current_period_end: string | null; updated_at: string };
type MemberEvent = { id: string; user_id: string | null; product_code: string | null; plan_code: string | null; event_type: string; detail: Record<string, unknown>; created_at: string };
type UserRow = { id: string; email: string; display_name: string };
type MembershipData = { products: Product[]; plans: Plan[]; subscriptions: Subscription[]; events: MemberEvent[]; users: UserRow[] };

const emptyProduct = { code: "", name: "", public_name: "", description: "", sort_order: 100, is_active: true };
const emptyPlan = { product_code: "msir_prism", code: "", name: "", description: "", price_cents: 0, billing_interval: "manual", features: "{\n  \"quant_lab\": true\n}", sort_order: 100, is_active: true };
const emptyGrant = { user_id: "", plan_id: "", status: "active", current_period_end: "" };

export default function MembershipAdminPage() {
  const queryClient = useQueryClient();
  const [productForm, setProductForm] = useState(emptyProduct);
  const [planForm, setPlanForm] = useState(emptyPlan);
  const [grantForm, setGrantForm] = useState(emptyGrant);

  const { data, isLoading, isError, refetch } = useQuery<{ data: MembershipData }>({
    queryKey: ["admin-memberships"],
    queryFn: async () => {
      const response = await fetch("/api/admin/memberships");
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "会员体系读取失败");
      return json;
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ intent, payload }: { intent: string; payload: Record<string, unknown> }) => {
      const response = await fetch("/api/admin/memberships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, payload }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.detail || json.error || "操作失败");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-memberships"] }),
  });

  const products = data?.data.products ?? [];
  const plans = useMemo(() => data?.data.plans ?? [], [data?.data.plans]);
  const subscriptions = data?.data.subscriptions ?? [];
  const users = data?.data.users ?? [];
  const events = data?.data.events ?? [];
  const planOptions = useMemo(() => plans.filter((plan) => plan.is_active), [plans]);
  const activeSubscriptions = subscriptions.filter((item) => ["active", "trialing"].includes(item.status));
  const selectedGrantPlanId = grantForm.plan_id || planOptions[0]?.id || "";

  function submitProduct(event: React.FormEvent) {
    event.preventDefault();
    mutation.mutate({ intent: "upsert_product", payload: productForm });
  }

  function submitPlan(event: React.FormEvent) {
    event.preventDefault();
    mutation.mutate({ intent: "upsert_plan", payload: planForm });
  }

  function submitGrant(event: React.FormEvent) {
    event.preventDefault();
    mutation.mutate({ intent: "upsert_subscription", payload: { ...grantForm, plan_id: selectedGrantPlanId } });
  }

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div className="mono" style={eyebrowStyle}>ADMIN · MEMBERSHIP CONTROL</div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 500, letterSpacing: "-0.01em", color: "var(--fg)" }}>穹弯会员体系</h1>
        </div>
        <button onClick={() => refetch()} style={ghostButtonStyle}><RefreshCw style={{ width: 12, height: 12 }} />refresh</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
        <MetricCard icon={Boxes} label="Products" value={products.length} tone="amber" />
        <MetricCard icon={Ticket} label="Plans" value={plans.length} tone="neutral" />
        <MetricCard icon={ShieldCheck} label="Active Grants" value={activeSubscriptions.length} tone="green" />
        <MetricCard icon={Activity} label="Events" value={events.length} tone="neutral" />
      </div>

      {isError && <Card style={{ padding: "14px 18px", borderColor: "rgba(239,68,68,0.3)" }}><span style={{ color: "var(--red)", fontSize: 13 }}>会员体系读取失败。请确认 Supabase 已执行 hs_membership migration。</span></Card>}

      <Card style={{ position: "relative", overflow: "hidden" }}>
        <CornerMarks />
        <CardHeader>
          <CardLabel badge={<Badge tone="amber">MATRIX</Badge>}>产品通行矩阵 / Product access</CardLabel>
          <span className="mono" style={smallMuted}>HS_PRODUCTS</span>
        </CardHeader>
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 12 }}>
          {isLoading ? <span className="mono" style={smallMuted}>LOADING PRODUCTS</span> : products.map((product) => {
            const productPlans = plans.filter((plan) => plan.product_code === product.code);
            const productSubs = subscriptions.filter((item) => item.product_code === product.code && ["active", "trialing"].includes(item.status));
            return (
              <div key={product.code} style={panelStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                  <div><div style={{ fontSize: 14, color: "var(--fg)", fontWeight: 500 }}>{product.name}</div><div className="mono" style={codeStyle}>{product.code}</div></div>
                  <Badge tone={product.is_active ? "green" : "ghost"}>{product.is_active ? "ACTIVE" : "OFF"}</Badge>
                </div>
                <p style={{ margin: "12px 0", color: "var(--fg-mute)", fontSize: 12, minHeight: 34 }}>{product.description || product.public_name}</p>
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", color: "var(--fg-dim)", fontSize: 10.5 }}><span>{productPlans.length} PLANS</span><span>{productSubs.length} GRANTS</span></div>
              </div>
            );
          })}
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <Card>
          <CardHeader><CardLabel badge={<Badge tone="amber">UPSERT</Badge>}>产品注册 / Product registry</CardLabel><KeyRound style={{ width: 15, height: 15, color: "var(--amber)" }} /></CardHeader>
          <form onSubmit={submitProduct} style={formStyle}>
            <div style={twoColStyle}>
              <Field label="code"><input value={productForm.code} onChange={(e) => setProductForm({ ...productForm, code: e.target.value })} placeholder="msir_prism" style={inputStyle} /></Field>
              <Field label="name"><input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="MSIR Prism" style={inputStyle} /></Field>
            </div>
            <Field label="public name"><input value={productForm.public_name} onChange={(e) => setProductForm({ ...productForm, public_name: e.target.value })} placeholder="用户侧显示名称" style={inputStyle} /></Field>
            <Field label="description"><textarea value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} rows={3} style={textAreaStyle} /></Field>
            <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
              <Toggle label="active" checked={productForm.is_active} onChange={(checked) => setProductForm({ ...productForm, is_active: checked })} />
              <button type="submit" disabled={mutation.isPending} style={primaryButtonStyle}><Save style={{ width: 12, height: 12 }} />保存产品</button>
            </div>
          </form>
        </Card>

        <Card>
          <CardHeader><CardLabel badge={<Badge tone="amber">FEATURES</Badge>}>套餐权益 / Plan features</CardLabel><span className="mono" style={smallMuted}>JSONB</span></CardHeader>
          <form onSubmit={submitPlan} style={formStyle}>
            <div style={twoColStyle}>
              <Field label="product"><select value={planForm.product_code} onChange={(e) => setPlanForm({ ...planForm, product_code: e.target.value })} style={inputStyle}>{products.map((product) => <option key={product.code} value={product.code}>{product.code}</option>)}</select></Field>
              <Field label="plan code"><input value={planForm.code} onChange={(e) => setPlanForm({ ...planForm, code: e.target.value })} placeholder="quant_pro" style={inputStyle} /></Field>
            </div>
            <div style={twoColStyle}>
              <Field label="name"><input value={planForm.name} onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })} placeholder="Quant Pro" style={inputStyle} /></Field>
              <Field label="price cents"><input type="number" value={planForm.price_cents} onChange={(e) => setPlanForm({ ...planForm, price_cents: Number(e.target.value) })} style={inputStyle} /></Field>
            </div>
            <Field label="features json"><textarea value={planForm.features} onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })} rows={7} spellCheck={false} style={{ ...textAreaStyle, fontFamily: "var(--font-mono)", fontSize: 11 }} /></Field>
            <button type="submit" disabled={mutation.isPending} style={primaryButtonStyle}><Save style={{ width: 12, height: 12 }} />保存套餐</button>
          </form>
        </Card>
      </div>

      <Card>
        <CardHeader><CardLabel badge={<Badge tone="green">GRANT</Badge>}>授权终端 / Grant terminal</CardLabel><span className="mono" style={smallMuted}>HS_SUBSCRIPTIONS</span></CardHeader>
        <form onSubmit={submitGrant} style={{ padding: 18, display: "grid", gridTemplateColumns: "1.2fr 1.2fr .8fr .8fr auto", gap: 12, alignItems: "end" }}>
          <Field label="user"><select value={grantForm.user_id} onChange={(e) => setGrantForm({ ...grantForm, user_id: e.target.value })} style={inputStyle}><option value="">选择用户</option>{users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}</select></Field>
          <Field label="plan"><select value={selectedGrantPlanId} onChange={(e) => setGrantForm({ ...grantForm, plan_id: e.target.value })} style={inputStyle}>{planOptions.map((plan) => <option key={plan.id} value={plan.id}>{plan.product_code} / {plan.code}</option>)}</select></Field>
          <Field label="status"><select value={grantForm.status} onChange={(e) => setGrantForm({ ...grantForm, status: e.target.value })} style={inputStyle}>{["active", "trialing", "inactive", "past_due", "cancelled", "expired"].map((status) => <option key={status} value={status}>{status}</option>)}</select></Field>
          <Field label="period end"><input type="datetime-local" value={grantForm.current_period_end} onChange={(e) => setGrantForm({ ...grantForm, current_period_end: e.target.value })} style={inputStyle} /></Field>
          <button type="submit" disabled={mutation.isPending || !grantForm.user_id || !selectedGrantPlanId} style={primaryButtonStyle}>写入授权</button>
        </form>
        {mutation.isError && <p style={{ margin: "0 18px 16px", color: "var(--red)", fontSize: 12 }}>{mutation.error instanceof Error ? mutation.error.message : "操作失败"}</p>}
        {mutation.isSuccess && <p style={{ margin: "0 18px 16px", color: "var(--green)", fontSize: 12 }}>会员体系已更新</p>}
      </Card>

      <Card>
        <CardHeader><CardLabel>订阅账本 / Subscription ledger</CardLabel><Badge tone="neutral">{subscriptions.length} ROWS</Badge></CardHeader>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid var(--border)" }}>{["user", "product", "plan", "status", "period end", "updated"].map((header) => <Th key={header}>{header}</Th>)}</tr></thead>
            <tbody>
              {subscriptions.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid rgba(38,38,42,0.5)" }}>
                  <Td strong>{item.user_email}</Td>
                  <Td code>{item.product_code}</Td>
                  <Td>{item.plan_name}</Td>
                  <Td><Badge tone={statusTone(item.status)}>{item.status}</Badge></Td>
                  <Td code>{item.current_period_end ? shortDate(item.current_period_end) : "open"}</Td>
                  <Td code>{shortDate(item.updated_at)}</Td>
                </tr>
              ))}
              {subscriptions.length === 0 && <tr><td colSpan={6} style={{ padding: 18, color: "var(--fg-mute)", fontSize: 12 }}>暂无订阅授权。</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader><CardLabel>事件日志 / Membership events</CardLabel><span className="mono" style={smallMuted}>LATEST 80</span></CardHeader>
        <div style={{ padding: "6px 0" }}>
          {events.map((event) => (
            <div key={event.id} style={{ display: "grid", gridTemplateColumns: "130px 180px 1fr", gap: 12, padding: "10px 18px", borderBottom: "1px solid rgba(38,38,42,0.45)" }}>
              <span className="mono" style={codeStyle}>{shortDate(event.created_at)}</span>
              <span className="mono" style={{ color: "var(--amber)", fontSize: 10.5, letterSpacing: "0.08em" }}>{event.event_type}</span>
              <span className="mono" style={{ color: "var(--fg-dim)", fontSize: 10.5 }}>{event.product_code ?? "system"} / {event.plan_code ?? "-"}</span>
            </div>
          ))}
          {events.length === 0 && <div style={{ padding: 18, color: "var(--fg-mute)", fontSize: 12 }}>暂无事件。</div>}
        </div>
      </Card>
    </div>
  );
}
function MetricCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ style?: React.CSSProperties }>; label: string; value: number; tone: "amber" | "green" | "neutral" }) {
  return (
    <Card style={{ padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div><div className="mono" style={smallMuted}>{label}</div><div className="mono tabular" style={{ color: "var(--fg)", fontSize: 28, marginTop: 4 }}>{value}</div></div>
      <div style={{ width: 34, height: 34, borderRadius: 6, border: "1px solid var(--border)", background: "var(--bg-elev-1)", display: "flex", alignItems: "center", justifyContent: "center", color: tone === "amber" ? "var(--amber)" : tone === "green" ? "var(--green)" : "var(--fg-dim)" }}><Icon style={{ width: 17, height: 17 }} /></div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 6 }}><span className="mono" style={fieldLabelStyle}>{label}</span>{children}</label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} style={{ ...ghostButtonStyle, color: checked ? "var(--green)" : "var(--fg-mute)", borderColor: checked ? "rgba(16,185,129,0.3)" : "var(--border)" }}>{checked ? "ON" : "OFF"} · {label}</button>;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "9px 18px", textAlign: "left" }}><span className="mono" style={fieldLabelStyle}>{children}</span></th>;
}

function Td({ children, strong, code }: { children: React.ReactNode; strong?: boolean; code?: boolean }) {
  return <td className={code ? "mono" : undefined} style={{ padding: "12px 18px", fontSize: code ? 10.5 : 12.5, color: strong ? "var(--fg)" : "var(--fg-dim)" }}>{children}</td>;
}

function statusTone(status: string): "neutral" | "amber" | "green" | "red" | "ghost" {
  if (status === "active" || status === "trialing") return "green";
  if (status === "past_due") return "amber";
  if (status === "cancelled" || status === "expired") return "red";
  return "ghost";
}

function shortDate(value: string) {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

const eyebrowStyle: React.CSSProperties = { fontSize: 10.5, color: "var(--fg-faint)", letterSpacing: "0.22em", marginBottom: 6 };
const smallMuted: React.CSSProperties = { color: "var(--fg-faint)", fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase" };
const codeStyle: React.CSSProperties = { color: "var(--fg-mute)", fontSize: 10.5, letterSpacing: "0.08em" };
const panelStyle: React.CSSProperties = { border: "1px solid var(--border)", borderRadius: 8, background: "var(--bg-elev-1)", padding: 14 };
const formStyle: React.CSSProperties = { padding: 18, display: "flex", flexDirection: "column", gap: 14 };
const twoColStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 };
const fieldLabelStyle: React.CSSProperties = { fontSize: 9.5, color: "var(--fg-mute)", letterSpacing: "0.16em", textTransform: "uppercase" };
const inputStyle: React.CSSProperties = { width: "100%", background: "var(--bg-elev-1)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg)", padding: "9px 10px", fontSize: 13, outline: "none" };
const textAreaStyle: React.CSSProperties = { ...inputStyle, resize: "vertical", lineHeight: 1.5 };
const primaryButtonStyle: React.CSSProperties = { background: "var(--amber)", border: "1px solid var(--amber)", color: "#0A0A0B", borderRadius: 6, padding: "9px 14px", fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };
const ghostButtonStyle: React.CSSProperties = { background: "transparent", border: "1px solid var(--border-strong)", color: "var(--fg-dim)", borderRadius: 6, padding: "8px 12px", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 };