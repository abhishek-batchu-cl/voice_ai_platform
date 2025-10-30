-- Phase 6: Rate Limiting Schema
-- Adds tier information to organizations and rate limit tracking

-- Add tier column to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise', 'custom'));

-- Add rate limit settings to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS rate_limit_per_day INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS concurrent_sessions INTEGER DEFAULT 2;

-- Create rate_limit_events table for monitoring
CREATE TABLE IF NOT EXISTS rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ip_address VARCHAR(45),
  endpoint VARCHAR(255),
  limit_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for rate limit monitoring
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_user ON rate_limit_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_org ON rate_limit_events(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_ip ON rate_limit_events(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_events_created ON rate_limit_events(created_at DESC);

-- Update existing organizations to free tier
UPDATE organizations SET tier = 'free' WHERE tier IS NULL;

-- Comments
COMMENT ON COLUMN organizations.tier IS 'Subscription tier: free, pro, enterprise, custom';
COMMENT ON COLUMN organizations.rate_limit_per_minute IS 'API requests allowed per minute';
COMMENT ON COLUMN organizations.rate_limit_per_day IS 'API requests allowed per day';
COMMENT ON COLUMN organizations.concurrent_sessions IS 'Maximum concurrent WebSocket sessions';
COMMENT ON TABLE rate_limit_events IS 'Tracks rate limit violations for monitoring and analytics';
