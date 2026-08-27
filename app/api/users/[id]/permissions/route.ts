import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const EDITABLE_TIERS = new Set(["guest", "user", "admin"]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user: adminUser, error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;
  const body = await request.json();
  const { tier, permissions } = body;

  const admin = createAdminClient();

  // 不能修改自己
  if (id === adminUser.id) {
    return NextResponse.json({ error: "不能修改自己的权限" }, { status: 400 });
  }

  const { data: targetTier, error: targetTierError } = await admin
    .from("user_tiers")
    .select("tier")
    .eq("user_id", id)
    .single();
  if (targetTierError) {
    return NextResponse.json({ error: "无法确认目标用户权限" }, { status: 502 });
  }
  if (targetTier?.tier === "owner") {
    return NextResponse.json({ error: "不能修改 Owner 的权限" }, { status: 403 });
  }

  if (tier !== undefined && (typeof tier !== "string" || !EDITABLE_TIERS.has(tier))) {
    return NextResponse.json({ error: "角色值无效" }, { status: 400 });
  }
  if (
    permissions !== undefined &&
    (!Array.isArray(permissions) || permissions.some((value) => typeof value !== "string"))
  ) {
    return NextResponse.json({ error: "权限列表格式无效" }, { status: 400 });
  }

  const updates: {
    tier?: "guest" | "user" | "admin";
    permissions?: string[];
    granted_by: string;
    upgraded_at: string;
  } = {
    granted_by: adminUser.id,
    upgraded_at: new Date().toISOString(),
  };
  if (tier !== undefined) updates.tier = tier;
  if (permissions !== undefined) updates.permissions = permissions;

  const { error: updateErr } = await admin
    .from("user_tiers")
    .update(updates)
    .eq("user_id", id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
