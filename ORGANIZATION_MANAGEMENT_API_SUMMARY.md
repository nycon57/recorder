# Organization Management API - Implementation Summary

**Date**: 2025-10-14
**Status**: Complete

## Overview

Implemented comprehensive organization management API routes with role-based access control, quota enforcement, and member management capabilities.

## Created Files

### 1. Validation Schemas
**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/lib/validations/organizations.ts`

Defines Zod validation schemas for:
- `updateOrganizationSchema` - Organization settings updates
- `listMembersQuerySchema` - Member filtering and pagination
- `inviteMemberSchema` - New member invitations
- `updateMemberSchema` - Member role/status updates
- `organizationStatsQuerySchema` - Stats query parameters

### 2. Organization Current Route
**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/current/route.ts`

#### GET `/api/organizations/current`
- **Auth**: Requires org context (`requireOrg`)
- **Returns**: Full organization details including branding, features, quotas
- **Fields**: id, name, slug, plan, logo_url, primary_color, domain, features, settings, billing info

#### PATCH `/api/organizations/current`
- **Auth**: Requires admin+ role (`requireAdmin`)
- **Validates**: Domain uniqueness before update
- **Updates**: name, logo_url, primary_color, domain, features (merged), settings (merged)
- **Returns**: Updated organization object

### 3. Organization Stats Route
**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/stats/route.ts`

#### GET `/api/organizations/stats`
- **Auth**: Requires admin+ role (`requireAdmin`)
- **Query Params**:
  - `include_quotas` (boolean, default: true)
  - `include_usage` (boolean, default: true)

**Returns**:
```typescript
{
  members: { total, quota, percentage },
  recordings: { total },
  storage: { used_gb, quota_gb, percentage },
  departments: { total },
  activity: { active_sessions_24h },
  usage?: { // If include_usage=true
    period,
    minutes_transcribed,
    tokens_in,
    tokens_out,
    queries_count,
    recordings_count
  },
  quotas?: { // If include_quotas=true
    plan,
    max_users,
    max_storage_gb,
    features
  }
}
```

### 4. Member Management Routes

#### Main Route: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/members/route.ts`

##### GET `/api/organizations/members`
- **Auth**: Requires admin+ role
- **Query Params**: role, department_id, status, search, page, limit
- **Filters**: By role, department, status, or search (name/email)
- **Returns**: Paginated member list with metadata

##### POST `/api/organizations/members`
- **Auth**: Requires admin+ role
- **Validates**:
  - Email not already a member
  - No pending invitation exists
  - Organization hasn't reached max_users quota
- **Creates**: User invitation with token (7-day expiration)
- **Returns**: Invitation details + invitation URL
- **TODO**: Email service integration

#### Individual Member Route: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/members/[id]/route.ts`

##### GET `/api/organizations/members/[id]`
- **Auth**: Requires admin+ role
- **Returns**: Full member details including preferences, activity tracking

##### PATCH `/api/organizations/members/[id]`
- **Auth**: Requires admin+ role
- **Role Hierarchy Validation**:
  - Only owner can assign/modify owner role
  - Only owner can modify another owner's role
  - Cannot change own role
  - Ensures at least one owner remains
- **Updates**: role, status, title, department_ids
- **Returns**: Updated member object

##### DELETE `/api/organizations/members/[id]`
- **Auth**: Requires admin+ role
- **Soft Delete**: Sets `deleted_at` and `status='deleted'`
- **Protections**:
  - Cannot remove self
  - Only owner can remove another owner
  - Ensures at least one owner remains
- **TODO**: Session revocation, email notification, recording ownership transfer

## Security Features

### Role-Based Access Control
- **requireOrg()**: Basic org context (all authenticated org members)
- **requireAdmin()**: Admin+ only (owner or admin roles)

### Role Hierarchy Enforcement
1. **Owner** (highest privilege)
   - Can do everything
   - Can assign/modify owner roles
   - Can remove other owners (if >1 owner remains)

2. **Admin**
   - Can manage members (except owners)
   - Can update org settings
   - Cannot assign owner role
   - Cannot modify owner roles

3. **Contributor/Reader** (not org admins)
   - Cannot access these endpoints

### Quota Enforcement
- Max users limit checked on invitation
- Returns `402 QUOTA_EXCEEDED` with details when limit reached
- Storage quota shown in stats endpoint

### Input Validation
- All inputs validated with Zod schemas
- UUID format validation for IDs
- Email format validation
- Domain format validation (regex)
- Hex color validation

### Soft Deletes
- Members marked with `deleted_at` instead of hard delete
- Preserves data integrity for audit trails
- Status set to 'deleted' for filtering

## API Response Patterns

All endpoints follow the standardized response format from `lib/utils/api.ts`:

**Success**:
```typescript
{
  data: T,
  requestId?: string
}
```

**Error**:
```typescript
{
  code: string,
  message: string,
  details?: any,
  requestId?: string
}
```

## Database Tables Used

1. **organizations** - Org details, settings, quotas, branding
2. **users** - Member profiles, roles, activity tracking
3. **user_invitations** - Pending member invitations
4. **departments** - Organization departments (count only)
5. **user_sessions** - Active session tracking
6. **recordings** - For storage calculation
7. **usage_counters** - Monthly usage metrics

## Error Codes

- `400 BAD_REQUEST` - Invalid input or business logic violation
- `401 UNAUTHORIZED` - Not authenticated
- `403 FORBIDDEN` - Insufficient permissions
- `404 NOT_FOUND` - Resource doesn't exist
- `402 QUOTA_EXCEEDED` - Organization limit reached
- `500 INTERNAL_ERROR` - Server error

## Testing Checklist

### Organization Current
- [ ] GET returns org details for member
- [ ] GET returns 403 for non-member
- [ ] PATCH updates org settings (admin+)
- [ ] PATCH prevents domain conflicts
- [ ] PATCH returns 403 for non-admin
- [ ] PATCH merges features/settings correctly

### Organization Stats
- [ ] GET returns accurate member count
- [ ] GET calculates storage usage correctly
- [ ] GET shows quota percentages
- [ ] GET respects include_quotas flag
- [ ] GET respects include_usage flag
- [ ] GET returns 403 for non-admin

### Member Listing
- [ ] GET returns paginated members
- [ ] GET filters by role
- [ ] GET filters by department
- [ ] GET filters by status
- [ ] GET searches by name/email
- [ ] GET returns 403 for non-admin

### Member Invitation
- [ ] POST creates invitation successfully
- [ ] POST prevents duplicate emails
- [ ] POST prevents duplicate pending invitations
- [ ] POST enforces max_users quota
- [ ] POST returns 403 for non-admin
- [ ] POST generates valid token

### Member Details
- [ ] GET returns member details (admin+)
- [ ] GET returns 404 for non-existent member
- [ ] GET returns 403 for non-admin

### Member Update
- [ ] PATCH updates role/status/title
- [ ] PATCH prevents self-role modification
- [ ] PATCH enforces owner-only owner assignment
- [ ] PATCH ensures ≥1 owner remains
- [ ] PATCH returns 403 for non-admin
- [ ] PATCH returns 403 for admin trying to modify owner

### Member Deletion
- [ ] DELETE soft-deletes member
- [ ] DELETE prevents self-deletion
- [ ] DELETE ensures ≥1 owner remains
- [ ] DELETE requires owner to remove owner
- [ ] DELETE returns 403 for non-admin

## Future Enhancements

1. **Email Service Integration**
   - Send invitation emails
   - Send removal notifications
   - Send role change notifications

2. **Session Management**
   - Revoke all sessions on member removal
   - Track invitation acceptance via sessions

3. **Audit Logging**
   - Log all org/member changes to `audit_logs`
   - Include IP, user agent, request ID

4. **Recording Ownership Transfer**
   - Transfer recordings when member removed
   - Handle orphaned content

5. **Bulk Operations**
   - Bulk member import
   - Bulk role updates
   - Bulk invitation sending

6. **Department Management**
   - Full CRUD for departments
   - Hierarchical department structure
   - Department-based permissions

7. **Advanced Invitation Features**
   - Resend invitation
   - Revoke invitation
   - Custom expiration periods
   - Reminder emails

## Migration Dependencies

This implementation depends on these migrations being applied:

1. `030_enhance_organizations_table.sql` - Org branding, quotas, features
2. `031_create_departments_table.sql` - Department structure
3. `032_enhance_users_table.sql` - User profiles, status, activity
4. `033_create_audit_logs_table.sql` - Audit trail (future use)
5. `034_create_user_sessions_table.sql` - Session tracking
6. `035_create_user_invitations_table.sql` - Invitation management

## Usage Examples

### Update Organization Branding
```typescript
PATCH /api/organizations/current
{
  "name": "Acme Corp",
  "logo_url": "https://storage.example.com/logos/acme.png",
  "primary_color": "#FF5733",
  "domain": "acme.example.com"
}
```

### Get Organization Stats
```typescript
GET /api/organizations/stats?include_quotas=true&include_usage=true
```

### List Members with Filters
```typescript
GET /api/organizations/members?role=admin&status=active&page=1&limit=20
```

### Invite New Member
```typescript
POST /api/organizations/members
{
  "email": "john@example.com",
  "role": "contributor",
  "department_ids": ["uuid-1", "uuid-2"],
  "custom_message": "Welcome to the team!"
}
```

### Update Member Role
```typescript
PATCH /api/organizations/members/[member-uuid]
{
  "role": "admin",
  "status": "active"
}
```

### Remove Member
```typescript
DELETE /api/organizations/members/[member-uuid]
```

## Implementation Notes

- All routes use `apiHandler` wrapper for consistent error handling
- Request IDs generated for tracing (`generateRequestId`)
- Uses `supabaseAdmin` client to bypass RLS for admin operations
- All database operations include proper error logging
- Soft deletes preserve referential integrity
- Pagination uses offset-based approach (page/limit)
- Search uses PostgreSQL `ilike` for case-insensitive matching
