"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HemisphereMark } from "@/components/hemisphere-mark";
import { createClient } from "@/lib/supabase/client";

export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 12) {
      setError("密码至少需要 12 个字符");
      return;
    }
    if (password !== confirmation) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setError("一次性链接无效或已过期，请联系管理员重新发送");
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?password_set=1");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <section className="w-full max-w-sm rounded-lg border border-[#26262A] bg-[#121214] p-8">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <HemisphereMark size={48} />
          <div>
            <h1 className="text-xl font-semibold text-[#E5E5E7]">设置密码</h1>
            <p className="mt-2 text-xs text-[#8E8E93]">SET YOUR HALFSPHERE PASSWORD</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block text-xs text-[#8E8E93]">
            新密码（至少 12 个字符）
            <input
              autoComplete="new-password"
              className="mt-2 w-full rounded-md border border-[#26262A] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E5E5E7] outline-none focus:border-[#FFB020]"
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <label className="block text-xs text-[#8E8E93]">
            再次输入
            <input
              autoComplete="new-password"
              className="mt-2 w-full rounded-md border border-[#26262A] bg-[#0A0A0B] px-3 py-2 text-sm text-[#E5E5E7] outline-none focus:border-[#FFB020]"
              minLength={12}
              onChange={(event) => setConfirmation(event.target.value)}
              required
              type="password"
              value={confirmation}
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            className="w-full rounded-md bg-[#FFB020] py-2.5 text-sm font-semibold text-[#0A0A0B] disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading ? "保存中…" : "保存密码"}
          </button>
        </form>
      </section>
    </main>
  );
}
