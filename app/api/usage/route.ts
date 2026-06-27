/**
 * 穹弯 halfsphere - Usage 查询 API
 * GET /api/usage?range=30d&group_by=provider
 * 支持参数:
 *   - range: 7d / 30d / 90d / month (默认 30d)
 *   - group_by: provider / model / date (默认 date)
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RangeType = "7d" | "30d" | "90d" | "month";
type GroupByType = "provider" | "model" | "date";

function parseRange(range: string | null): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = now.toISOString().split("T")[0];
  let startDate: string;

  switch (range as RangeType) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split("T")[0];
      break;
    case "30d":
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
  }

  return { startDate, endDate };
}

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

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";
    const groupBy = (searchParams.get("group_by") || "date") as GroupByType;

    const { startDate, endDate } = parseRange(range);

    // 基础查询：获取该用户在时间范围内的所有 usage 数据
    const { data: rows, error } = await supabase
      .from("usage_snapshots")
      .select("*, providers(name)")
      .eq("user_id", user.id)
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: true });

    if (error) {
      console.error("查询 usage 失败:", error);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    // 聚合计算
    const aggregated = {
      total_cost: 0,
      total_input_tokens: 0,
      total_output_tokens: 0,
      by_provider: {} as Record<string, { cost: number; input_tokens: number; output_tokens: number }>,
      by_model: {} as Record<string, { cost: number; input_tokens: number; output_tokens: number }>,
      by_date: {} as Record<string, { cost: number; input_tokens: number; output_tokens: number }>,
    };

    for (const row of rows || []) {
      const providerName = (row.providers as unknown as { name: string })?.name || "unknown";
      const cost = Number(row.cost_usd) || 0;
      const inputTokens = Number(row.input_tokens) || 0;
      const outputTokens = Number(row.output_tokens) || 0;

      aggregated.total_cost += cost;
      aggregated.total_input_tokens += inputTokens;
      aggregated.total_output_tokens += outputTokens;

      // 按 provider 聚合
      if (!aggregated.by_provider[providerName]) {
        aggregated.by_provider[providerName] = { cost: 0, input_tokens: 0, output_tokens: 0 };
      }
      aggregated.by_provider[providerName].cost += cost;
      aggregated.by_provider[providerName].input_tokens += inputTokens;
      aggregated.by_provider[providerName].output_tokens += outputTokens;

      // 按 model 聚合
      if (!aggregated.by_model[row.model]) {
        aggregated.by_model[row.model] = { cost: 0, input_tokens: 0, output_tokens: 0 };
      }
      aggregated.by_model[row.model].cost += cost;
      aggregated.by_model[row.model].input_tokens += inputTokens;
      aggregated.by_model[row.model].output_tokens += outputTokens;

      // 按 date 聚合
      if (!aggregated.by_date[row.date]) {
        aggregated.by_date[row.date] = { cost: 0, input_tokens: 0, output_tokens: 0 };
      }
      aggregated.by_date[row.date].cost += cost;
      aggregated.by_date[row.date].input_tokens += inputTokens;
      aggregated.by_date[row.date].output_tokens += outputTokens;
    }

    // 根据 group_by 参数返回不同结构
    let resultData: unknown;
    switch (groupBy) {
      case "provider":
        resultData = aggregated.by_provider;
        break;
      case "model":
        resultData = aggregated.by_model;
        break;
      case "date":
      default:
        resultData = aggregated.by_date;
        break;
    }

    return NextResponse.json({
      range,
      start_date: startDate,
      end_date: endDate,
      summary: {
        total_cost: Number(aggregated.total_cost.toFixed(6)),
        total_input_tokens: aggregated.total_input_tokens,
        total_output_tokens: aggregated.total_output_tokens,
        count: rows?.length || 0,
      },
      data: resultData,
    });
  } catch (err) {
    console.error("GET /api/usage 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
