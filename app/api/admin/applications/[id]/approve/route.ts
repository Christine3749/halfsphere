import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendApprovalEmail } from "@/lib/email";

const USERS_PER_PAGE = 1_000;

async function userExists(email: string) {
  const admin = createAdminClient();
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });
    if (error) throw error;
    if (data.users.some((user) => user.email?.toLowerCase() === normalizedEmail)) {
      return true;
    }
    if (data.users.length < USERS_PER_PAGE) return false;
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const admin = createAdminClient();

  // 1. 获取申请信息
  const { data: rawReq, error: reqError } = await admin
    .from("registration_requests")
    .select("*")
    .eq("id", id)
    .single();

  const req = rawReq as { status: string; email: string; display_name: string } | null;

  if (reqError || !req || req.status !== "pending") {
    return NextResponse.json({ error: "申请不存在或已处理" }, { status: 404 });
  }

  let alreadyExists: boolean;
  try {
    alreadyExists = await userExists(req.email);
  } catch (lookupError) {
    console.error("查询用户失败:", lookupError);
    return NextResponse.json({ error: "无法确认用户状态" }, { status: 502 });
  }

  const appBaseUrl = process.env.APP_BASE_URL;
  if (!appBaseUrl) {
    return NextResponse.json({ error: "APP_BASE_URL 未配置" }, { status: 500 });
  }

  let redirectTo: string;
  try {
    redirectTo = new URL("/set-password", appBaseUrl).toString();
  } catch {
    return NextResponse.json({ error: "APP_BASE_URL 配置无效" }, { status: 500 });
  }

  const { data: linkData, error: linkError } = alreadyExists
    ? await admin.auth.admin.generateLink({
        type: "recovery",
        email: req.email,
        options: { redirectTo },
      })
    : await admin.auth.admin.generateLink({
        type: "invite",
        email: req.email,
        options: { redirectTo, data: { display_name: req.display_name } },
      });
  const actionLink = linkData.properties?.action_link;
  if (linkError || !actionLink) {
    console.error("生成一次性链接失败:", linkError);
    return NextResponse.json({ error: "无法生成一次性设置密码链接" }, { status: 502 });
  }

  try {
    await sendApprovalEmail(req.email, req.display_name, actionLink);
  } catch (emailError) {
    console.error("发送审核通过邮件失败:", emailError);
    return NextResponse.json({ error: "审核邮件发送失败，请重试" }, { status: 502 });
  }

  const { error: updateError } = await admin
    .from("registration_requests")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) {
    console.error("更新申请状态失败:", updateError);
    return NextResponse.json({ error: "申请状态更新失败" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    email: req.email,
    already_existed: alreadyExists,
    message: "审核已通过，一次性设置密码链接已发送",
  });
}
