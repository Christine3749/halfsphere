-- 穹弯 halfsphere - 基地 (Base) 网络节点监控

-- ============================================
-- network_nodes: 存储要监控的节点配置
-- ============================================
CREATE TABLE IF NOT EXISTS public.network_nodes (
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

-- RLS
ALTER TABLE public.network_nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能访问自己的节点" ON public.network_nodes FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- network_snapshots: 节点健康快照
-- ============================================
CREATE TABLE IF NOT EXISTS public.network_snapshots (
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

-- RLS
ALTER TABLE public.network_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能访问自己的快照" ON public.network_snapshots FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 触发器
-- ============================================
CREATE TRIGGER update_network_nodes_updated_at
    BEFORE UPDATE ON public.network_nodes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 权限
-- ============================================
GRANT ALL ON public.network_nodes TO authenticated;
GRANT ALL ON public.network_snapshots TO authenticated;
