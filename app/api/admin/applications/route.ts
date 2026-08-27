import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const admin = createAdminClient();
    const { data, error: dbError } = await admin
      .from("registration_requests")
      .select("*")
      .order("created_at", { ascending: false });

    if (dbError) {
      console.error("查询申请失败:", dbError);
      return NextResponse.json({ error: "查询失败", detail: dbError.message }, { status: 500 });
    }

    const apps = data ?? [];

    // 自动 approve：pending 但邮箱已在 auth.users 的申请
    const pending = apps.filter((application) => application.status === "pending");
    if (pending.length > 0) {
      const { data: existingUsers } = await admin.auth.admin.listUsers();
      const registeredEmails = new Set(
        existingUsers?.users.map((u) => u.email?.toLowerCase())
      );

      const toAutoApprove = pending.filter((application) =>
        registeredEmails.has(application.email.toLowerCase())
      );

      for (const app of toAutoApprove) {
        await admin
          .from("registration_requests")
          .update({ status: "approved", updated_at: new Date().toISOString() })
          .eq("id", app.id);
        app.status = "approved"; // 同步本地结果
      }
    }

    return NextResponse.json({ data: apps });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("admin/applications GET 异常:", msg);
    return NextResponse.json({ error: "服务器错误", detail: msg }, { status: 500 });
  }
}
