-- Migration: Create Organization Webhooks Table
-- Description: Manage custom webhook configurations for organizations
-- Date: 2025-10-14

-- Create org_webhooks table
CREATE TABLE org_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Webhook details
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- For HMAC signature verification

  -- Event subscriptions
  events TEXT[] DEFAULT '{}', -- e.g., ['recording.completed', 'document.generated', 'user.created']

  -- Configuration
  enabled BOOLEAN DEFAULT true,
  retry_enabled BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3,
  timeout_ms INTEGER DEFAULT 5000,

  -- Headers (for authentication, custom headers)
  headers JSONB DEFAULT '{}',

  -- Status tracking
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  successful_deliveries INTEGER DEFAULT 0,
  failed_deliveries INTEGER DEFAULT 0,

  -- Health check
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'failing', 'disabled')),

  -- Metadata
  description TEXT,
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create webhook_deliveries table for tracking attempts
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL REFERENCES org_webhooks(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  event_id UUID, -- Reference to the event that triggered this
  payload JSONB NOT NULL,

  -- Delivery attempts
  attempt_number INTEGER DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failure', 'cancelled')),

  -- Response details
  response_status_code INTEGER,
  response_body TEXT,
  response_headers JSONB,
  error_message TEXT,

  -- Timing
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for org_webhooks
CREATE INDEX idx_org_webhooks_org_id ON org_webhooks(org_id);
CREATE INDEX idx_org_webhooks_created_by ON org_webhooks(created_by);
CREATE INDEX idx_org_webhooks_enabled ON org_webhooks(enabled) WHERE enabled = true;
CREATE INDEX idx_org_webhooks_events ON org_webhooks USING GIN (events);
CREATE INDEX idx_org_webhooks_status ON org_webhooks(status);

-- Create indexes for webhook_deliveries
CREATE INDEX idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_org_id ON webhook_deliveries(org_id);
CREATE INDEX idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE status = 'failure' AND next_retry_at IS NOT NULL;
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Add comments
COMMENT ON TABLE org_webhooks IS 'Organization webhook configurations for event notifications';
COMMENT ON COLUMN org_webhooks.secret IS 'Secret key for HMAC signature verification';
COMMENT ON COLUMN org_webhooks.events IS 'Array of event types this webhook subscribes to';
COMMENT ON COLUMN org_webhooks.consecutive_failures IS 'Count of consecutive failed deliveries (resets on success)';

COMMENT ON TABLE webhook_deliveries IS 'Track individual webhook delivery attempts and outcomes';
COMMENT ON COLUMN webhook_deliveries.attempt_number IS 'Retry attempt number (1 = first attempt)';
COMMENT ON COLUMN webhook_deliveries.next_retry_at IS 'When to retry failed delivery (exponential backoff)';

-- Enable RLS
ALTER TABLE org_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies for org_webhooks
-- Admins can read webhooks in their org
CREATE POLICY "Admins can read webhooks"
  ON org_webhooks FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Admins can manage webhooks
CREATE POLICY "Admins can manage webhooks"
  ON org_webhooks FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to org_webhooks"
  ON org_webhooks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for webhook_deliveries
-- Admins can read deliveries in their org
CREATE POLICY "Admins can read webhook deliveries"
  ON webhook_deliveries FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );

-- Service role has full access
CREATE POLICY "Service role has full access to webhook_deliveries"
  ON webhook_deliveries FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to get webhooks for an event
CREATE OR REPLACE FUNCTION get_webhooks_for_event(
  p_org_id UUID,
  p_event_type TEXT
) RETURNS TABLE (
  webhook_id UUID,
  url TEXT,
  secret TEXT,
  headers JSONB,
  retry_enabled BOOLEAN,
  max_retries INTEGER,
  timeout_ms INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.url,
    w.secret,
    w.headers,
    w.retry_enabled,
    w.max_retries,
    w.timeout_ms
  FROM org_webhooks w
  WHERE w.org_id = p_org_id
  AND w.enabled = true
  AND w.status != 'disabled'
  AND p_event_type = ANY(w.events);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Function to record webhook delivery
CREATE OR REPLACE FUNCTION record_webhook_delivery(
  p_webhook_id UUID,
  p_event_type TEXT,
  p_event_id UUID,
  p_payload JSONB,
  p_status TEXT,
  p_response_status_code INTEGER DEFAULT NULL,
  p_response_body TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  delivery_id UUID;
  org_id_val UUID;
BEGIN
  -- Get org_id from webhook
  SELECT org_id INTO org_id_val FROM org_webhooks WHERE id = p_webhook_id;

  -- Insert delivery record
  INSERT INTO webhook_deliveries (
    webhook_id,
    org_id,
    event_type,
    event_id,
    payload,
    status,
    response_status_code,
    response_body,
    error_message,
    duration_ms,
    sent_at,
    completed_at
  ) VALUES (
    p_webhook_id,
    org_id_val,
    p_event_type,
    p_event_id,
    p_payload,
    p_status,
    p_response_status_code,
    p_response_body,
    p_error_message,
    p_duration_ms,
    NOW(),
    CASE WHEN p_status IN ('success', 'failure') THEN NOW() ELSE NULL END
  ) RETURNING id INTO delivery_id;

  -- Update webhook statistics
  UPDATE org_webhooks
  SET
    last_triggered_at = NOW(),
    last_success_at = CASE WHEN p_status = 'success' THEN NOW() ELSE last_success_at END,
    last_failure_at = CASE WHEN p_status = 'failure' THEN NOW() ELSE last_failure_at END,
    consecutive_failures = CASE
      WHEN p_status = 'success' THEN 0
      WHEN p_status = 'failure' THEN consecutive_failures + 1
      ELSE consecutive_failures
    END,
    total_deliveries = total_deliveries + 1,
    successful_deliveries = successful_deliveries + CASE WHEN p_status = 'success' THEN 1 ELSE 0 END,
    failed_deliveries = failed_deliveries + CASE WHEN p_status = 'failure' THEN 1 ELSE 0 END,
    status = CASE
      WHEN p_status = 'success' THEN 'healthy'
      WHEN consecutive_failures >= 3 AND consecutive_failures < 10 THEN 'degraded'
      WHEN consecutive_failures >= 10 THEN 'failing'
      ELSE status
    END
  WHERE id = p_webhook_id;

  RETURN delivery_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create updated_at trigger
CREATE TRIGGER update_org_webhooks_updated_at
  BEFORE UPDATE ON org_webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
