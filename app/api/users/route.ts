import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const admin = createAdminClient();

  const { data: users, error: userErr } = await admin.auth.admin.listUsers();
  if (userErr) {
    return NextResponse.json({ error: userErr.message }, { status: 500 });
  }

  const userIds = users.users.map((u) => u.id);

  const { data: tiers } = await admin
    .from("user_tiers")
    .select("user_id, tier, permissions, granted_by, upgraded_at")
    .in("user_id", userIds);

  const tierMap = new Map(tiers?.map((t) => [t.user_id, t]));

  const result = users.users
    .map((u) => {
      const tier = (tierMap.get(u.id)?.tier as string) ?? "user";
      return {
        id: u.id,
        email: u.email,
        display_name: u.user_metadata?.display_name ?? u.email?.split("@")[0] ?? "—",
        created_at: u.created_at,
        tier,
        permissions: (tierMap.get(u.id)?.permissions as string[]) ?? [],
        granted_by: tierMap.get(u.id)?.granted_by ?? null,
        last_sign_in_at: u.last_sign_in_at,
        is_owner: tier === "owner",
      };
    })
    // owner 置顶
    .sort((a, b) => (a.is_owner ? -1 : b.is_owner ? 1 : 0));

  return NextResponse.json({ data: result });
}
