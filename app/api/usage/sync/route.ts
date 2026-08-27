/**
 * 穹弯 halfsphere - 手动触发 Usage 同步
 * POST /api/usage/sync
 * 遍历当前用户的所有 providers，调用对应 fetcher 拉取数据并写入数据库
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/crypto";
import * as openaiProvider from "@/lib/providers/openai";
import * as anthropicProvider from "@/lib/providers/anthropic";
import * as newApiProvider from "@/lib/providers/new-api";

const PROVIDER_FETCHERS: Record<
  string,
  typeof openaiProvider.fetchUsage
> = {
  openai: openaiProvider.fetchUsage,
  anthropic: anthropicProvider.fetchUsage,
  "new-api": newApiProvider.fetchUsage,
};

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    // 获取该用户的所有 providers
    const { data: providers, error: providersError } = await supabase
      .from("providers")
      .select("id, name, endpoint_url, api_key_encrypted, api_key_iv, api_key_tag")
      .eq("user_id", user.id);

    if (providersError) {
      console.error("查询 providers 失败:", providersError);
      return NextResponse.json({ error: "查询失败" }, { status: 500 });
    }

    if (!providers || providers.length === 0) {
      return NextResponse.json({ message: "没有配置任何 provider" });
    }

    const today = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const results: Array<{
      provider: string;
      status: "success" | "error";
      count?: number;
      error?: string;
    }> = [];

    for (const provider of providers) {
      const fetcher = PROVIDER_FETCHERS[provider.name];
      if (!fetcher) {
        results.push({
          provider: provider.name,
          status: "error",
          error: `暂不支持同步 provider: ${provider.name}`,
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
                user_id: user.id,
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
              `UPSERT 失败: ${provider.name} ${err}`,
              upsertError
            );
            upsertErrors.push(err);
          }
        }

        if (upsertErrors.length > 0) {
          results.push({
            provider: provider.name,
            status: "error",
            error: `${upsertErrors.length}/${snapshots.length} upserts failed`,
          });
        } else {
          results.push({
            provider: provider.name,
            status: "success",
            count: snapshots.length,
          });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`同步 ${provider.name} 失败:`, errorMsg);
        results.push({
          provider: provider.name,
          status: "error",
          error: errorMsg,
        });
      }
    }

    return NextResponse.json({
      synced_at: new Date().toISOString(),
      results,
    });
  } catch (err) {
    console.error("POST /api/usage/sync 异常:", err);
    return NextResponse.json({ error: "服务器内部错误" }, { status: 500 });
  }
}
