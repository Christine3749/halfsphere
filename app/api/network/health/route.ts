import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type NetworkSnapshot = Pick<
  Database["public"]["Tables"]["network_snapshots"]["Row"],
  "node_id" | "latency_ms" | "status" | "checked_at"
>;

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 获取节点列表 + 最新快照
    const { data: nodes, error: nodeError } = await supabase
      .from("network_nodes")
      .select("id, name, port, protocol, region, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (nodeError) {
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    // 获取每个节点的最新快照
    const nodeIds = nodes?.map((n) => n.id) ?? [];
    let snapshots: NetworkSnapshot[] = [];

    if (nodeIds.length > 0) {
      const { data: snapData } = await supabase
        .from("network_snapshots")
        .select("node_id, latency_ms, status, checked_at")
        .in("node_id", nodeIds)
        .order("checked_at", { ascending: false });

      // 取每个节点的最新一条
      const seen = new Set<string>();
      snapshots = (snapData ?? []).filter((s) => {
        if (seen.has(s.node_id)) return false;
        seen.add(s.node_id);
        return true;
      });
    }

    const snapMap = new Map(snapshots.map((s) => [s.node_id, s]));

    const result = (nodes ?? []).map((node) => ({
      ...node,
      health: snapMap.get(node.id) ?? null,
    }));

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("GET /api/network/health error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
