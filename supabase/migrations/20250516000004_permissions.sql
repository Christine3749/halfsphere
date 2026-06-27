-- 穹弯 halfsphere — 权限系统升级
-- 角色：guest(游客) → user(普通用户) → admin(管理员)

/* ── 1. 扩展 user_tiers ── */
ALTER TABLE user_tiers
  ADD COLUMN IF NOT EXISTS permissions  JSONB        DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS granted_by   UUID         REFERENCES auth.users(id) ON DELETE SET NULL;

/* 旧数据迁移：free → user，pro → user（后续由管理员手动赋权） */
UPDATE user_tiers SET tier = 'user' WHERE tier IN ('free', 'pro');

/* 硬编码管理员设为 admin */
UPDATE user_tiers SET tier = 'admin' WHERE user_id = '29964ebd-c191-4ddf-ad28-bed931cab458';

/* 给 user_tiers 加 comments */
COMMENT ON COLUMN user_tiers.tier         IS '角色：guest | user | admin';
COMMENT ON COLUMN user_tiers.permissions  IS 'JSONB 权限列表，如 ["base", "fleet", "burning-write"]';
COMMENT ON COLUMN user_tiers.granted_by   IS '授予该权限的管理员 user_id';

/* ── 2. 索引 ── */
CREATE INDEX IF NOT EXISTS idx_user_tiers_tier ON user_tiers(tier);
CREATE INDEX IF NOT EXISTS idx_user_tiers_permissions ON user_tiers USING GIN(permissions);

/* ── 3. 更新触发器：新注册用户默认 user ── */
CREATE OR REPLACE FUNCTION public.handle_new_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_tiers (user_id, tier)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/* 确保触发器存在（idempotent） */
DROP TRIGGER IF EXISTS on_auth_user_created_tier ON auth.users;
CREATE TRIGGER on_auth_user_created_tier
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_tier();

/* ── 4. RLS：user_tiers 表策略调整 ── */
ALTER TABLE user_tiers ENABLE ROW LEVEL SECURITY;

/* 清理旧策略 */
DROP POLICY IF EXISTS user_tiers_admin_all ON user_tiers;
DROP POLICY IF EXISTS user_tiers_self ON user_tiers;
DROP POLICY IF EXISTS "用户只能查看自己的等级" ON user_tiers;
DROP POLICY IF EXISTS "用户不能修改自己的等级" ON user_tiers;

/* 用户只能 SELECT 自己的记录 */
CREATE POLICY user_tiers_self_select ON user_tiers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

/* 用户只能 UPDATE 自己的记录 */
CREATE POLICY user_tiers_self_update ON user_tiers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

/* admin 操作走 service_role key 的服务端代码，不通过前端 RLS */
