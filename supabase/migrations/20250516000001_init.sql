-- 穹弯 halfsphere MVP 数据库初始化
-- 创建时间: 2026-05-16

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- providers 表：存储用户配置的 AI Provider API Key
-- ============================================
CREATE TABLE IF NOT EXISTS public.providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (name IN ('openai', 'anthropic', 'gemini', 'deepseek', 'openrouter')),
    display_name TEXT NOT NULL DEFAULT '',
    api_key_encrypted TEXT NOT NULL,
    api_key_iv TEXT NOT NULL,
    api_key_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 唯一索引：每个用户每种 provider 只能配置一个
CREATE UNIQUE INDEX idx_providers_user_name ON public.providers(user_id, name);

-- 用户级索引
CREATE INDEX idx_providers_user_id ON public.providers(user_id);

-- ============================================
-- usage_snapshots 表：存储每日各模型消耗快照
-- ============================================
CREATE TABLE IF NOT EXISTS public.usage_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    model TEXT NOT NULL,
    input_tokens BIGINT NOT NULL DEFAULT 0,
    output_tokens BIGINT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
    raw_data JSONB,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 唯一索引：同一天同一用户同一 provider 同一模型只有一条记录
CREATE UNIQUE INDEX idx_usage_snapshots_unique ON public.usage_snapshots(user_id, provider_id, date, model);

-- 查询索引
CREATE INDEX idx_usage_snapshots_user_date ON public.usage_snapshots(user_id, date DESC);
CREATE INDEX idx_usage_snapshots_provider ON public.usage_snapshots(provider_id);

-- ============================================
-- budgets 表：存储用户预算配置
-- ============================================
CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    monthly_limit_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
    warn_threshold SMALLINT NOT NULL DEFAULT 80 CHECK (warn_threshold >= 0 AND warn_threshold <= 100),
    alert_threshold SMALLINT NOT NULL DEFAULT 95 CHECK (alert_threshold >= 0 AND alert_threshold <= 100),
    email_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    telegram_chat_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budgets_threshold_order CHECK (warn_threshold < alert_threshold)
);

-- 每个用户只能有一条预算记录
CREATE UNIQUE INDEX idx_budgets_user_id ON public.budgets(user_id);

-- ============================================
-- 权限：给 authenticated 角色授权
-- ============================================
GRANT ALL ON public.providers TO authenticated;
GRANT ALL ON public.usage_snapshots TO authenticated;
GRANT ALL ON public.budgets TO authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- RLS (Row Level Security) 策略
-- ============================================

-- providers 表 RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的 providers"
    ON public.providers
    FOR ALL
    USING (auth.uid() = user_id);

-- usage_snapshots 表 RLS
ALTER TABLE public.usage_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的 usage_snapshots"
    ON public.usage_snapshots
    FOR ALL
    USING (auth.uid() = user_id);

-- budgets 表 RLS
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能访问自己的 budgets"
    ON public.budgets
    FOR ALL
    USING (auth.uid() = user_id);

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON public.providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
