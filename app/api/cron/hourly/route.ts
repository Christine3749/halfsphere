/**
 * 穹弯 halfsphere - Vercel Cron 每小时同步任务
 * GET /api/cron/hourly
 * 遍历所有用户的所有 providers，拉取 usage 数据并写入数据库
 * 必须通过 Authorization: Bearer ${CRON_SECRET} header 鉴权
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/crypto";
import * as openaiProvider from "@/lib/providers/openai";
import * as anthropicProvider from "@/lib/providers/anthropic";
import * as newApiProvider from "@/lib/providers/new-api";

/* timing-safe comparison helper */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const PROVIDER_FETCHERS: Record<string, typeof openaiProvider.fetchUsage> = {
  openai: openaiProvider.fetchUsage,
  anthropic: anthropicProvider.fetchUsage,
  "new-api": newApiProvider.fetchUsage,
};

export async function GET(request: NextRequest) {
  try {
    // 鉴权：验证 CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
      console.error("CRON_SECRET 环境变量未设置");
      return NextResponse.json(
        { error: "CRON_SECRET 未配置" },
        { status: 500 }
      );
    }

    const expectedBearer = `Bearer ${expectedSecret}`;
    if (!authHeader || !timingSafeCompare(authHeader, expectedBearer)) {
      return NextResponse.json(
        { error: "未授权" },
        { status: 401 }
      );
    }

    const supabase = createAdminClient();

    // 获取所有用户（使用 service role 绕过 RLS）
    const { data: providers, error: providersError } = await supabase
      .from("providers")
      .select("id, user_id, name, endpoint_url, api_key_encrypted, api_key_iv, api_key_tag")
      .order("user_id");

    if (providersError) {
      console.error("查询所有 providers 失败:", providersError);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json({ message: "没有配置任何 provider" });
    }

    const today = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 只同步最近 2 天，减少 API 调用
      .toISOString()
      .split("T")[0];

    const results: Array<{
      user_id: string;
      provider: string;
      status: "success" | "error";
      count?: number;
      error?: string;
    }> = [];

    for (const provider of providers) {
      const fetcher = PROVIDER_FETCHERS[provider.name];
      if (!fetcher) {
        results.push({
          user_id: provider.user_id,
          provider: provider.name,
          status: "error",
          error: `不支持的 provider: ${provider.name}`,
        });
        continue;
      }

      try {
        // 解密 API Key
        const apiKey = decrypt(
          provider.api_key_encrypted,
          provider.api_key_iv,
          provider.api_key_tag
        );

        // 拉取 usage 数据
        const snapshots = await fetcher(apiKey, startDate, today, {
          endpoint_url: provider.endpoint_url ?? undefined,
        });

        // 写入数据库（UPSERT）
        const upsertErrors: string[] = [];
        for (const snapshot of snapshots) {
          const { error: upsertError } = await supabase
            .from("usage_snapshots")
            .upsert(
              {
                user_id: provider.user_id,
                provider_id: provider.id,
                date: snapshot.date,
                model: snapshot.model,
                input_tokens: snapshot.input_tokens,
                output_tokens: snapshot.output_tokens,
                cost_usd: snapshot.cost_usd,
                raw_data: snapshot.raw as Record<string, unknown>,
                synced_at: new Date().toISOString(),
              },
              {
                onConflict: "user_id, provider_id, date, model",
              }
            );

          if (upsertError) {
            const err = `${snapshot.date} ${snapshot.model}`;
            console.error(
              `Cron UPSERT 失败: ${provider.name} ${err}`,
              upsertError
            );
            upsertErrors.push(err);
          }
        }

        if (upsertErrors.length > 0) {
          results.push({
            user_id: provider.user_id,
            provider: provider.name,
            status: "error",
            error: `${upsertErrors.length}/${snapshots.length} upserts failed`,
          });
        } else {
          results.push({
            user_id: provider.user_id,
            provider: provider.name,
            status: "success",
            count: snapshots.length,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Cron 同步 ${provider.name} 失败:`, errorMsg);
        results.push({
          user_id: provider.user_id,
          provider: provider.name,
          status: "error",
          error: errorMsg,
        });
      }
    }

    return NextResponse.json({
      cron_at: new Date().toISOString(),
      total_providers: providers.length,
      results,
    });
  } catch (err) {
    console.error("GET /api/cron/hourly 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
