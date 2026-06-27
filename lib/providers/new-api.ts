/**
 * 穹弯 halfsphere - New-API Usage Fetcher
 * 兼容 one-api / new-api 的多 provider 聚合网关
 * 通过 GET /api/log?type=2 拉取请求日志，按 date+model 聚合
 */
import type { UsageSnapshot, FetchUsageFn } from "./types";

interface NewApiLog {
  id: number;
  created_at: number; // Unix 秒
  type: number;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  quota: number; // 500000 quota = $1 USD (默认比例)
  channel_id?: number;
  channel_name?: string;
}

interface NewApiLogResponse {
  success: boolean;
  message: string;
  data: {
    logs: NewApiLog[];
    total: number;
  };
}

const QUOTA_PER_USD = 500000;

function tsToDate(ts: number): string {
  return new Date(ts * 1000).toISOString().split("T")[0];
}

export const fetchUsage: FetchUsageFn = async (
  apiKey: string,
  startDate: string,
  endDate: string,
  options?: { endpoint_url?: string }
): Promise<UsageSnapshot[]> => {
  const baseUrl = options?.endpoint_url?.replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("New-API 需要配置实例地址（endpoint_url）");
  }

  const startTs = Math.floor(new Date(startDate + "T00:00:00Z").getTime() / 1000);
  const endTs = Math.floor(new Date(endDate + "T23:59:59Z").getTime() / 1000);

  // date+model → aggregated
  const agg: Record<string, { input: number; output: number; quota: number; raw: NewApiLog }> = {};

  let page = 1;
  const pageSize = 100;
  let total = Infinity;

  while ((page - 1) * pageSize < total) {
    const url = new URL(`${baseUrl}/api/log`);
    url.searchParams.set("type", "2");
    url.searchParams.set("start_timestamp", String(startTs));
    url.searchParams.set("end_timestamp", String(endTs));
    url.searchParams.set("p", String(page));
    url.searchParams.set("page_size", String(pageSize));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`New-API 请求失败: ${res.status} ${res.statusText} - ${body}`);
    }

    const json: NewApiLogResponse = await res.json();
    if (!json.success) {
      throw new Error(`New-API 返回错误: ${json.message}`);
    }

    total = json.data.total;
    const logs = json.data.logs ?? [];

    for (const log of logs) {
      const date = tsToDate(log.created_at);
      const model = log.model_name || "unknown";
      const key = `${date}::${model}`;

      if (!agg[key]) {
        agg[key] = { input: 0, output: 0, quota: 0, raw: log };
      }
      agg[key].input += log.prompt_tokens || 0;
      agg[key].output += log.completion_tokens || 0;
      agg[key].quota += log.quota || 0;
    }

    if (logs.length < pageSize) break;
    page++;

    // 安全阀
    if (page > 200) break;
  }

  return Object.entries(agg).map(([key, v]) => {
    const [date, model] = key.split("::");
    return {
      date,
      model,
      input_tokens: v.input,
      output_tokens: v.output,
      cost_usd: v.quota / QUOTA_PER_USD,
      raw: v.raw as unknown as Record<string, unknown>,
    };
  });
};
