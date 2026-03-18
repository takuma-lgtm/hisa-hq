-- 023: Simplified roles (owner, admin, member)
-- Old roles: admin, closer, lead_gen
-- New roles: owner, admin, member
--
-- NOTE: Must be run in two steps in Supabase SQL Editor.
-- Postgres requires ALTER TYPE ADD VALUE to be committed
-- before the new values can be used in UPDATE statements.

-- ── Step 1: Run this first ──
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'member';

-- ── Step 2: Run this after Step 1 succeeds ──
-- Promote Takuma to owner
UPDATE profiles SET role = 'owner'
WHERE id = (SELECT id FROM auth.users WHERE email = 'takuma@hisamatcha.com');

-- Nina becomes member
UPDATE profiles SET role = 'member'
WHERE id = (SELECT id FROM auth.users WHERE email = 'nina@hisamatcha.com');

-- Tatsumi stays admin (no change needed)

-- Remap any remaining closer/lead_gen users to member
UPDATE profiles SET role = 'member'
WHERE role IN ('closer', 'lead_gen');
