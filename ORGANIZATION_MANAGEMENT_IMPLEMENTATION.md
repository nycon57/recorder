# Organization & User Management System Implementation

**Status:** In Progress
**Start Date:** 2025-10-14
**Project:** Replace Clerk UI with Supabase-backed organization and user management

## Overview

Building an enterprise-grade organization and user management system to replace Clerk UI components with custom implementation backed by Supabase. Complete independence from Clerk UI while maintaining Clerk for authentication only.

## Architecture

**Tech Stack:**
- Database: Supabase (PostgreSQL + pgvector)
- Backend: Next.js 15 API Routes
- Frontend: React 19 + TypeScript
- UI: shadcn/ui + Tailwind CSS
- Validation: Zod
- State: React Query (for caching)

**Key Principles:**
- Role-based access control (Owner/Admin/Contributor/Reader)
- Department hierarchy for content organization
- Granular permissions (private/department/org/public)
- Comprehensive audit logging
- GDPR/SOC2 compliance ready

---

## Phase 1: Database Schema & Permissions ✅ IN PROGRESS

### 1.1 Table Enhancements

#### ✅ Organizations Table Enhancement (Migration 030)
**File:** `supabase/migrations/030_enhance_organizations_table.sql`
**Status:** ✅ Applied to Supabase
**Added Fields:**
- Billing: `billing_email`, `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `trial_ends_at`
- Branding: `logo_url`, `primary_color`, `domain`
- Features: `features` (JSONB), `max_users`, `max_storage_gb`
- Metadata: `onboarded_at`, `deleted_at`

**Indexes Created:**
- `idx_organizations_stripe_customer_id`
- `idx_organizations_domain`
- `idx_organizations_subscription_status`
- `idx_organizations_deleted_at`

#### ✅ Departments Table (Migration 031)
**File:** `supabase/migrations/031_create_departments_table.sql`
**Status:** ✅ Applied to Supabase
**Features:**
- Hierarchical structure (parent_id for tree)
- Default visibility settings per department
- Many-to-many user relationships via `user_departments`
- Helper functions: `get_department_path()`, `is_descendant_of()`

**Tables Created:**
- `departments` - Main department table with hierarchy
- `user_departments` - Junction table for user-department assignments

**RLS Policies:**
- Users can read departments in their org
- Admins can manage departments
- Service role has full access

#### ✅ Users Table Enhancement (Migration 032)
**File:** `supabase/migrations/032_enhance_users_table.sql`
**Status:** ✅ Applied to Supabase
**Added Fields:**
- Profile: `title`, `department_id`, `bio`, `phone`, `timezone`
- Onboarding: `invitation_token`, `invitation_expires_at`, `invited_by`, `onboarded_at`, `status`
- Activity: `last_login_at`, `last_active_at`, `login_count`
- Preferences: `notification_preferences` (JSONB), `ui_preferences` (JSONB)
- Soft delete: `deleted_at`

**Indexes Created:**
- `idx_users_department_id`
- `idx_users_invitation_token`
- `idx_users_status`
- `idx_users_last_active_at`
- `idx_users_deleted_at`
- `idx_users_org_id_status`

#### ⏳ Audit Logs Table (Migration 033)
**File:** `supabase/migrations/033_create_audit_logs_table.sql`
**Status:** ⏳ Ready to apply
**Features:**
- Comprehensive activity tracking
- Change tracking (old_values/new_values)
- Request context (IP, user agent, request ID)
- Automatic trigger function for critical tables
- Helper function: `log_audit_event()`

#### ⏳ User Sessions Table (Migration 034)
**File:** `supabase/migrations/034_create_user_sessions_table.sql`
**Status:** ⏳ Ready to apply
**Features:**
- Track active user sessions
- Device/browser fingerprinting
- Geolocation data
- Session revocation
- Helper functions: `cleanup_expired_sessions()`, `get_active_session_count()`

#### ⏳ User Invitations Table (Migration 035)
**File:** `supabase/migrations/035_create_user_invitations_table.sql`
**Status:** ⏳ Ready to apply
**Features:**
- Email invitation flow with tokens
- Role and department pre-assignment
- Expiration tracking
- Reminder system
- Helper functions: `expire_old_invitations()`, `accept_invitation()`

#### ⏳ Content Permissions Table (Migration 036)
**File:** `supabase/migrations/036_create_content_permissions_table.sql`
**Status:** ⏳ Ready to apply
**Features:**
- Granular visibility control (private/department/org/public)
- Department-level access
- Explicit user allowlists
- Permission flags (view/edit/delete/share)
- Helper functions: `can_access_resource()`, `get_accessible_resources()`

#### ⏳ API Keys Table (Migration 037)
**File:** `supabase/migrations/037_create_api_keys_table.sql`
**Status:** ⏳ Ready to apply
**Features:**
- Organization API key management
- Scope-based permissions
- Rate limiting per key
- IP whitelisting
- Usage tracking
- Helper functions: `validate_api_key()`, `generate_api_key_prefix()`, `revoke_api_key()`

#### ⏳ Organization Webhooks Table (Migration 038)
**File:** `supabase/migrations/038_create_org_webhooks_table.sql`
**Status:** ⏳ Ready to apply
**Features:**
- Custom webhook configurations
- Event subscriptions
- Delivery tracking via `webhook_deliveries`
- Automatic retry logic
- Health monitoring
- Helper functions: `get_webhooks_for_event()`, `record_webhook_delivery()`

**Tables Created:**
- `org_webhooks` - Webhook configurations
- `webhook_deliveries` - Delivery attempts and outcomes

---

## Phase 2: API Routes & Business Logic ⏳ PENDING

### 2.1 Profile Management APIs

#### ⏳ Profile Update Route
**File:** `app/api/profile/route.ts`
**Methods:** `GET`, `PATCH`
**Features:**
- Get current user profile
- Update name, avatar, title, bio, phone, timezone
- Update notification preferences
- Update UI preferences
- Validation with Zod

#### ⏳ Avatar Upload Route
**File:** `app/api/profile/avatar/route.ts`
**Method:** `POST`
**Features:**
- Upload to Supabase Storage
- Image optimization
- Update user record

#### ⏳ Session Management Routes
**File:** `app/api/profile/sessions/route.ts`
**Methods:** `GET`, `DELETE`
**Features:**
- List active sessions
- Revoke specific sessions
- View session details (device, location, last active)

### 2.2 Organization Management APIs

#### ⏳ Organization Info Routes
**File:** `app/api/organizations/current/route.ts`
**Methods:** `GET`, `PATCH`
**Features:**
- Get org details with settings
- Update name, branding, settings (admin+)
- Upload logo

#### ⏳ Organization Stats Route
**File:** `app/api/organizations/stats/route.ts`
**Method:** `GET`
**Features:**
- Member count
- Storage usage
- Recording count
- API usage metrics
- Department count

### 2.3 Member Management APIs

#### ⏳ Members List/Invite Route
**File:** `app/api/organizations/members/route.ts`
**Methods:** `GET`, `POST`
**Features:**
- List members with filters (role, department, status, search)
- Pagination support
- Send email invitation
- Bulk invite via CSV

#### ⏳ Member Update/Delete Routes
**File:** `app/api/organizations/members/[id]/route.ts`
**Methods:** `GET`, `PATCH`, `DELETE`
**Features:**
- Get member details
- Update role
- Update department assignments
- Suspend/delete member
- Resend invitation

### 2.4 Department Management APIs

#### ⏳ Departments CRUD Routes
**File:** `app/api/organizations/departments/route.ts`
**File:** `app/api/organizations/departments/[id]/route.ts`
**Methods:** `GET`, `POST`, `PATCH`, `DELETE`
**Features:**
- List departments (tree structure)
- Create department
- Update department
- Delete with reassignment
- Get department members
- Get department path/breadcrumbs

### 2.5 Security & Audit APIs

#### ⏳ Audit Logs Route
**File:** `app/api/organizations/audit-logs/route.ts`
**Method:** `GET`
**Features:**
- Filtered logs (date range, user, action, resource)
- Pagination
- CSV export
- Real-time subscription option

#### ⏳ API Keys Management Routes
**File:** `app/api/organizations/api-keys/route.ts`
**File:** `app/api/organizations/api-keys/[id]/route.ts`
**Methods:** `GET`, `POST`, `DELETE`
**Features:**
- List API keys
- Generate new key
- Revoke key
- Update key settings

### 2.6 Permissions Management APIs

#### ⏳ Permissions Routes
**File:** `app/api/organizations/permissions/route.ts`
**File:** `app/api/organizations/permissions/[id]/route.ts`
**Methods:** `GET`, `POST`, `PATCH`, `DELETE`
**Features:**
- List permission rules
- Create visibility rule
- Update rule
- Delete rule
- Bulk update

### 2.7 Validation Schemas

#### ⏳ Extended API Validation Schemas
**File:** `lib/validations/api.ts`
**Schemas to Add:**
- `updateProfileSchema`
- `updateOrgSchema`
- `inviteMemberSchema` (enhanced)
- `updateMemberRoleSchema` (enhanced)
- `createDepartmentSchema`
- `updateDepartmentSchema`
- `createApiKeySchema`
- `createWebhookSchema`
- `createPermissionRuleSchema`

---

## Phase 3: UI Components & Pages ⏳ PENDING

### 3.1 Shared Components

#### ⏳ UserAvatar Component
**File:** `app/components/shared/UserAvatar.tsx`
**Features:**
- Display with fallback initials
- Upload/crop functionality
- Delete option
- Loading states

#### ⏳ RoleBadge Component
**File:** `app/components/shared/RoleBadge.tsx`
**Features:**
- Styled badges for roles
- Color coding
- Tooltips with role descriptions

#### ⏳ DepartmentSelector Component
**File:** `app/components/shared/DepartmentSelector.tsx`
**Features:**
- Tree select with search
- Multi-select option
- Breadcrumb display
- Create new inline

#### ⏳ PermissionGuard Component
**File:** `app/components/shared/PermissionGuard.tsx`
**Features:**
- Hide/disable based on role
- Fallback UI
- Loading states

#### ⏳ AuditLogEntry Component
**File:** `app/components/shared/AuditLogEntry.tsx`
**Features:**
- Formatted log display
- Expandable details
- Diff viewer for changes

#### ⏳ UsageProgressBar Component
**File:** `app/components/shared/UsageProgressBar.tsx`
**Features:**
- Visual progress with color coding
- Percentage display
- Tooltip with details

### 3.2 Settings Pages

#### ⏳ Profile Settings Page (Replace Clerk UI)
**File:** `app/(dashboard)/settings/profile/page.tsx`
**Current:** Uses `<UserProfile />` from Clerk
**New Features:**
- Personal info form (name, email, title, bio, phone)
- Avatar upload with cropper
- Department selection (read-only or admin-selectable)
- Timezone selector
- Notification preferences (email, in-app, by category)
- UI preferences (theme, sidebar, default views)
- Active sessions list with revoke
- Password change (Clerk integration)
- Danger zone: Delete account

#### ⏳ Organization General Settings
**File:** `app/(dashboard)/settings/organization/general/page.tsx`
**Current:** Uses `<OrganizationProfile />` from Clerk
**New Features:**
- Organization name
- Logo upload
- Contact information
- Description
- Custom domain (enterprise)
- Primary brand color picker
- Feature toggles

#### ⏳ Member Management Interface
**File:** `app/(dashboard)/settings/organization/members/page.tsx`
**Features:**
- Data table with columns: Avatar, Name, Email, Role, Department, Last Active, Status
- Filters: Role, Department, Status (active/pending/inactive)
- Search by name/email
- Bulk actions: Assign department, Change role, Export CSV
- Invite button → Modal
- Row actions: Edit role, Assign department, View activity, Remove
- User detail drawer with audit log

#### ⏳ Department Management Interface
**File:** `app/(dashboard)/settings/organization/departments/page.tsx`
**Features:**
- Tree view with expand/collapse
- Drag-and-drop to reorganize (enterprise)
- Add/Edit/Delete modals
- Member count per department
- Default visibility settings
- Breadcrumb navigation

#### ⏳ Enhanced Billing & Usage Dashboard
**File:** `app/(dashboard)/settings/billing/page.tsx`
**Current:** Basic placeholder
**New Features:**
- Plan comparison cards
- Usage dashboard:
  - Recordings (current/limit)
  - Storage (GB used/total)
  - AI requests (monthly/limit)
  - Team members (active/max)
  - API calls (rate metrics)
- Usage breakdown by user/department
- Cost projections
- Invoice history with download
- Payment methods (Stripe)
- Upgrade/downgrade flows

#### ⏳ Security Dashboard
**File:** `app/(dashboard)/settings/organization/security/page.tsx`
**Features:**
- Audit log viewer with filters
- Real-time log updates
- Export to CSV
- 2FA enforcement toggle
- Session management (all org sessions)
- IP allowlist (enterprise)
- Data retention settings

#### ⏳ Integrations Hub
**File:** `app/(dashboard)/settings/organization/integrations/page.tsx`
**Features:**
- API keys section:
  - List with prefix, created, last used
  - Generate with scopes
  - Copy/revoke actions
- Webhooks section:
  - List with URL, events, status
  - Add/edit/test modals
  - Delivery logs
- Connected services status

#### ⏳ Content Permissions Management
**File:** `app/(dashboard)/settings/organization/permissions/page.tsx`
**Features:**
- Permission rules table
- Default visibility per content type
- Department access matrix
- Add/edit rule modals

### 3.3 Navigation Updates

#### ⏳ Update Settings Navigation
**File:** `app/components/layout/nav-settings.tsx`
**Changes:**
- Add Members item
- Add Departments item
- Add Security item
- Add Integrations item
- Add Permissions item
- Reorganize menu structure

#### ⏳ Update Sidebar for Roles
**File:** `app/components/layout/app-sidebar.tsx`
**Changes:**
- Conditionally show admin sections
- Badge for pending invites
- Usage indicators

---

## Phase 4: Advanced Features ⏳ PENDING

### 4.1 Department Hierarchy & Content Visibility

#### ⏳ Implement Hierarchical Permissions
**Features:**
- Content inherits department visibility
- Parent department access includes children
- Override mechanisms
- Visibility propagation

#### ⏳ Department-Level Quotas
**Features:**
- Storage quotas per department
- Recording limits
- Analytics per department

### 4.2 User Onboarding & Invitations

#### ⏳ Email Invitation Flow
**Features:**
- Email templates (Resend/SendGrid)
- Magic link acceptance
- Role preview before acceptance
- Custom welcome messages

#### ⏳ Bulk CSV Import
**Features:**
- CSV upload validation
- Preview before import
- Error handling
- Progress tracking

#### ⏳ Onboarding Checklist
**Features:**
- Role-based checklists
- Progress tracking
- Tooltips and tutorials

### 4.3 Audit & Compliance

#### ⏳ Enhanced Audit Logging
**Features:**
- Track all CRUD on sensitive data
- IP and user agent logging
- Automated suspicious activity detection
- Compliance reporting

#### ⏳ GDPR Data Export
**Features:**
- Full user data export
- Organization data export
- Scheduled exports
- Retention policy enforcement

### 4.4 Advanced Billing

#### ⏳ Usage Breakdown
**Features:**
- Per-user cost allocation
- Department chargebacks
- Custom reporting
- Spending limits and alerts

---

## Phase 5: Polish & Optimization ⏳ PENDING

### 5.1 UI/UX Excellence

#### ⏳ Responsive Design
- Mobile-first approach
- Tablet optimizations
- Desktop experience
- Touch-friendly controls

#### ⏳ Dark Mode Support
- Theme switching
- Persistent preferences
- Component variants

#### ⏳ Keyboard Shortcuts
- Navigation shortcuts
- Quick actions
- Command palette

#### ⏳ Loading States & Skeletons
- Skeleton screens
- Progress indicators
- Optimistic UI updates

#### ⏳ Empty States
- Meaningful illustrations
- Clear CTAs
- Helpful guidance

### 5.2 Performance

#### ⏳ React Query Integration
- Data caching
- Optimistic updates
- Background refetching
- Infinite scroll

#### ⏳ Code Optimization
- Lazy loading routes
- Component code splitting
- Image optimization
- Bundle analysis

#### ⏳ Database Optimization
- Query optimization
- Index tuning
- Connection pooling

### 5.3 Accessibility

#### ⏳ WCAG 2.1 AA Compliance
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader support
- Color contrast validation
- Focus management

### 5.4 Testing

#### ⏳ Unit Tests
- API route tests
- Utility function tests
- Validation schema tests

#### ⏳ Integration Tests
- User flows
- Permission checks
- Data mutations

#### ⏳ E2E Tests
- Critical user journeys
- Role-based scenarios
- Cross-browser testing

---

## Phase 6: Documentation ⏳ PENDING

### 6.1 Admin Documentation

#### ⏳ Admin Guide
**File:** `docs/ADMIN_GUIDE.md`
**Sections:**
- User management
- Role descriptions
- Department setup
- Permission system
- Billing & quotas
- Security best practices
- Audit log interpretation

#### ⏳ API Documentation
**File:** `docs/API_REFERENCE.md`
**Sections:**
- Authentication
- Rate limiting
- Endpoint reference
- Error codes
- Examples

#### ⏳ Permission Matrix
**File:** `docs/PERMISSION_MATRIX.md`
**Content:**
- Role capabilities table
- Department access rules
- Content visibility guide

---

## Migration Status Summary

| Migration | File | Status | Applied |
|-----------|------|--------|---------|
| 030 | `enhance_organizations_table.sql` | ✅ Complete | Yes |
| 031 | `create_departments_table.sql` | ✅ Complete | Yes |
| 032 | `enhance_users_table.sql` | ✅ Complete | Yes |
| 033 | `create_audit_logs_table.sql` | ⏳ Ready | No |
| 034 | `create_user_sessions_table.sql` | ⏳ Ready | No |
| 035 | `create_user_invitations_table.sql` | ⏳ Ready | No |
| 036 | `create_content_permissions_table.sql` | ⏳ Ready | No |
| 037 | `create_api_keys_table.sql` | ⏳ Ready | No |
| 038 | `create_org_webhooks_table.sql` | ⏳ Ready | No |

---

## Next Steps

**Immediate (In Progress):**
1. ✅ Apply remaining 6 database migrations (033-038)
2. Generate TypeScript types from new schema
3. Create extended Zod validation schemas
4. Build profile management API routes

**Next Sprint:**
1. Build organization management APIs
2. Build member management APIs
3. Create shared UI components
4. Replace Profile Settings page

**Future Sprints:**
1. Complete all settings pages
2. Advanced features (bulk import, analytics)
3. Polish & optimization
4. Testing & documentation

---

## Notes & Decisions

- **Clerk Integration:** Keep Clerk for authentication only. All user/org management in Supabase.
- **RLS Policies:** Use service role for backend operations. RLS for client queries.
- **Department ID:** Users have primary `department_id`, but can belong to multiple via `user_departments`.
- **Soft Deletes:** Use `deleted_at` for users and orgs to maintain referential integrity.
- **API Keys:** Store bcrypt hash, never plaintext. Return full key only on creation.
- **Audit Logs:** Write-only for service role. Admins can read filtered logs.

---

## Team Handoff Checklist

If handing off to another engineer/agent:

- [ ] Review this document fully
- [ ] Check Supabase migration status (see table above)
- [ ] Review environment variables in `.env.example`
- [ ] Check existing API routes in `app/api/`
- [ ] Review validation schemas in `lib/validations/api.ts`
- [ ] Understand role hierarchy (Owner > Admin > Contributor > Reader)
- [ ] Test database functions with Supabase SQL Editor
- [ ] Review RLS policies for security implications

**Key Files to Review:**
- `CLAUDE.md` - Project architecture
- `.env.example` - Required environment variables
- `lib/supabase/` - Database client configurations
- `lib/types/database.ts` - TypeScript types (will be regenerated)

---

**Last Updated:** 2025-10-14
**Current Phase:** Phase 1 - Database Schema (3/9 migrations applied)
**Next Action:** Apply migrations 033-038 to Supabase