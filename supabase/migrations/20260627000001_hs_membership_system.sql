-- 穹弯 / HalfSphere membership command center
-- Central authority for product access, plans, features, subscriptions, and audit events.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.hs_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]+$'),
    name TEXT NOT NULL,
    public_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.hs_membership_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code TEXT NOT NULL REFERENCES public.hs_products(code) ON UPDATE CASCADE ON DELETE CASCADE,
    code TEXT NOT NULL CHECK (code ~ '^[a-z0-9_]+$'),
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_interval TEXT NOT NULL DEFAULT 'manual' CHECK (billing_interval IN ('manual', 'month', 'year', 'lifetime')),
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_code, code)
);

CREATE TABLE IF NOT EXISTS public.hs_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    product_code TEXT NOT NULL REFERENCES public.hs_products(code) ON UPDATE CASCADE ON DELETE RESTRICT,
    plan_id UUID REFERENCES public.hs_membership_plans(id) ON DELETE SET NULL,
    plan_code TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'inactive', 'past_due', 'cancelled', 'expired')),
    source TEXT NOT NULL DEFAULT 'manual',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ,
    granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_code)
);

CREATE TABLE IF NOT EXISTS public.hs_membership_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    product_code TEXT REFERENCES public.hs_products(code) ON UPDATE CASCADE ON DELETE SET NULL,
    plan_code TEXT,
    event_type TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hs_membership_plans_product ON public.hs_membership_plans(product_code, is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_hs_subscriptions_user_product ON public.hs_subscriptions(user_id, product_code);
CREATE INDEX IF NOT EXISTS idx_hs_subscriptions_product_status ON public.hs_subscriptions(product_code, status);
CREATE INDEX IF NOT EXISTS idx_hs_membership_events_product_created ON public.hs_membership_events(product_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hs_membership_events_user_created ON public.hs_membership_events(user_id, created_at DESC);

CREATE OR REPLACE VIEW public.hs_current_memberships AS
SELECT
    s.id AS subscription_id,
    s.user_id,
    s.product_code,
    p.name AS product_name,
    p.public_name AS product_public_name,
    s.plan_id,
    COALESCE(mp.code, s.plan_code) AS plan_code,
    mp.name AS plan_name,
    s.status AS subscription_status,
    (s.status IN ('active', 'trialing') AND (s.current_period_end IS NULL OR s.current_period_end > NOW())) AS subscription_active,
    s.current_period_start,
    s.current_period_end,
    COALESCE(mp.features, '{}'::jsonb) AS features,
    COALESCE(s.metadata, '{}'::jsonb) AS metadata,
    s.granted_by,
    s.created_at,
    s.updated_at
FROM public.hs_subscriptions s
JOIN public.hs_products p ON p.code = s.product_code
LEFT JOIN public.hs_membership_plans mp ON mp.id = s.plan_id;

CREATE OR REPLACE FUNCTION public.hs_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_tiers
    WHERE user_id = auth.uid()
      AND tier IN ('admin', 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

DROP TRIGGER IF EXISTS update_hs_products_updated_at ON public.hs_products;
CREATE TRIGGER update_hs_products_updated_at BEFORE UPDATE ON public.hs_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hs_membership_plans_updated_at ON public.hs_membership_plans;
CREATE TRIGGER update_hs_membership_plans_updated_at BEFORE UPDATE ON public.hs_membership_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_hs_subscriptions_updated_at ON public.hs_subscriptions;
CREATE TRIGGER update_hs_subscriptions_updated_at BEFORE UPDATE ON public.hs_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hs_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hs_membership_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hs products visible" ON public.hs_products;
CREATE POLICY "hs products visible" ON public.hs_products FOR SELECT TO anon, authenticated USING (is_active = TRUE OR public.hs_is_admin());

DROP POLICY IF EXISTS "hs plans visible" ON public.hs_membership_plans;
CREATE POLICY "hs plans visible" ON public.hs_membership_plans FOR SELECT TO anon, authenticated USING (is_active = TRUE OR public.hs_is_admin());

DROP POLICY IF EXISTS "hs subscriptions own or admin" ON public.hs_subscriptions;
CREATE POLICY "hs subscriptions own or admin" ON public.hs_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.hs_is_admin());

DROP POLICY IF EXISTS "hs events own or admin" ON public.hs_membership_events;
CREATE POLICY "hs events own or admin" ON public.hs_membership_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.hs_is_admin());

DROP POLICY IF EXISTS "hs products admin manage" ON public.hs_products;
CREATE POLICY "hs products admin manage" ON public.hs_products FOR ALL TO authenticated USING (public.hs_is_admin()) WITH CHECK (public.hs_is_admin());

DROP POLICY IF EXISTS "hs plans admin manage" ON public.hs_membership_plans;
CREATE POLICY "hs plans admin manage" ON public.hs_membership_plans FOR ALL TO authenticated USING (public.hs_is_admin()) WITH CHECK (public.hs_is_admin());

DROP POLICY IF EXISTS "hs subscriptions admin manage" ON public.hs_subscriptions;
CREATE POLICY "hs subscriptions admin manage" ON public.hs_subscriptions FOR ALL TO authenticated USING (public.hs_is_admin()) WITH CHECK (public.hs_is_admin());

DROP POLICY IF EXISTS "hs events admin insert" ON public.hs_membership_events;
CREATE POLICY "hs events admin insert" ON public.hs_membership_events FOR INSERT TO authenticated WITH CHECK (public.hs_is_admin());

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.hs_products, public.hs_membership_plans, public.hs_current_memberships TO anon, authenticated;
GRANT SELECT ON public.hs_subscriptions, public.hs_membership_events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hs_products, public.hs_membership_plans, public.hs_subscriptions TO authenticated;
GRANT INSERT ON public.hs_membership_events TO authenticated;
INSERT INTO public.hs_products (code, name, public_name, description, sort_order) VALUES
  ('halfsphere', 'HalfSphere', '穹弯', 'Internal operating center and authority plane.', 10),
  ('gyenbox', 'GyenBox', 'GyenBox', 'Storage, sync, sharing, and device membership.', 20),
  ('gsyen', 'GSYEN', 'GSYEN', 'AI workspace and model workflow membership.', 30),
  ('sgsyen', 'SGSYEN', 'SGSYEN', 'Reports, downloads, and audit membership.', 40),
  ('msir_prism', 'MSIR Prism', 'MSIR Prism', 'Quant Lab, DGWM, backtest, and AI analysis membership.', 50)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  public_name = EXCLUDED.public_name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.hs_membership_plans (product_code, code, name, description, price_cents, billing_interval, features, sort_order) VALUES
  ('halfsphere', 'operator', 'Operator', 'Internal operator access.', 0, 'manual', '{"provider_key_management": true, "budget_control": true, "membership_admin": false}'::jsonb, 10),
  ('halfsphere', 'admin', 'Admin', 'Internal membership and platform admin.', 0, 'manual', '{"provider_key_management": true, "budget_control": true, "membership_admin": true, "manual_grants": true}'::jsonb, 20),
  ('gyenbox', 'free', 'Free', 'Starter storage and web upload.', 0, 'month', '{"web_upload": true, "desktop_sync": false, "ai_search": false, "storage_gb": 10, "max_devices": 1}'::jsonb, 10),
  ('gyenbox', 'plus', 'Plus', 'Personal sync and larger storage.', 900, 'month', '{"web_upload": true, "desktop_sync": true, "ai_search": false, "share_links": true, "storage_gb": 100, "max_devices": 3}'::jsonb, 20),
  ('gyenbox', 'professional', 'Professional', 'AI search and professional storage.', 1900, 'month', '{"web_upload": true, "desktop_sync": true, "ai_search": true, "share_links": true, "version_history_days": 30, "storage_gb": 1024, "max_devices": 10}'::jsonb, 30),
  ('gsyen', 'free', 'Free', 'Basic AI workspace access.', 0, 'month', '{"ai_chat": true, "advanced_models": false, "monthly_ai_credits": 500, "workspace_count": 1, "export": true}'::jsonb, 10),
  ('gsyen', 'professional', 'Professional', 'Advanced models and workflows.', 2900, 'month', '{"ai_chat": true, "advanced_models": true, "monthly_ai_credits": 5000, "workspace_count": 10, "export": true}'::jsonb, 20),
  ('sgsyen', 'member', 'Member', 'Member report access.', 0, 'manual', '{"report_access": true, "pdf_download": false, "daily_report_downloads": 3}'::jsonb, 10),
  ('sgsyen', 'auditor', 'Auditor', 'Audit and download access.', 0, 'manual', '{"report_access": true, "pdf_download": true, "audit_log": true, "daily_report_downloads": 20}'::jsonb, 20),
  ('msir_prism', 'free', 'Free', 'Quant Lab starter access.', 0, 'month', '{"quant_lab": true, "model_registry": true, "runtime_diagnostic": false, "backtest": false, "monthly_ai_tokens": 10000, "max_watchlist_symbols": 8}'::jsonb, 10),
  ('msir_prism', 'quant_pro', 'Quant Pro', 'DGWM runtime, backtest, and full Quant Lab.', 3900, 'month', '{"quant_lab": true, "model_registry": true, "runtime_diagnostic": true, "backtest": true, "monthly_ai_tokens": 100000, "max_watchlist_symbols": 20}'::jsonb, 20)
ON CONFLICT (product_code, code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_cents = EXCLUDED.price_cents,
  billing_interval = EXCLUDED.billing_interval,
  features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE,
  updated_at = NOW();