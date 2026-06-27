/**
 * 穹弯 halfsphere - Anthropic Usage Fetcher
 * 调用 Anthropic Organization Usage Report API 获取消耗数据
 * 注意：需要 Admin API Key（组织管理员才能获取）
 * 文档: https://docs.anthropic.com/en/api/admin-api/usage-reports
 */
import type { UsageSnapshot, FetchUsageFn } from "./types";
import { ANTHROPIC_PRICING } from "./pricing";

interface AnthropicUsageResponse {
  data: Array<{
    // Anthropic usage_report API 返回结构
    // 实际结构可能因时间粒度不同而变化
    // 常见字段：
    type?: string;
    // 按 model 聚合
    model?: string;
    // 时间范围
    start_time?: string; // ISO 8601
    end_time?: string;
    // 用量
    input_tokens?: number;
    output_tokens?: number;
    // 金额（部分情况）
    cost_usd?: number;
    // 其他元数据
    [key: string]: unknown;
  }>;
  // 分页
  has_more?: boolean;
  next_cursor?: string;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = ANTHROPIC_PRICING[model];
  if (!price) {
    return (inputTokens / 1000) * 0.003 + (outputTokens / 1000) * 0.015;
  }
  return (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
}

/**
 * 将 ISO 时间字符串提取为 YYYY-MM-DD
 */
function isoToDate(iso: string): string {
  return iso.split("T")[0];
}

export const fetchUsage: FetchUsageFn = async (
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<UsageSnapshot[]> => {
  // Anthropic Admin Key 格式: sk-ant-admin03-... 或类似的 admin key
  // 普通 API Key (sk-ant-api03-) 没有权限调用 usage_report
  if (!apiKey.includes("admin")) {
    console.warn("Anthropic API Key 似乎不是 Admin Key，Usage Report 可能返回 403");
  }

  const results: UsageSnapshot[] = [];

  // Anthropic usage_report API 支持按时间范围查询
  // 注意：API 可能有不同的 endpoint 和参数
  const url = new URL(
    "https://api.anthropic.com/v1/organizations/usage_report/messages"
  );
  url.searchParams.set("start_time", `${startDate}T00:00:00Z`);
  url.searchParams.set("end_time", `${endDate}T23:59:59Z`);
  // 按天聚合
  url.searchParams.set("time_bucket_width", "1d");

  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const currentUrl = new URL(url.toString());
    if (cursor) {
      currentUrl.searchParams.set("cursor", cursor);
    }

    const res = await fetch(currentUrl.toString(), {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `Anthropic Usage API 请求失败: ${res.status} ${res.statusText} - ${errBody}`
      );
    }

    const data: AnthropicUsageResponse = await res.json();

    for (const item of data.data) {
      const date = item.start_time ? isoToDate(item.start_time) : startDate;
      const model = item.model || "unknown";
      const inputTokens = item.input_tokens || 0;
      const outputTokens = item.output_tokens || 0;

      const costUsd =
        typeof item.cost_usd === "number"
          ? item.cost_usd
          : estimateCost(model, inputTokens, outputTokens);

      results.push({
        date,
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
        raw: item as Record<string, unknown>,
      });
    }

    hasMore = data.has_more ?? false;
    cursor = data.next_cursor;

    // 安全阀
    if (results.length > 5000) {
      break;
    }
  }

  return results;
};
