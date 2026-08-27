import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { requirePro } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("network_nodes")
      .select("id, name, port, protocol, region, is_active, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("查询节点失败:", error);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("GET /api/network/nodes error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { error: proError, user } = await requirePro(supabase);
    if (proError) return proError;

    const body = await request.json();
    const { name, host, port, protocol, region } = body;

    if (!name || !host) {
      return NextResponse.json({ error: "缺少必填字段" }, { status: 400 });
    }

    const { ciphertext, iv, tag } = encrypt(host);

    const { data, error } = await supabase
      .from("network_nodes")
      .insert({
        user_id: user.id,
        name: name.trim(),
        host_encrypted: ciphertext,
        host_iv: iv,
        host_tag: tag,
        port: port ?? 443,
        protocol: protocol ?? "vmess",
        region: region ?? "",
      })
      .select("id, name, port, protocol, region, is_active")
      .single();

    if (error) {
      console.error("插入节点失败:", error);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/network/nodes error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { error: proError, user } = await requirePro(supabase);
    if (proError) return proError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "缺少 id" }, { status: 400 });
    }

    const { error } = await supabase
      .from("network_nodes")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
