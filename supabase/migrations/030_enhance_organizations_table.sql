-- Migration: Enhance Organizations Table
-- Description: Add billing, branding, and feature management fields
-- Date: 2025-10-14

-- Add new columns to organizations table
ALTER TABLE organizations
  -- Billing fields
  ADD COLUMN billing_email TEXT,
  ADD COLUMN stripe_customer_id TEXT UNIQUE,
  ADD COLUMN stripe_subscription_id TEXT UNIQUE,
  ADD COLUMN subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due', 'trialing', 'incomplete', 'incomplete_expired', 'unpaid')),
  ADD COLUMN trial_ends_at TIMESTAMPTZ,

  -- Branding fields
  ADD COLUMN logo_url TEXT,
  ADD COLUMN primary_color TEXT DEFAULT '#3b82f6', -- Default to blue
  ADD COLUMN domain TEXT UNIQUE,

  -- Features and limits
  ADD COLUMN features JSONB DEFAULT '{}',
  ADD COLUMN max_users INTEGER DEFAULT 5, -- Default 5 seats for free plan
  ADD COLUMN max_storage_gb INTEGER DEFAULT 10, -- Default 10GB for free plan

  -- Metadata
  ADD COLUMN onboarded_at TIMESTAMPTZ,
  ADD COLUMN deleted_at TIMESTAMPTZ;

-- Add indexes for performance
CREATE INDEX idx_organizations_stripe_customer_id ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_organizations_domain ON organizations(domain) WHERE domain IS NOT NULL;
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX idx_organizations_deleted_at ON organizations(deleted_at) WHERE deleted_at IS NOT NULL;

-- Update settings field with defaults
UPDATE organizations
SET settings = jsonb_build_object(
  'allow_member_invites', true,
  'default_recording_visibility', 'org',
  'require_2fa', false,
  'enable_api_access', true,
  'enable_webhooks', false,
  'data_retention_days', 0,
  'enable_audit_logs', true
)
WHERE settings = '{}';

-- Add comment for documentation
COMMENT ON COLUMN organizations.billing_email IS 'Email address for billing and invoices';
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing integration';
COMMENT ON COLUMN organizations.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN organizations.subscription_status IS 'Current subscription status from Stripe';
COMMENT ON COLUMN organizations.trial_ends_at IS 'When the trial period ends';
COMMENT ON COLUMN organizations.logo_url IS 'URL to organization logo in Supabase Storage';
COMMENT ON COLUMN organizations.primary_color IS 'Primary brand color (hex code)';
COMMENT ON COLUMN organizations.domain IS 'Custom domain for enterprise customers';
COMMENT ON COLUMN organizations.features IS 'Feature flags and enabled features for this org';
COMMENT ON COLUMN organizations.max_users IS 'Maximum number of users allowed in this organization';
COMMENT ON COLUMN organizations.max_storage_gb IS 'Maximum storage in GB allowed for this organization';
COMMENT ON COLUMN organizations.onboarded_at IS 'When the organization completed onboarding';
COMMENT ON COLUMN organizations.deleted_at IS 'Soft delete timestamp (null = active)';
