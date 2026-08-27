"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HemisphereMark } from "@/components/hemisphere-mark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "邮箱或密码错误"
          : signInError.message
      );
      setLoading(false);
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        zIndex: 1,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360, padding: "0 24px" }}>
        {/* logo */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32, gap: 14 }}>
          <HemisphereMark size={72} />
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 26,
                fontWeight: 600,
                letterSpacing: "-0.02em",
                color: "var(--fg)",
                textTransform: "lowercase",
              }}
            >
              穹弯
            </h1>
            <p
              className="mono"
              style={{
                margin: "6px 0 0",
                fontSize: 10.5,
                color: "var(--fg-mute)",
                letterSpacing: "0.22em",
                textTransform: "uppercase",
              }}
            >
              穹弯 · 内部作战面板
            </p>
          </div>
        </div>

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              className="mono"
              style={{
                fontSize: 9.5,
                color: "var(--fg-mute)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              邮箱 / Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                background: "var(--bg-elev-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "var(--fg)",
                fontSize: 14,
                outline: "none",
                transition: "border-color .15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--amber-line)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label
              className="mono"
              style={{
                fontSize: 9.5,
                color: "var(--fg-mute)",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
              }}
            >
              密码 / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                background: "var(--bg-elev-1)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "10px 12px",
                color: "var(--fg)",
                fontSize: 14,
                outline: "none",
                transition: "border-color .15s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--amber-line)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--red)" }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              background: "var(--amber)",
              border: "1px solid var(--amber)",
              color: "#0A0A0B",
              borderRadius: 6,
              padding: "11px 0",
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              transition: "opacity .15s ease",
            }}
          >
            {loading ? "登录中..." : "登录 / Sign In"}
          </button>
        </form>

        <p
          className="mono"
          style={{
            marginTop: 20,
            textAlign: "center",
            fontSize: 11,
            color: "var(--fg-mute)",
            letterSpacing: "0.08em",
          }}
        >
          没有账号？{" "}
          <a href="/apply" style={{ color: "var(--amber)", textDecoration: "none" }}>
            申请访问
          </a>
        </p>

        <p
          className="mono"
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: 9.5,
            color: "var(--fg-faint)",
            letterSpacing: "0.14em",
          }}
        >
          穹弯 · BURN CTRL / 01 · v0.1.0-mvp
        </p>
      </div>
    </div>
  );
}
