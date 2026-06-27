/**
 * 穹弯 halfsphere - Supabase 客户端（服务端）
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

const isProd = process.env.NODE_ENV === "production";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                httpOnly: true,
                secure: isProd,
                sameSite: "lax",
                /* 7 days in production, session in dev */
                maxAge: isProd ? 60 * 60 * 24 * 7 : undefined,
              });
            });
          } catch {
            // setAll 在 Server Component 中可能抛出错误
            // 中间件会处理 cookie 刷新
          }
        },
      },
    }
  );
}
