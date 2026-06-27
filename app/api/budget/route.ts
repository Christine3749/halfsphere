/**
 * 穹弯 halfsphere - 预算配置 API
 * GET /api/budget    -> 获取当前用户的预算配置
 * POST /api/budget   -> 创建或更新预算配置
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth as requireAuthLib } from "@/lib/auth";

async function requireAuthBudget(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { error: NextResponse.json({ error: "未登录" }, { status: 401 }), user: null };
  }
  return { error: null, user };
}

/**
 * GET /api/budget
 */
export async function GET(request: NextRequest) {
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
      .from("budgets")
      .select("*")
      .eq("user_id", user.id)
      .limit(1);

    if (error) {
      console.error("查询 budget 失败:", error);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    console.error("GET /api/budget 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}

/**
 * POST /api/budget
 * 创建或更新预算配置（UPSERT）
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { error: proError, user } = await requireAuthBudget(supabase);
    if (proError) return proError;

    const body = await request.json();
    const {
      monthly_limit_usd,
      warn_threshold,
      alert_threshold,
      email_alerts,
      telegram_chat_id,
    } = body;

    // 参数校验
    if (typeof monthly_limit_usd !== "number" || monthly_limit_usd < 0) {
      return NextResponse.json(
        { error: "monthly_limit_usd 必须是正数" },
        { status: 400 }
      );
    }

    if (
      typeof warn_threshold !== "number" ||
      warn_threshold < 0 ||
      warn_threshold > 100
    ) {
      return NextResponse.json(
        { error: "warn_threshold 必须在 0-100 之间" },
        { status: 400 }
      );
    }

    if (
      typeof alert_threshold !== "number" ||
      alert_threshold < 0 ||
      alert_threshold > 100
    ) {
      return NextResponse.json(
        { error: "alert_threshold 必须在 0-100 之间" },
        { status: 400 }
      );
    }

    if (warn_threshold >= alert_threshold) {
      return NextResponse.json(
        { error: "warn_threshold 必须小于 alert_threshold" },
        { status: 400 }
      );
    }

    // Upsert: 自动创建或更新
    const result = await supabase
      .from("budgets")
      .upsert({
        user_id: user.id,
        monthly_limit_usd,
        warn_threshold,
        alert_threshold,
        email_alerts: !!email_alerts,
        telegram_chat_id: telegram_chat_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (result.error) {
      console.error("保存 budget 失败:", result.error);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ data: result.data });
  } catch (err) {
    console.error("POST /api/budget 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
