"use client";

import { useState } from "react";
import { HemisphereMark } from "@/components/hemisphere-mark";

export default function ApplyPage() {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://halfsphere-api-827638954474.us-central1.run.app";
      const res = await fetch(`${apiBase}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, display_name: displayName, reason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提交失败");
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] px-4">
        <div className="text-center">
          <HemisphereMark size={48} />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#E5E5E7]">
            申请已提交
          </h1>
          <p className="mt-3 text-sm text-[#8E8E93]">
            审核通过后，你将收到邮件通知。
            <br />
            请耐心等待。
          </p>
          <a
            href="/login"
            className="mt-6 inline-block text-sm text-[#FFB020] hover:underline"
          >
            返回登录页
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center">
          <HemisphereMark size={40} />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-[#E5E5E7]">
            穹弯
          </h1>
          <p className="mt-1 text-xs tracking-widest text-[#8E8E93]">
            申请访问 / 内部作战面板
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-widest text-[#8E8E93]">
              邮箱 / EMAIL
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#26262A] bg-[#121214] px-4 py-2.5 text-sm text-[#E5E5E7] placeholder-[#4A4A4F] outline-none transition focus:border-[#FFB020]"
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-widest text-[#8E8E93]">
              称呼 / NAME
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-[#26262A] bg-[#121214] px-4 py-2.5 text-sm text-[#E5E5E7] placeholder-[#4A4A4F] outline-none transition focus:border-[#FFB020]"
              placeholder="森哥"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium tracking-widest text-[#8E8E93]">
              申请理由 / REASON
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full resize-none rounded-lg border border-[#26262A] bg-[#121214] px-4 py-2.5 text-sm text-[#E5E5E7] placeholder-[#4A4A4F] outline-none transition focus:border-[#FFB020]"
              placeholder="简述你的使用场景..."
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#FFB020] py-2.5 text-sm font-semibold text-[#0A0A0B] transition hover:bg-[#FFC758] disabled:opacity-50"
          >
            {loading ? "提交中..." : "提交申请 / APPLY"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#8E8E93]">
          已有账号？{" "}
          <a href="/login" className="text-[#FFB020] hover:underline">
            直接登录
          </a>
        </p>
      </div>
    </div>
  );
}
