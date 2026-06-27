"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { HemisphereMark } from "@/components/hemisphere-mark";
import { Flame, Bot, Server, Settings, Wallet, Shield, KeyRound } from "lucide-react";
const navModules = [
  { label: "燃烧", code: "BURNING / 01", href: "/", icon: Flame, perm: null },       // 所有人可见
  { label: "舰队", code: "FLEET / 02", href: "/fleet", icon: Bot, perm: "fleet" },     // 需 fleet 权限
  { label: "基地", code: "BASE / 03", href: "/base", icon: Server, perm: "base" },     // 需 base 权限
];

const navControls = [
  { label: "预算", code: "BUDGET", href: "/budget", icon: Wallet, needAuth: true },
  { label: "设置", code: "SETTINGS", href: "/settings", icon: Settings, needAuth: true },
];

const navAdmin = [
  { label: "审核", code: "ADMIN", href: "/admin/applications", icon: Shield },
  { label: "会员", code: "MEMBERS", href: "/admin/memberships", icon: KeyRound },
];

function DividerV() {
  return <div style={{ width: 1, height: 14, background: "var(--border)" }} />;
}

function NavItem({
  icon: Icon,
  label,
  code,
  href,
  active,
  locked,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  code: string;
  href: string;
  active?: boolean;
  locked?: boolean;
}) {
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 10px",
        margin: "0 8px",
        borderRadius: 6,
        background: active ? "rgba(255,176,32,0.06)" : "transparent",
        cursor: locked ? "not-allowed" : "pointer",
        position: "relative",
        opacity: locked ? 0.42 : 1,
        transition: "background .15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active && !locked)
          (e.currentTarget as HTMLElement).style.background =
            "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!active && !locked)
          (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      {active && (
        <div
          style={{
            position: "absolute",
            left: -8,
            top: 8,
            bottom: 8,
            width: 2,
            background: "var(--amber)",
            borderRadius: 2,
          }}
        />
      )}
      <span
        style={{
          width: 18,
          display: "inline-flex",
          justifyContent: "center",
          color: active ? "var(--amber)" : "var(--fg-dim)",
        }}
      >
        <Icon style={{ width: 15, height: 15 }} />
      </span>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
        }}
      >
        <span
          style={{
            color: active ? "var(--fg)" : "var(--fg-dim)",
            fontSize: 13,
            fontWeight: active ? 500 : 400,
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </span>
        <span
          className="mono"
          style={{
            color: "var(--fg-faint)",
            fontSize: 9.5,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {code}
        </span>
      </div>
      {locked && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          stroke="var(--fg-faint)"
          strokeWidth="1.5"
        >
          <rect x="3" y="7" width="10" height="7" rx="1" />
          <path d="M5 7V5a3 3 0 0 1 6 0v2" />
        </svg>
      )}
    </div>
  );

  if (locked) return content;
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      {content}
    </Link>
  );
}

function SystemClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const utc = time.toISOString().slice(11, 19);
  return (
    <span className="mono tabular" style={{ color: "var(--fg-dim)", textAlign: "right" }}>
      {utc}
    </span>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { user, tier, permissions, signOut, hasPermission } = useAuth();
  const isAdmin = tier === "admin" || tier === "owner";
  const isGuest = !user;

  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        zIndex: 1,
        minHeight: "100vh",
      }}
    >
      {/* logo block */}
      <div
        style={{
          position: "relative",
          padding: "20px 18px 18px",
          borderBottom: "1px solid var(--border)",
          background:
            "linear-gradient(180deg, rgba(255,176,32,0.04) 0%, rgba(255,176,32,0) 60%), var(--bg)",
          overflow: "hidden",
        }}
      >
        {/* corner ticks */}
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            width: 6,
            height: 6,
            borderTop: "1px solid var(--amber-line)",
            borderLeft: "1px solid var(--amber-line)",
          }}
        />
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 6,
            height: 6,
            borderTop: "1px solid var(--amber-line)",
            borderRight: "1px solid var(--amber-line)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={isGuest ? { filter: "grayscale(1) brightness(0.65)" } : undefined}>
            <HemisphereMark size={38} />
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              lineHeight: 1,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 21,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--fg)",
                textTransform: "lowercase",
                lineHeight: 1,
              }}
            >
              穹弯
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 6,
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--amber)",
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                }}
              >
                穹弯
              </span>
              <span
                style={{ width: 1, height: 8, background: "var(--border-strong)" }}
              />
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  color: "var(--fg-mute)",
                  letterSpacing: "0.2em",
                  textTransform: "uppercase",
                }}
              >
                burn ctrl
              </span>
            </div>
          </div>
        </div>

        {/* callsign strip */}
        <div
          style={{
            marginTop: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "5px 8px",
            border: "1px solid var(--border)",
            borderRadius: 4,
            background: "var(--bg-elev-1)",
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              color: "var(--fg-faint)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            CALLSIGN
          </span>
          <span
            className="mono tabular"
            style={{
              fontSize: 10,
              color: "var(--fg-dim)",
              letterSpacing: "0.12em",
            }}
          >
            HSP-01 · v0.1.0
          </span>
        </div>
      </div>

      {/* operator chip */}
      <div
        style={{
          margin: "16px 12px 16px",
          padding: "10px 12px",
          border: "1px solid var(--border)",
          borderRadius: 8,
          background: "var(--bg-elev-1)",
        }}
      >
        <div
          className="mono"
          style={{
            fontSize: 9.5,
            color: "var(--fg-faint)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Operator
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: "linear-gradient(135deg, #2a2a30, #18181c)",
              border: "1px solid var(--border-strong)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 600,
              color: "var(--amber)",
            }}
          >
            E
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: isGuest ? 15 : 12,
                fontFamily: isGuest ? "var(--font-display)" : undefined,
                fontWeight: isGuest ? 600 : undefined,
                letterSpacing: isGuest ? "-0.01em" : undefined,
                color: "var(--fg)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user?.email ?? "guest"}
            </div>
            <div
              className="mono"
              style={{ fontSize: 9.5, color: isAdmin ? "var(--amber)" : "var(--fg-mute)" }}
            >
              tier · {tier}
            </div>
          </div>
          <span
            className="dot green"
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              display: "inline-block",
              background: "var(--green)",
              boxShadow: "0 0 0 3px var(--green-dim)",
            }}
          />
        </div>
      </div>

      {/* Modules */}
      <div
        className="mono"
        style={{
          padding: "0 18px 8px",
          fontSize: 9.5,
          color: "var(--fg-faint)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Modules
      </div>
      {navModules.map((item) => {
        const locked = item.perm ? !hasPermission(item.perm) : false;
        return (
          <NavItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            code={item.code}
            href={locked ? "#" : item.href}
            active={pathname === item.href}
            locked={locked}
          />
        );
      })}

      <div style={{ height: 1, background: "var(--border)", margin: "16px 18px" }} />

      {/* Controls */}
      <div
        className="mono"
        style={{
          padding: "0 18px 8px",
          fontSize: 9.5,
          color: "var(--fg-faint)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
        }}
      >
        Controls
      </div>
      {navControls.map((item) => {
        const locked = item.needAuth && isGuest;
        return (
          <NavItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            code={item.code}
            href={locked ? "#" : item.href}
            active={pathname === item.href}
            locked={locked}
          />
        );
      })}

      {/* admin nav */}
      {isAdmin && (
        <>
          <div
            style={{
              margin: "16px 16px 8px",
              fontSize: 9.5,
              color: "var(--fg-faint)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            Admin
          </div>
          {navAdmin.map((item) => (
            <NavItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              code={item.code}
              href={item.href}
              active={pathname === item.href}
            />
          ))}
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* system status */}
      <div
        style={{ borderTop: "1px solid var(--border)", padding: "12px 16px" }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span
            className="mono"
            style={{
              fontSize: 9.5,
              color: "var(--fg-faint)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
            }}
          >
            System
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: "var(--green)",
                letterSpacing: "0.1em",
              }}
            >
              NOMINAL
            </span>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 4,
            fontSize: 10,
          }}
        >
          <div className="mono" style={{ color: "var(--fg-mute)" }}>UTC</div>
          <SystemClock />
          <div className="mono" style={{ color: "var(--fg-mute)" }}>SYNC</div>
          <div
            className="mono"
            style={{ color: "var(--fg-dim)", textAlign: "right" }}
          >
            04m ago
          </div>
          <div className="mono" style={{ color: "var(--fg-mute)" }}>BUILD</div>
          <div
            className="mono"
            style={{ color: "var(--fg-dim)", textAlign: "right" }}
          >
            0.1.0-mvp
          </div>
        </div>

        {/* login / logout */}
        {isGuest ? (
          <Link href="/login" style={{ textDecoration: "none" }}>
            <button
              className="mono"
              style={{
                marginTop: 10,
                width: "100%",
                padding: "6px 0",
                background: "transparent",
                border: "1px solid var(--amber-line)",
                borderRadius: 4,
                color: "var(--amber)",
                fontSize: 9.5,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                cursor: "pointer",
                transition: "all .15s ease",
              }}
            >
              sign in
            </button>
          </Link>
        ) : (
          <button
            onClick={signOut}
            className="mono"
            style={{
              marginTop: 10,
              width: "100%",
              padding: "6px 0",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--fg-mute)",
              fontSize: 9.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all .15s ease",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = "var(--red)";
              (e.target as HTMLElement).style.color = "var(--red)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = "var(--border)";
              (e.target as HTMLElement).style.color = "var(--fg-mute)";
            }}
          >
            sign out
          </button>
        )}
      </div>
    </aside>
  );
}
