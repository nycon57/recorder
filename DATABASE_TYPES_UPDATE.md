# Database Types Update Summary

**Date**: 2025-10-14  
**File Updated**: `/Users/jarrettstanley/Desktop/websites/recorder/lib/types/database.ts`

## Summary

Successfully generated and updated TypeScript types for the database schema, incorporating all new organization management tables and enhanced fields.

## New Helper Types Added

1. **UserStatus** = `'active' | 'inactive' | 'pending' | 'suspended'`
   - Tracks user account status

2. **Visibility** = `'private' | 'department' | 'org' | 'public'`
   - Content visibility levels for granular access control

3. **WebhookStatus** = `'healthy' | 'degraded' | 'failing' | 'disabled'`
   - Webhook health status tracking

## Enhanced Existing Tables

### organizations (18 new fields)
- **Billing**: `billing_email`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`
- **Branding**: `logo_url`, `primary_color`, `domain`
- **Features/Limits**: `features`, `max_users`, `max_storage_gb`
- **Metadata**: `onboarded_at`, `deleted_at`

### users (17 new fields)
- **Profile**: `title`, `department_id`, `bio`, `phone`, `timezone`
- **Onboarding**: `invitation_token`, `invitation_expires_at`, `invited_by`, `onboarded_at`, `status`
- **Activity**: `last_login_at`, `last_active_at`, `login_count`
- **Preferences**: `notification_preferences`, `ui_preferences`
- **Soft Delete**: `deleted_at`

## New Tables Added

### 1. departments
Hierarchical department structure for organizing users and content.

**Key Fields**:
- `parent_id`: For hierarchical structure
- `slug`: URL-friendly identifier
- `default_visibility`: Default content visibility for the department

### 2. user_departments
Many-to-many junction table linking users to departments.

**Key Fields**:
- `user_id`, `department_id`
- Supports users belonging to multiple departments

### 3. audit_logs
Comprehensive activity tracking for compliance and security.

**Key Fields**:
- `action`, `resource_type`, `resource_id`
- `old_values`, `new_values`: Change tracking
- `ip_address`, `user_agent`, `request_id`: Request context

### 4. user_sessions
Track active user sessions for security monitoring.

**Key Fields**:
- `session_token`, `clerk_session_id`
- Device/browser info: `device_type`, `browser`, `os`
- `location`: Geolocation data (JSONB)
- `expires_at`, `revoked_at`

### 5. user_invitations
Manage user invitations and onboarding flow.

**Key Fields**:
- `email`, `role`, `token`
- `department_ids`: Array of departments to assign
- `status`: `'pending' | 'accepted' | 'expired' | 'revoked'`
- `custom_message`: Personalized invitation message

### 6. content_permissions
Granular access control for content across the platform.

**Key Fields**:
- `resource_type`, `resource_id`: What resource this applies to
- `visibility`: Base visibility level
- `department_ids`, `allowed_user_ids`: Specific access grants
- `can_view`, `can_edit`, `can_delete`, `can_share`: Granular permissions

### 7. api_keys
Organization API keys for programmatic access.

**Key Fields**:
- `key_prefix`, `key_hash`: Secure key storage
- `scopes`: Array of permission scopes
- `rate_limit`: Requests per hour
- `ip_whitelist`: Optional IP restrictions
- `status`: `'active' | 'revoked' | 'expired'`

### 8. org_webhooks
Organization webhook configurations for event notifications.

**Key Fields**:
- `url`, `secret`: Webhook endpoint and HMAC secret
- `events`: Array of subscribed event types
- `retry_enabled`, `max_retries`, `timeout_ms`
- `status`: WebhookStatus type
- **Statistics**: `total_deliveries`, `successful_deliveries`, `failed_deliveries`, `consecutive_failures`

### 9. webhook_deliveries
Track individual webhook delivery attempts and outcomes.

**Key Fields**:
- `webhook_id`, `event_type`, `payload`
- `attempt_number`: Retry tracking
- `response_status_code`, `response_body`, `error_message`
- `duration_ms`: Performance tracking
- `next_retry_at`: Exponential backoff scheduling

## Type Safety

All types include:
- **Row**: Complete row structure (for SELECT queries)
- **Insert**: Fields for INSERT operations (optional IDs, defaults)
- **Update**: Fields for UPDATE operations (all optional except where constrained)

## Verification

The updated types file:
- Contains **1,277 lines** of type-safe TypeScript definitions
- Successfully passes TypeScript compilation
- Includes all 9 new tables from migrations 030-038
- Includes all enhanced fields for organizations and users tables
- Maintains backward compatibility with existing code

## Migration Reference

New tables correspond to these migrations:
- `030_enhance_organizations_table.sql`
- `031_create_departments_table.sql`
- `032_enhance_users_table.sql`
- `033_create_audit_logs_table.sql`
- `034_create_user_sessions_table.sql`
- `035_create_user_invitations_table.sql`
- `036_create_content_permissions_table.sql`
- `037_create_api_keys_table.sql`
- `038_create_org_webhooks_table.sql`

## Next Steps

1. Apply migrations to your Supabase project:
   ```bash
   supabase db push
   ```

2. Import types in your code:
   ```typescript
   import { Database, UserStatus, Visibility, WebhookStatus } from '@/lib/types/database';
   
   type User = Database['public']['Tables']['users']['Row'];
   type Department = Database['public']['Tables']['departments']['Row'];
   type Webhook = Database['public']['Tables']['org_webhooks']['Row'];
   ```

3. Use the new helper types for type-safe status checks:
   ```typescript
   const userStatus: UserStatus = 'active';
   const visibility: Visibility = 'department';
   const webhookStatus: WebhookStatus = 'healthy';
   ```

## File Location

**Updated File**: `/Users/jarrettstanley/Desktop/websites/recorder/lib/types/database.ts`
