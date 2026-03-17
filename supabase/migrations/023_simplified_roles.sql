-- 023: Simplified roles (owner, admin, member)
-- Old roles: admin, closer, lead_gen
-- New roles: owner, admin, member

-- Add new enum values
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'member';

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
