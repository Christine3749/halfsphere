/**
 * 穹弯 halfsphere - Provider Fetcher 通用类型
 */

export interface UsageSnapshot {
  /** 日期，格式 YYYY-MM-DD */
  date: string;
  /** 模型名称 */
  model: string;
  /** 输入 token 数 */
  input_tokens: number;
  /** 输出 token 数 */
  output_tokens: number;
  /** 估算成本（美元） */
  cost_usd: number;
  /** 原始 API 响应 */
  raw: Record<string, unknown>;
}

/**
 * 每个 provider 必须导出的 fetchUsage 函数签名
 */
export type FetchUsageFn = (
  apiKey: string,
  startDate: string,
  endDate: string,
  options?: { endpoint_url?: string }
) => Promise<UsageSnapshot[]>;
