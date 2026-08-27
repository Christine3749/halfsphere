-- 穹弯 halfsphere - 注册申请 + 用户等级系统

-- ============================================
-- registration_requests: 注册申请表
-- ============================================
CREATE TABLE IF NOT EXISTS public.registration_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_registration_requests_email ON public.registration_requests(email) WHERE status = 'pending';

-- RLS
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- 任何人可以提交申请
CREATE POLICY "允许匿名提交申请"
    ON public.registration_requests
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- 登录用户只能按 JWT 邮箱查看自己的申请；匿名用户不可读取申请人 PII。
CREATE POLICY "用户可以查看自己的申请"
    ON public.registration_requests
    FOR SELECT
    TO authenticated
    USING (
      lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    );

-- ============================================
-- user_tiers: 用户等级表
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_tiers (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tier TEXT NOT NULL DEFAULT 'user' CHECK (tier IN ('guest', 'user', 'admin')),
    permissions JSONB DEFAULT '[]',
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "用户只能查看自己的等级"
    ON public.user_tiers
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Role and permission changes are privileged server-side operations. Granting
-- self UPDATE here would let a user promote their own tier to admin/owner.

-- ============================================
-- 触发器：新用户注册时自动创建 user 等级记录
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_tier()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_tiers (user_id, tier)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_tier
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_tier();

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================
CREATE TRIGGER update_registration_requests_updated_at
    BEFORE UPDATE ON public.registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_tiers_updated_at
    BEFORE UPDATE ON public.user_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 权限
-- ============================================
GRANT INSERT, SELECT ON public.registration_requests TO authenticated;
GRANT SELECT ON public.user_tiers TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
