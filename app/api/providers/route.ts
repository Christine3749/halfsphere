/**
 * 穹弯 halfsphere - Provider API 路由
 * POST: 添加新 provider
 * GET:  列出当前用户的所有 providers（不含 API Key）
 * DELETE: 删除指定 provider
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@/lib/crypto";
import { requireAuth } from "@/lib/auth-helpers";

const VALID_PROVIDERS = [
  "openai",
  "anthropic",
  "gemini",
  "deepseek",
  "openrouter",
  "new-api",
] as const;

// 验证 provider 名称是否合法
function isValidProvider(name: string): name is (typeof VALID_PROVIDERS)[number] {
  return VALID_PROVIDERS.includes(name as (typeof VALID_PROVIDERS)[number]);
}

/**
 * GET /api/providers
 * 返回当前用户的所有 provider 列表（不含密钥）
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("providers")
      .select("id, name, display_name, endpoint_url, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("查询 providers 失败:", error);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    console.error("GET /api/providers 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/providers
 * 接收: { name, display_name, api_key }
 * 加密存储 API Key，返回不含 key 的 provider 信息
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { error: proError, user } = await requireAuth(supabase);
    if (proError) return proError;

    const body = await request.json();
    const { name, display_name, api_key, endpoint_url } = body;

    // 参数校验
    if (!name || !api_key) {
      return NextResponse.json(
        { error: "缺少必填字段: name, api_key" },
        { status: 400 }
      );
    }

    if (name === "new-api" && !endpoint_url) {
      return NextResponse.json(
        { error: "new-api 需要填写实例地址（endpoint_url）" },
        { status: 400 }
      );
    }

    if (!isValidProvider(name)) {
      return NextResponse.json(
        { error: `不支持的 provider: ${name}` },
        { status: 400 }
      );
    }

    // 加密 API Key
    const { ciphertext, iv, tag } = encrypt(api_key);

    const { data, error } = await supabase
      .from("providers")
      .insert({
        user_id: user.id,
        name,
        display_name: display_name || name,
        api_key_encrypted: ciphertext,
        api_key_iv: iv,
        api_key_tag: tag,
        endpoint_url: endpoint_url || null,
      })
      .select("id, name, display_name, endpoint_url, created_at, updated_at")
      .single();

    if (error) {
      console.error("插入 provider 失败:", error);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error("POST /api/providers 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * DELETE /api/providers?id=<provider_id>
 * 删除指定 provider
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { error: proError, user } = await requireAuth(supabase);
    if (proError) return proError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "缺少参数: id" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("providers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("删除 provider 失败:", error);
      return NextResponse.json({ error: "删除失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/providers 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
