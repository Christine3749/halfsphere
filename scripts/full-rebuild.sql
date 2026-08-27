-- ============================================
-- 穹弯 halfsphere - 完整数据库重建脚本
-- 自动备份 → 删表 → 重建 → 恢复数据
-- ============================================

-- QUARANTINED: 默认执行必定失败。仅在已取得用户对本次数据破坏的明确批准、
-- 已验证离线备份 SHA-256、并确认目标数据库名称后，才可在同一会话中设置：
--   SET halfsphere.destructive_rebuild_approval = 'FULL_REBUILD_ACKNOWLEDGED';
--   SET halfsphere.expected_database = '<current_database() 的精确值>';
--   SET halfsphere.verified_backup_sha256 = '<64 位小写 SHA-256>';
--   SET halfsphere.change_id = 'HS-YYYYMMDD-<审批记录>';
-- 此门禁只防止误执行，不替代备份恢复演练、变更审批或数据校验。
BEGIN;

DO $halfsphere_destructive_guard$
DECLARE
    expected_database TEXT := current_setting('halfsphere.expected_database', true);
    approval TEXT := current_setting('halfsphere.destructive_rebuild_approval', true);
    backup_sha256 TEXT := current_setting('halfsphere.verified_backup_sha256', true);
    change_id TEXT := current_setting('halfsphere.change_id', true);
BEGIN
    IF approval IS DISTINCT FROM 'FULL_REBUILD_ACKNOWLEDGED' THEN
        RAISE EXCEPTION 'full-rebuild.sql is quarantined: explicit approval is absent';
    END IF;
    IF expected_database IS NULL OR expected_database <> current_database() THEN
        RAISE EXCEPTION 'full-rebuild.sql target mismatch: expected %, connected %',
            expected_database, current_database();
    END IF;
    IF backup_sha256 IS NULL OR backup_sha256 !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'full-rebuild.sql requires a verified lowercase SHA-256 backup hash';
    END IF;
    IF change_id IS NULL OR change_id !~ '^HS-[0-9]{8}-[A-Za-z0-9._-]+$' THEN
        RAISE EXCEPTION 'full-rebuild.sql requires an approved HS change id';
    END IF;
END
$halfsphere_destructive_guard$;

-- ============================================
-- 1. 自动备份所有表数据（表不存在则跳过）
-- ============================================
DO $$
DECLARE
    tables TEXT[] := ARRAY['providers', 'usage_snapshots', 'budgets', 'registration_requests', 'user_tiers', 'network_nodes', 'network_snapshots'];
    t TEXT;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            EXECUTE format('DROP TABLE IF EXISTS public.%I_backup', t);
            EXECUTE format('CREATE TABLE public.%I_backup AS SELECT * FROM public.%I', t, t);
        END IF;
    END LOOP;
END $$;

-- ============================================
-- 2. 删除 auth.users 上的触发器
-- ============================================
DROP TRIGGER IF EXISTS on_auth_user_created_tier ON auth.users;

-- ============================================
-- 3. 删除所有表（按外键依赖顺序，CASCADE 清理关联）
-- ============================================
DROP TABLE IF EXISTS public.usage_snapshots CASCADE;
DROP TABLE IF EXISTS public.network_snapshots CASCADE;
DROP TABLE IF EXISTS public.providers CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.registration_requests CASCADE;
DROP TABLE IF EXISTS public.user_tiers CASCADE;
DROP TABLE IF EXISTS public.network_nodes CASCADE;

-- ============================================
-- 4. 公共函数
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user_tier()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_tiers (user_id, tier)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 5. 创建 providers 表
-- ============================================
CREATE TABLE public.providers (
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

CREATE UNIQUE INDEX idx_providers_user_name ON public.providers(user_id, name);
CREATE INDEX idx_providers_user_id ON public.providers(user_id);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers_self" ON public.providers FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.providers TO authenticated;

CREATE TRIGGER update_providers_updated_at
    BEFORE UPDATE ON public.providers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. 创建 budgets 表
-- ============================================
CREATE TABLE public.budgets (
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

CREATE UNIQUE INDEX idx_budgets_user_id ON public.budgets(user_id);

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_self" ON public.budgets FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.budgets TO authenticated;

CREATE TRIGGER update_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 7. 创建 registration_requests 表
-- ============================================
CREATE TABLE public.registration_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_registration_requests_email ON public.registration_requests(email) WHERE status = 'pending';

ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert_requests" ON public.registration_requests FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "registration_requests_self_select" ON public.registration_requests FOR SELECT TO authenticated
  USING (lower(email) = lower(COALESCE(auth.jwt() ->> 'email', '')));

GRANT INSERT, SELECT ON public.registration_requests TO authenticated;

CREATE TRIGGER update_registration_requests_updated_at
    BEFORE UPDATE ON public.registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 8. 创建 user_tiers 表（修复后的结构）
-- ============================================
CREATE TABLE public.user_tiers (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'user' CHECK (tier IN ('guest', 'user', 'admin', 'owner')),
    permissions JSONB DEFAULT '[]',
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    upgraded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_tiers_self_select" ON public.user_tiers FOR SELECT TO authenticated USING (auth.uid() = user_id);

GRANT SELECT ON public.user_tiers TO authenticated;

CREATE TRIGGER update_user_tiers_updated_at
    BEFORE UPDATE ON public.user_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER on_auth_user_created_tier
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_tier();

-- ============================================
-- 9. 创建 network_nodes 表
-- ============================================
CREATE TABLE public.network_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    host_encrypted TEXT NOT NULL,
    host_iv TEXT NOT NULL,
    host_tag TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 443,
    protocol TEXT NOT NULL DEFAULT 'vmess' CHECK (protocol IN ('vmess', 'vless', 'shadowsocks', 'trojan', 'hysteria')),
    region TEXT DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_network_nodes_user_name ON public.network_nodes(user_id, name);
CREATE INDEX idx_network_nodes_user_id ON public.network_nodes(user_id);

ALTER TABLE public.network_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "network_nodes_self" ON public.network_nodes FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.network_nodes TO authenticated;

CREATE TRIGGER update_network_nodes_updated_at
    BEFORE UPDATE ON public.network_nodes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 10. 创建 usage_snapshots 表
-- ============================================
CREATE TABLE public.usage_snapshots (
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

CREATE UNIQUE INDEX idx_usage_snapshots_unique ON public.usage_snapshots(user_id, provider_id, date, model);
CREATE INDEX idx_usage_snapshots_user_date ON public.usage_snapshots(user_id, date DESC);
CREATE INDEX idx_usage_snapshots_provider ON public.usage_snapshots(provider_id);

ALTER TABLE public.usage_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_snapshots_self" ON public.usage_snapshots FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.usage_snapshots TO authenticated;

-- ============================================
-- 11. 创建 network_snapshots 表
-- ============================================
CREATE TABLE public.network_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES public.network_nodes(id) ON DELETE CASCADE,
    latency_ms INTEGER,
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('online', 'slow', 'offline', 'unknown')),
    download_speed_mbps NUMERIC(8,2),
    upload_speed_mbps NUMERIC(8,2),
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_network_snapshots_node ON public.network_snapshots(node_id, checked_at DESC);
CREATE INDEX idx_network_snapshots_user_date ON public.network_snapshots(user_id, checked_at DESC);

ALTER TABLE public.network_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "network_snapshots_self" ON public.network_snapshots FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.network_snapshots TO authenticated;

-- ============================================
-- 12. 通用 schema 授权
-- ============================================
GRANT USAGE ON SCHEMA public TO authenticated;

-- ============================================
-- 13. 恢复数据（按外键依赖顺序）
-- ============================================
DO $$
BEGIN
    -- providers 先恢复（被 usage_snapshots 引用）
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'providers_backup') THEN
        INSERT INTO public.providers SELECT * FROM public.providers_backup ON CONFLICT (id) DO NOTHING;
    END IF;

    -- budgets, registration_requests, user_tiers, network_nodes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'budgets_backup') THEN
        INSERT INTO public.budgets SELECT * FROM public.budgets_backup ON CONFLICT (id) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registration_requests_backup') THEN
        INSERT INTO public.registration_requests SELECT * FROM public.registration_requests_backup ON CONFLICT (id) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_tiers_backup') THEN
        INSERT INTO public.user_tiers (user_id, tier, permissions, granted_by, upgraded_at, created_at, updated_at)
        SELECT 
            user_id,
            CASE 
                WHEN tier IN ('free', 'pro') THEN 'user'
                WHEN tier IN ('guest', 'user', 'admin', 'owner') THEN tier
                ELSE 'user'
            END,
            COALESCE(permissions, '[]'::jsonb),
            granted_by,
            upgraded_at,
            COALESCE(created_at, NOW()),
            COALESCE(updated_at, NOW())
        FROM public.user_tiers_backup
        ON CONFLICT (user_id) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'network_nodes_backup') THEN
        INSERT INTO public.network_nodes SELECT * FROM public.network_nodes_backup ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 最后恢复引用其他 public 表的
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_snapshots_backup') THEN
        INSERT INTO public.usage_snapshots SELECT * FROM public.usage_snapshots_backup ON CONFLICT (id) DO NOTHING;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'network_snapshots_backup') THEN
        INSERT INTO public.network_snapshots SELECT * FROM public.network_snapshots_backup ON CONFLICT (id) DO NOTHING;
    END IF;
END $$;

-- ============================================
-- 14. 管理员/owner 由受审计的引导流程授予，不在迁移中硬编码。
-- ============================================

-- ============================================
-- 15. 清理备份表（确认一切正常后手动取消注释执行）
-- ============================================
-- DROP TABLE IF EXISTS public.providers_backup;
-- DROP TABLE IF EXISTS public.usage_snapshots_backup;
-- DROP TABLE IF EXISTS public.budgets_backup;
-- DROP TABLE IF EXISTS public.registration_requests_backup;
-- DROP TABLE IF EXISTS public.user_tiers_backup;
-- DROP TABLE IF EXISTS public.network_nodes_backup;
-- DROP TABLE IF EXISTS public.network_snapshots_backup;

COMMIT;
