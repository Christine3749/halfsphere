import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserTier } from "@/lib/auth";
import type { Database } from "@/lib/supabase/types";

export async function requireAuth(supabase: SupabaseClient<Database>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "未登录" }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

export async function requireAdmin(supabase: SupabaseClient<Database>) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "未登录" }, { status: 401 }), user: null };
  }
  const tier = await getUserTier(user.id);
  if (!tier || (tier.tier !== "admin" && tier.tier !== "owner")) {
    return { error: NextResponse.json({ error: "需要管理员权限" }, { status: 403 }), user: null };
  }
  return { error: null, user };
}

// Legacy compat
export async function requirePro(supabase: SupabaseClient<Database>) {
  return requireAuth(supabase);
}
