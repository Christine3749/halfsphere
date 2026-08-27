import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/* ── Types ── */
export interface UserTier {
  tier: "guest" | "user" | "admin" | "owner";
  permissions: string[];
  granted_by: string | null;
}

/* ── Auth guard ── */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, error: NextResponse.json({ error: "未登录" }, { status: 401 }) };
  }
  return { user, error: null };
}

/* ── Fetch user's tier & permissions ── */
export async function getUserTier(userId: string): Promise<UserTier | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_tiers")
    .select("tier, permissions, granted_by")
    .eq("user_id", userId)
    .single();

  if (!data) return null;
  return {
    tier: data.tier as UserTier["tier"],
    permissions: (data.permissions as string[]) ?? [],
    granted_by: data.granted_by,
  };
}

/* ── Admin guard ── */
export async function requireAdmin() {
  const { user, error } = await requireAuth();
  if (error) return { user: null, tier: null, error };

  const tier = await getUserTier(user.id);
  if (!tier || (tier.tier !== "admin" && tier.tier !== "owner")) {
    return { user, tier, error: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }) };
  }
  return { user, tier, error: null };
}

/* ── Permission guard ── */
export async function requirePermission(permission: string) {
  const { user, error } = await requireAuth();
  if (error) return { user: null, tier: null, error };

  const tier = await getUserTier(user.id);
  // admin / owner 自动拥有所有权限
  if (tier?.tier === "admin" || tier?.tier === "owner") {
    return { user, tier, error: null };
  }
  // user 需检查权限列表
  if (tier?.permissions?.includes(permission)) {
    return { user, tier, error: null };
  }
  return { user, tier, error: NextResponse.json({ error: `缺少权限: ${permission}` }, { status: 403 }) };
}

export async function requirePro() {
  return requireAdmin(); // pro → admin 兼容
}
