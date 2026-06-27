/**
 * 穹弯 halfsphere - OpenAI Usage Fetcher
 * 调用 OpenAI Organization Usage API 获取消耗数据
 * 文档: https://platform.openai.com/docs/api-reference/usage
 */
import type { UsageSnapshot, FetchUsageFn } from "./types";
import { OPENAI_PRICING } from "./pricing";

interface OpenAIUsageItem {
  object: string;
  // 不同 endpoint 返回的结构略有差异
  // /v1/organization/usage/completions 返回的结构
}

interface OpenAICompletionUsageResponse {
  object: string;
  data: Array<{
    object: string;
    organization_id: string;
    organization_name: string;
    // 按天聚合时
    start_time?: number;
    end_time?: number;
    // 按模型聚合
    model?: string;
    // 用量
    num_requests?: number;
    num_tokens?: number;
    num_input_tokens?: number;
    num_output_tokens?: number;
    // 金额（部分接口返回）
    amount?: number; // 单位：分
  }>;
  has_more: boolean;
  next_page?: string;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = OPENAI_PRICING[model];
  if (!price) {
    return (inputTokens / 1000) * 0.0025 + (outputTokens / 1000) * 0.01;
  }
  return (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;
}

/**
 * 将 Unix 时间戳转换为 YYYY-MM-DD 格式
 */
function tsToDate(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toISOString().split("T")[0];
}

export const fetchUsage: FetchUsageFn = async (
  apiKey: string,
  startDate: string,
  endDate: string
): Promise<UsageSnapshot[]> => {
  if (!apiKey.startsWith("sk-")) {
    throw new Error("OpenAI API Key 格式错误，应以 sk- 开头");
  }

  const results: UsageSnapshot[] = [];

  // OpenAI Usage API 需要 start_time / end_time 为 Unix 秒级时间戳
  const startTs = Math.floor(new Date(startDate + "T00:00:00Z").getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);

  let nextPage: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const url = new URL("https://api.openai.com/v1/organization/usage/completions");
    url.searchParams.set("start_time", String(startTs));
    url.searchParams.set("end_time", String(endTs));
    // 按天聚合
    url.searchParams.set("bucket_width", "1d");

    if (nextPage) {
      url.searchParams.set("next_page", nextPage);
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(
        `OpenAI Usage API 请求失败: ${res.status} ${res.statusText} - ${errBody}`
      );
    }

    const data: OpenAICompletionUsageResponse = await res.json();

    for (const item of data.data) {
      const date = item.start_time ? tsToDate(item.start_time) : startDate;
      const model = item.model || "unknown";
      const inputTokens = item.num_input_tokens || item.num_tokens || 0;
      const outputTokens = item.num_output_tokens || 0;

      // API 可能返回金额（单位：分）
      const costUsd =
        typeof item.amount === "number"
          ? item.amount / 100
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

    hasMore = data.has_more;
    nextPage = data.next_page;

    // 安全阀：最多分页 50 次
    if (results.length > 5000) {
      break;
    }
  }

  return results;
};
