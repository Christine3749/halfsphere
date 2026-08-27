-- Add the owner tier. Owner assignment is an audited bootstrap operation and
-- must not be tied to a hard-coded email address in a migration.

-- 1. Drop old inline CHECK constraint safely
DO $migration$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.user_tiers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%tier%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.user_tiers DROP CONSTRAINT %I', constraint_name);
    END IF;
END
$migration$;

-- 2. Add new CHECK constraint with owner
ALTER TABLE public.user_tiers
  ADD CONSTRAINT user_tiers_tier_check
  CHECK (tier IN ('guest', 'user', 'admin', 'owner'));

COMMENT ON COLUMN public.user_tiers.tier IS '角色：guest | user | admin | owner';
