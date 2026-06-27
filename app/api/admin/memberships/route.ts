import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const PRODUCTS = "hs_products";
const PLANS = "hs_membership_plans";
const SUBSCRIPTIONS = "hs_subscriptions";
const EVENTS = "hs_membership_events";

type UserOption = { id: string; email: string; display_name: string; created_at?: string; last_sign_in_at?: string | null };
type PlanRow = { id: string; product_code: string; code: string; name: string };
type ProductRow = { code: string; name: string };
type SubscriptionRow = Record<string, unknown> & {
  user_id: string;
  plan_id: string | null;
  product_code: string;
  plan_code: string;
};
type DbError = { message: string };
type DbResult<T> = { data: T | null; error: DbError | null };
type AuthUserRow = { id: string; email?: string; user_metadata?: { display_name?: string }; created_at?: string; last_sign_in_at?: string | null };
type QueryChain<T> = PromiseLike<DbResult<T>> & {
  select(columns?: string): QueryChain<T>;
  order(column: string, options?: { ascending?: boolean }): QueryChain<T>;
  limit(count: number): QueryChain<T>;
  eq(column: string, value: unknown): QueryChain<T>;
  upsert(row: Record<string, unknown>, options?: { onConflict?: string }): QueryChain<T>;
  update(row: Record<string, unknown>): QueryChain<T>;
  insert(row: Record<string, unknown>): QueryChain<T>;
  single(): Promise<DbResult<T extends Array<infer U> ? U : T>>;
};
type MembershipAdminClient = {
  from<T = Record<string, unknown>[]>(table: string): QueryChain<T>;
  auth: { admin: { listUsers(): Promise<DbResult<{ users: AuthUserRow[] }>> } };
};

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const admin = createAdminClient() as unknown as MembershipAdminClient;
    const [productsRes, plansRes, subscriptionsRes, eventsRes, usersRes] = await Promise.all([
      admin.from<ProductRow[]>(PRODUCTS).select("*").order("sort_order", { ascending: true }).order("code", { ascending: true }),
      admin.from<PlanRow[]>(PLANS).select("*").order("product_code", { ascending: true }).order("sort_order", { ascending: true }),
      admin.from<SubscriptionRow[]>(SUBSCRIPTIONS).select("*").order("updated_at", { ascending: false }),
      admin.from<Record<string, unknown>[]>(EVENTS).select("*").order("created_at", { ascending: false }).limit(80),
      admin.auth.admin.listUsers(),
    ]);

    const dbError = productsRes.error || plansRes.error || subscriptionsRes.error || eventsRes.error || usersRes.error;
    if (dbError) {
      return NextResponse.json({ error: "会员体系读取失败", detail: dbError.message }, { status: 500 });
    }

    const users: UserOption[] = (usersRes.data?.users ?? []).map((user) => ({
      id: user.id,
      email: user.email ?? "",
      display_name: user.user_metadata?.display_name ?? user.email?.split("@")[0] ?? "operator",
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    }));
    const userMap = new Map<string, UserOption>(users.map((user) => [user.id, user]));

    const plans = (plansRes.data ?? []) as PlanRow[];
    const planMap = new Map<string, PlanRow>(plans.map((plan) => [plan.id, plan]));
    const products = (productsRes.data ?? []) as ProductRow[];
    const productMap = new Map<string, ProductRow>(products.map((product) => [product.code, product]));

    const subscriptions = ((subscriptionsRes.data ?? []) as SubscriptionRow[]).map((row) => {
      const user = userMap.get(row.user_id);
      const plan = row.plan_id ? planMap.get(row.plan_id) : undefined;
      const product = productMap.get(row.product_code);
      return {
        ...row,
        user_email: user?.email ?? "unknown",
        user_display_name: user?.display_name ?? "unknown",
        plan_name: plan?.name ?? row.plan_code,
        product_name: product?.name ?? row.product_code,
      };
    });

    return NextResponse.json({
      data: {
        products,
        plans,
        subscriptions,
        events: eventsRes.data ?? [],
        users,
      },
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "会员体系服务异常", detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { user: adminUser, error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const intent = String(body.intent || "");
    const payload = body.payload ?? {};
    const admin = createAdminClient() as unknown as MembershipAdminClient;

    if (intent === "upsert_product") {
      const row = {
        code: normalizeCode(payload.code),
        name: String(payload.name || payload.code || "").trim(),
        public_name: String(payload.public_name || payload.name || payload.code || "").trim(),
        description: String(payload.description || ""),
        is_active: payload.is_active !== false,
        sort_order: numeric(payload.sort_order, 100),
        updated_at: new Date().toISOString(),
      };
      if (!row.code || !row.name) return badRequest("产品 code 和 name 必填");

      const { data, error: dbError } = await admin
        .from(PRODUCTS)
        .upsert(row, { onConflict: "code" })
        .select("*")
        .single();
      if (dbError) return dbFail(dbError);
      await recordEvent(admin, adminUser.id, "product.upserted", { product_code: row.code, detail: row });
      return NextResponse.json({ data });
    }

    if (intent === "upsert_plan") {
      const row = {
        product_code: normalizeCode(payload.product_code),
        code: normalizeCode(payload.code),
        name: String(payload.name || payload.code || "").trim(),
        description: String(payload.description || ""),
        price_cents: numeric(payload.price_cents, 0),
        currency: String(payload.currency || "USD").trim().toUpperCase(),
        billing_interval: String(payload.billing_interval || "manual"),
        features: parseObject(payload.features),
        is_active: payload.is_active !== false,
        sort_order: numeric(payload.sort_order, 100),
        updated_at: new Date().toISOString(),
      };
      if (!row.product_code || !row.code || !row.name) return badRequest("产品、套餐 code 和 name 必填");

      const query = payload.id
        ? admin.from(PLANS).update(row).eq("id", payload.id).select("*").single()
        : admin.from(PLANS).upsert(row, { onConflict: "product_code,code" }).select("*").single();
      const { data, error: dbError } = await query;
      if (dbError) return dbFail(dbError);
      await recordEvent(admin, adminUser.id, "plan.upserted", { product_code: row.product_code, plan_code: row.code, detail: row });
      return NextResponse.json({ data });
    }

    if (intent === "upsert_subscription") {
      const userId = String(payload.user_id || "").trim();
      const planId = String(payload.plan_id || "").trim();
      if (!userId || !planId) return badRequest("用户和套餐必选");

      const { data: plan, error: planError } = await admin
        .from<PlanRow>(PLANS)
        .select("id, product_code, code")
        .eq("id", planId)
        .single();
      if (planError || !plan) return badRequest("套餐不存在");

      const row = {
        user_id: userId,
        product_code: plan.product_code,
        plan_id: plan.id,
        plan_code: plan.code,
        status: String(payload.status || "active"),
        current_period_end: payload.current_period_end ? new Date(payload.current_period_end).toISOString() : null,
        granted_by: adminUser.id,
        source: "halfsphere-admin",
        metadata: parseObject(payload.metadata || {}),
        updated_at: new Date().toISOString(),
      };

      const { data, error: dbError } = await admin
        .from(SUBSCRIPTIONS)
        .upsert(row, { onConflict: "user_id,product_code" })
        .select("*")
        .single();
      if (dbError) return dbFail(dbError);
      await recordEvent(admin, adminUser.id, "subscription.upserted", {
        user_id: userId,
        product_code: plan.product_code,
        plan_code: plan.code,
        detail: { status: row.status, current_period_end: row.current_period_end },
      });
      return NextResponse.json({ data });
    }

    return badRequest("未知会员操作");
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "会员体系写入失败", detail }, { status: 500 });
  }
}

function normalizeCode(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function numeric(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseObject(value: unknown) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {}
  throw new Error("features / metadata 必须是 JSON object");
}

async function recordEvent(
  admin: MembershipAdminClient,
  actorUserId: string,
  eventType: string,
  payload: { user_id?: string; product_code?: string; plan_code?: string; detail?: Record<string, unknown> }
) {
  await admin.from(EVENTS).insert({
    user_id: payload.user_id ?? null,
    actor_user_id: actorUserId,
    product_code: payload.product_code ?? null,
    plan_code: payload.plan_code ?? null,
    event_type: eventType,
    detail: payload.detail ?? {},
  });
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function dbFail(error: { message: string }) {
  return NextResponse.json({ error: "数据库写入失败", detail: error.message }, { status: 500 });
}