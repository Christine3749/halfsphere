"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { HemisphereMark } from "@/components/hemisphere-mark";
import { Check, X, Loader2, Shield } from "lucide-react";

interface Application {
  id: string;
  email: string;
  display_name: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export default function AdminApplicationsPage() {
  const { user, tier, loading: authLoading } = useAuth();
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [result, setResult] = useState<string>("");

  useEffect(() => {
    if (authLoading) return;
    if (!user || (tier !== "admin" && tier !== "owner")) {
      router.push("/");
      return;
    }
    fetchApps();
  }, [user, tier, authLoading, router]);

  async function fetchApps() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/applications");
      const data = await res.json();
      setApps(data.data ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function approve(id: string) {
    setActionId(id);
    setResult("");
    try {
      const res = await fetch(`/api/admin/applications/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setResult(`已通过: ${data.email} / 一次性设置密码链接已发送`);
        fetchApps();
      } else {
        setResult(data.error || "操作失败");
      }
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionId(null);
    }
  }

  async function dismiss(id: string) {
    setActionId(id);
    try {
      await fetch(`/api/admin/applications/${id}`, { method: "DELETE" });
      fetchApps();
    } finally {
      setActionId(null);
    }
  }

  async function reject(id: string) {
    setActionId(id);
    setResult("");
    try {
      const res = await fetch(`/api/admin/applications/${id}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setResult("已拒绝");
        fetchApps();
      } else {
        setResult(data.error || "操作失败");
      }
    } catch (err: unknown) {
      setResult(err instanceof Error ? err.message : "操作失败");
    } finally {
      setActionId(null);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A0A0B]">
        <Loader2 className="h-8 w-8 animate-spin text-[#FFB020]" />
      </div>
    );
  }

  const pending = apps.filter((a) => a.status === "pending");
  const processed = apps.filter((a) => a.status !== "pending");

  return (
    <div className="min-h-screen bg-[#0A0A0B] p-6">
      {/* header */}
      <div className="mb-8 flex items-center gap-4">
        <HemisphereMark size={32} />
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-[#E5E5E7]">
            申请审核
          </h1>
          <p className="text-xs text-[#8E8E93]">
            ADMIN / REGISTRATION REQUESTS
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-full bg-[#121214] px-3 py-1 text-xs text-[#FFB020]">
          <Shield size={12} />
          <span>管理员</span>
        </div>
      </div>

      {result && (
        <div className="mb-6 rounded-lg border border-[#FFB020]/30 bg-[#FFB020]/10 px-4 py-3 text-sm text-[#FFB020]">
          {result}
        </div>
      )}

      {/* pending */}
      <div className="mb-8">
        <h2 className="mb-4 text-sm font-medium tracking-widest text-[#8E8E93]">
          待审核 ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-[#4A4A4F]">暂无待审核申请</p>
        ) : (
          <div className="space-y-3">
            {pending.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between rounded-lg border border-[#26262A] bg-[#121214] p-4"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#E5E5E7]">
                      {app.display_name}
                    </span>
                    <span className="text-xs text-[#8E8E93]">{app.email}</span>
                  </div>
                  {app.reason && (
                    <p className="mt-1 text-xs text-[#6E6E76]">{app.reason}</p>
                  )}
                  <p className="mt-1 text-xs text-[#4A4A4F]">
                    {new Date(app.created_at).toLocaleString("zh-CN")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => approve(app.id)}
                    disabled={actionId === app.id}
                    className="flex items-center gap-1 rounded-md bg-[#FFB020]/10 px-3 py-1.5 text-xs font-medium text-[#FFB020] transition hover:bg-[#FFB020]/20 disabled:opacity-50"
                  >
                    {actionId === app.id ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    通过
                  </button>
                  <button
                    onClick={() => reject(app.id)}
                    disabled={actionId === app.id}
                    className="flex items-center gap-1 rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <X size={12} />
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* processed */}
      <div>
        <h2 className="mb-4 text-sm font-medium tracking-widest text-[#8E8E93]">
          已处理 ({processed.length})
        </h2>
        {processed.length === 0 ? (
          <p className="text-sm text-[#4A4A4F]">暂无已处理申请</p>
        ) : (
          <div className="space-y-2">
            {processed.map((app) => (
              <div
                key={app.id}
                className="flex items-center justify-between rounded-lg border border-[#1a1a1c] bg-[#0e0e10] px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#8E8E93]">{app.email}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs ${
                      app.status === "approved"
                        ? "bg-[#FFB020]/10 text-[#FFB020]"
                        : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {app.status === "approved" ? "已通过" : "已拒绝"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-[#4A4A4F]">
                    {new Date(app.created_at).toLocaleDateString("zh-CN")}
                  </span>
                  <button
                    onClick={() => dismiss(app.id)}
                    disabled={actionId === app.id}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#4A4A4F] transition hover:text-red-400 disabled:opacity-50"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
