import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/request-auth";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { node_id, latency_ms, status } = body;

    if (!node_id || latency_ms === undefined) {
      return NextResponse.json({ error: "缺少必要字段" }, { status: 400 });
    }

    const supabase = await createClient();

    // 验证节点属于当前用户
    const { data: node } = await supabase
      .from("network_nodes")
      .select("id")
      .eq("id", node_id)
      .eq("user_id", user.id)
      .single();

    if (!node) {
      return NextResponse.json({ error: "节点不存在或无权限" }, { status: 403 });
    }

    const { error } = await supabase.from("network_snapshots").insert({
      node_id,
      latency_ms: latency_ms === null ? null : Math.round(latency_ms),
      status: status || "unknown",
      user_id: user.id,
    });

    if (error) {
      return NextResponse.json({ error: "同步失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("POST /api/network/sync error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
