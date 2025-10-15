# Organization Management System - Comprehensive Implementation Plan

**Generated:** 2025-10-14
**Status:** Phase 1 Complete - Moving to Phase 2 (API Routes)
**Goal:** Replace Clerk UI with enterprise-grade, role-based organization management

---

## 🎯 Executive Summary

Building a complete organization management system with:
- **Role-Based Access Control** (Owner/Admin/Contributor/Reader)
- **Department Hierarchy** for content organization
- **Granular Permissions** (private/department/org/public)
- **Enterprise Features** (API keys, webhooks, audit logs, session management)
- **Beautiful UI/UX** using shadcn/ui and Tailwind CSS

---

## ✅ Current Status - Phase 1 Complete

### Database Migrations Created (9 total)
✅ **030_enhance_organizations_table.sql** - Applied to Supabase
- Billing fields (Stripe customer ID, subscription ID, status, trial dates)
- Branding (logo URL, primary color, custom domain)
- Features (JSONB feature flags, max users, max storage GB)
- Soft delete support (deleted_at)

✅ **031_create_departments_table.sql** - Applied to Supabase
- Hierarchical department structure (parent_id)
- Default visibility settings per department
- Many-to-many user relationships via user_departments junction table
- Helper functions: get_department_path(), is_descendant_of()

✅ **032_enhance_users_table.sql** - Applied to Supabase
- Profile fields (title, bio, phone, timezone)
- Department assignment (department_id + user_departments)
- Onboarding tracking (invitation tokens, onboarded_at, status)
- Activity tracking (last_login_at, last_active_at, login_count)
- Preferences (notification_preferences, ui_preferences JSONB)
- Soft delete support (deleted_at)

✅ **033_create_audit_logs_table.sql** - Applied to Supabase
- Comprehensive audit trail (action, resource_type, resource_id)
- Change tracking (old_values, new_values JSONB)
- Request context (IP address, user agent, request ID)
- Automatic trigger function for critical tables
- Helper function: log_audit_event()

⏳ **034_create_user_sessions_table.sql** - Ready to apply
- Session tracking (session_token, clerk_session_id)
- Device fingerprinting (device_type, browser, OS)
- Geolocation (IP address, location JSONB)
- Helper functions: cleanup_expired_sessions(), get_active_session_count()

✅ **035_create_user_invitations_table.sql** - Applied to Supabase
- Email invitation flow with secure tokens
- Role and department pre-assignment
- Expiration tracking (expires_at, reminder system)
- Helper functions: expire_old_invitations(), accept_invitation()

⏳ **036_create_content_permissions_table.sql** - Ready to apply
- Granular visibility (private/department/org/public)
- Department-level access control (department_ids array)
- Explicit user allowlists (allowed_user_ids array)
- Permission flags (can_view, can_edit, can_delete, can_share)
- Helper functions: can_access_resource(), get_accessible_resources()

✅ **037_create_api_keys_table.sql** - Applied to Supabase
- Scoped API keys (scopes array)
- Rate limiting (rate_limit per key)
- IP whitelisting (ip_whitelist array)
- Usage tracking (last_used_at, usage_count)
- Helper functions: validate_api_key(), generate_api_key_prefix(), revoke_api_key()

⏳ **038_create_org_webhooks_table.sql** - Ready to apply
- Webhook configurations (url, secret, events)
- Delivery tracking via webhook_deliveries table
- Retry logic with exponential backoff
- Health monitoring (status, consecutive_failures)
- Helper functions: get_webhooks_for_event(), record_webhook_delivery()

### RLS Policies - Security First ✅
All tables have comprehensive Row Level Security policies:
- **Service role:** Full access for backend operations
- **Users:** Can read their own data
- **Admins/Owners:** Can manage org-wide data
- **Department-based:** Content filtered by department membership
- **No data leakage:** Properly scoped to org_id

---

## 📊 Role-Based Permission Matrix

| Feature | Owner | Admin | Contributor | Reader |
|---------|-------|-------|-------------|--------|
| **Organization Management** |
| Update org settings | ✅ | ✅ | ❌ | ❌ |
| Update branding (logo, colors) | ✅ | ✅ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ | ❌ |
| View org stats | ✅ | ✅ | ✅ | ❌ |
| Manage feature flags | ✅ | ✅ | ❌ | ❌ |
| **User Management** |
| Invite users | ✅ | ✅ | ❌ | ❌ |
| Remove users | ✅ | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ✅* | ❌ | ❌ |
| View all users | ✅ | ✅ | ✅ | ❌ |
| Assign departments | ✅ | ✅ | ❌ | ❌ |
| Manage user sessions | ✅ | ✅ | ❌ | ❌ |
| **Department Management** |
| Create departments | ✅ | ✅ | ❌ | ❌ |
| Delete departments | ✅ | ✅ | ❌ | ❌ |
| Modify hierarchy | ✅ | ✅ | ❌ | ❌ |
| View departments | ✅ | ✅ | ✅ | ✅ |
| Assign users to departments | ✅ | ✅ | ❌ | ❌ |
| **Content & Recordings** |
| Create recordings | ✅ | ✅ | ✅ | ❌ |
| View own recordings | ✅ | ✅ | ✅ | ✅ |
| View all org recordings | ✅ | ✅ | ✅** | ❌ |
| Delete any recording | ✅ | ✅ | ❌ | ❌ |
| Share recordings | ✅ | ✅ | ✅ | ❌ |
| Set visibility level | ✅ | ✅ | ✅*** | ❌ |
| **Billing & Usage** |
| View billing | ✅ | ✅ | ❌ | ❌ |
| Manage subscription | ✅ | ❌ | ❌ | ❌ |
| Update payment methods | ✅ | ❌ | ❌ | ❌ |
| View usage stats | ✅ | ✅ | ✅**** | ❌ |
| Set quota limits | ✅ | ✅ | ❌ | ❌ |
| **Security & Audit** |
| View audit logs | ✅ | ✅ | ❌ | ❌ |
| Export audit logs | ✅ | ✅ | ❌ | ❌ |
| Manage API keys | ✅ | ✅ | ❌ | ❌ |
| Manage webhooks | ✅ | ✅ | ❌ | ❌ |
| View all sessions | ✅ | ✅ | ❌ | ❌ |
| Revoke user sessions | ✅ | ✅ | ❌ | ❌ |
| Export data (GDPR) | ✅ | ✅ | ✅***** | ❌ |
| **Integrations** |
| Configure webhooks | ✅ | ✅ | ❌ | ❌ |
| Generate API keys | ✅ | ✅ | ❌ | ❌ |
| View integration logs | ✅ | ✅ | ❌ | ❌ |
| Test webhooks | ✅ | ✅ | ❌ | ❌ |

**Notes:**
- *Admins can only promote to Contributor/Reader, not to Owner/Admin
- **Contributors can only view department-visible or public recordings
- ***Contributors can only set visibility on their own content
- ****Contributors can only view their own usage stats
- *****Contributors can only export their own data

---

## 🎨 Missing Features & Improvements - Ideation

### 1. Content Visibility System 🆕 HIGH PRIORITY
**Status:** Database ready (migration 036), needs API + UI
**Description:** Granular content permissions for recordings, documents, shares

**Features:**
- **Visibility Levels:**
  - Private (creator + explicitly allowed users)
  - Department (all users in specified departments)
  - Organization (all org members)
  - Public (anyone with link)
- **Department Inheritance:** Parent departments can access child department content
- **User Allowlists:** Explicitly grant access to specific users
- **Permission Flags:** Separate view/edit/delete/share permissions
- **Bulk Operations:** Set visibility for multiple recordings at once

**Implementation:**
- Database: ✅ content_permissions table (migration 036)
- API: ⏳ /api/organizations/permissions/
- UI: ⏳ Permissions management page + inline visibility selector

---

### 2. Session Management Dashboard 🆕 HIGH PRIORITY
**Status:** Database ready (migration 034), needs API + UI
**Description:** Enterprise-grade session security and monitoring

**Features:**
- **Session List:** View all active sessions with details
  - Device type (desktop/mobile/tablet)
  - Browser and OS information
  - IP address and geolocation
  - Last active timestamp
- **Session Actions:**
  - Revoke individual sessions
  - Revoke all sessions (except current)
  - Force logout suspicious sessions
- **Security Alerts:**
  - New device login notifications
  - Geographic anomaly detection
  - Multiple concurrent session warnings
- **Session Analytics:** Track login patterns over time

**Implementation:**
- Database: ✅ user_sessions table (migration 034)
- API: ⏳ /api/profile/sessions/
- UI: ⏳ Security tab in profile settings

---

### 3. Advanced Department Features 💡 MEDIUM PRIORITY
**Description:** Enhanced department capabilities beyond basic hierarchy

**Features:**
- **Department Quotas:** Set storage/recording limits per department
- **Department Analytics:** Usage breakdown and trends
- **Department Managers:** Assign department-level admins (new role)
- **Department Tags:** Auto-tag content by department membership
- **Department Onboarding:** Custom welcome flows per department
- **Cross-Department Teams:** Virtual teams spanning multiple departments
- **Department Templates:** Pre-configured department structures

**Implementation:**
- Database: New table `department_quotas`, extend `departments`
- API: Extend /api/organizations/departments/
- UI: Enhanced department management page

---

### 4. User Lifecycle Management 💡 HIGH PRIORITY
**Description:** Complete user journey from invitation to offboarding

**Features:**
- **Bulk Invitations:**
  - CSV import with validation
  - Preview before sending
  - Error handling for invalid emails
  - Progress tracking
- **Invitation Templates:** Pre-configure role + departments
- **Onboarding Checklist:** Role-specific tutorials and tasks
- **Probation Period:** Limited access for first X days
- **User Suspension:** Temporary account freeze (vs permanent delete)
- **Offboarding Workflow:**
  - Content reassignment wizard
  - Exit interview form
  - Account archive (not delete)
- **Automated Reminders:** Resend invitations after X days

**Implementation:**
- Database: ✅ user_invitations (migration 035), extend users
- API: ⏳ Bulk import endpoint, onboarding checklist endpoints
- UI: ⏳ Bulk invite modal, onboarding dashboard

---

### 5. Advanced Audit & Compliance 🆕 HIGH PRIORITY
**Description:** Enterprise-grade audit trail and compliance reporting

**Features:**
- **Audit Log Viewer:**
  - Advanced filtering (date range, user, action, resource)
  - Full-text search across audit logs
  - Real-time updates via WebSocket
  - Exportable to CSV/JSON
- **Compliance Reports:**
  - SOC2 audit report generator
  - GDPR data access report
  - HIPAA compliance dashboard
- **Anomaly Detection:**
  - Flag unusual patterns (bulk deletes, off-hours access)
  - Alert on privilege escalation attempts
  - Geographic anomaly detection
- **Retention Policies:**
  - Auto-archive old logs
  - Compliance-based retention (7 years for SOC2)
- **Audit Alerts:**
  - Email/Slack notifications for critical events
  - Configurable alert rules

**Implementation:**
- Database: ✅ audit_logs (migration 033)
- API: ⏳ /api/organizations/audit-logs/ with filtering
- UI: ⏳ Security dashboard with log viewer

---

### 6. Usage Analytics Dashboard 💡 MEDIUM PRIORITY
**Description:** Comprehensive usage tracking and cost allocation

**Features:**
- **Per-User Analytics:**
  - Recordings created
  - Storage consumed
  - API calls made
  - AI credits used
- **Department Analytics:**
  - Compare department usage
  - Identify high-usage departments
  - Cost allocation for chargebacks
- **Trend Charts:**
  - Weekly/monthly growth
  - Forecast future usage
  - Identify seasonal patterns
- **Quota Alerts:**
  - Email when nearing limits (80%, 90%, 95%)
  - Upgrade prompts
- **Export Reports:** CSV/PDF for finance teams

**Implementation:**
- Database: Use existing `usage_counters` + aggregation views
- API: /api/organizations/analytics/
- UI: Enhanced billing page with charts

---

### 7. API Key Management 🆕 HIGH PRIORITY
**Status:** Database ready (migration 037), needs API + UI
**Description:** Programmatic access to the platform

**Features:**
- **Scoped Permissions:**
  - read:recordings, write:recordings
  - read:users, write:users
  - admin:* (full access)
- **Rate Limiting:** Per-key request quotas
- **IP Whitelisting:** Restrict access by IP range
- **Key Rotation:** Scheduled expiration and renewal
- **Usage Tracking:**
  - API calls per key
  - Last used timestamp
  - Usage graphs
- **Key Management:**
  - Create with custom scopes
  - Revoke instantly
  - Copy to clipboard (one-time display)

**Implementation:**
- Database: ✅ api_keys (migration 037)
- API: ⏳ /api/organizations/api-keys/
- UI: ⏳ Integrations hub page

---

### 8. Webhook System 🆕 MEDIUM PRIORITY
**Status:** Database ready (migration 038), needs API + worker
**Description:** Event-driven integrations with external systems

**Features:**
- **Event Subscriptions:**
  - recording.completed
  - recording.failed
  - user.created
  - user.deleted
  - document.generated
  - Custom events
- **Delivery System:**
  - Retry with exponential backoff
  - Max 3 retries by default
  - Timeout after 5 seconds
- **Delivery Logs:**
  - Track all attempts
  - View request/response
  - Debug failures
- **Security:**
  - HMAC signature verification
  - Custom headers for auth
  - Secret rotation
- **Health Monitoring:**
  - Auto-disable after 10 consecutive failures
  - Status indicators (healthy/degraded/failing)
- **Testing:** Send test payloads

**Implementation:**
- Database: ✅ org_webhooks + webhook_deliveries (migration 038)
- API: ⏳ /api/organizations/webhooks/
- Worker: ⏳ Webhook delivery job processor
- UI: ⏳ Integrations hub page

---

### 9. Billing & Subscription Management 💡 HIGH PRIORITY
**Description:** Self-service billing portal

**Features:**
- **Plan Comparison:** Feature matrix with pricing
- **Usage Dashboard:**
  - Real-time usage vs limits
  - Progress bars with color coding
  - Overage warnings
- **Subscription Management:**
  - Upgrade/downgrade with proration
  - Add-ons (extra storage, users)
  - Cancel with exit survey
- **Invoice Management:**
  - View invoice history
  - Download PDF invoices
  - Update billing email
- **Payment Methods:**
  - Add/remove credit cards
  - Default payment method
  - Stripe integration
- **Spending Controls:**
  - Set spending limits
  - Alert thresholds
  - Auto-upgrade options

**Implementation:**
- Database: Use existing Stripe fields in organizations
- API: Stripe webhook handlers + billing endpoints
- UI: Enhanced billing page

---

### 10. Profile Customization 💡 MEDIUM PRIORITY
**Description:** Rich user profiles beyond basic information

**Features:**
- **Extended Profile:**
  - Job title, department
  - Bio/description
  - Phone number
  - Timezone (for scheduling)
  - Preferred pronouns
- **Social Links:** LinkedIn, GitHub, Twitter
- **Work Schedule:** Availability hours, time zones
- **Skills & Expertise:** Tags for discoverability
- **Profile Visibility:** Control who sees what fields
- **User Directory:** Searchable org member directory
- **Profile Photos:**
  - Upload/crop functionality
  - Avatar fallback to initials

**Implementation:**
- Database: ✅ Extended users table (migration 032)
- API: ⏳ /api/profile/ with extended fields
- UI: ⏳ Enhanced profile settings page

---

### 11. Content Organization 💡 MEDIUM PRIORITY
**Description:** Better ways to organize and discover recordings

**Features:**
- **Collections:** Group related recordings
- **Favorites/Bookmarks:** Star important content
- **Recent Activity Feed:** What's new in your org
- **Recommended Content:** ML-based suggestions
- **Smart Folders:** Auto-organize by criteria
- **Bulk Operations:** Move, tag, delete multiple items
- **Advanced Filters:**
  - By department
  - By date range
  - By creator
  - By tags
  - By status

**Implementation:**
- Database: New tables `collections`, `bookmarks`
- API: Collections and bookmarks endpoints
- UI: Collections page, enhanced recordings list

---

### 12. Notification System 💡 MEDIUM PRIORITY
**Description:** Configurable multi-channel notifications

**Features:**
- **Notification Types:**
  - Recording completed
  - Mentioned in comment
  - Invited to org
  - Role changed
  - Quota warnings
  - Security alerts
- **Channels:**
  - In-app notifications (toast + center)
  - Email (immediate or digest)
  - Slack integration
  - Webhook triggers
- **Preferences:**
  - Per-notification-type settings
  - Per-channel preferences
  - Quiet hours
  - Digest frequency (daily/weekly)
- **Notification Center:**
  - Mark as read/unread
  - Archive
  - Filter by type
  - Search history

**Implementation:**
- Database: New `notifications` table
- API: /api/notifications/
- UI: Notification center component, preferences page

---

### 13. Team Collaboration 💡 LOW PRIORITY
**Description:** Real-time collaboration on recordings

**Features:**
- **Comments:**
  - Timestamped comments on recordings
  - Thread replies
  - Edit/delete own comments
- **Mentions:** @mention team members
- **Reactions:** Emoji reactions
- **Tasks:** Create action items from recordings
- **Follow/Subscribe:** Get notified on updates
- **Sharing:**
  - Share with specific users
  - Department sharing
  - Public links

**Implementation:**
- Database: New tables `comments`, `reactions`, `tasks`
- API: Comments and reactions endpoints
- UI: Comment sidebar, task list

---

### 14. Advanced Search & Discovery 💡 MEDIUM PRIORITY
**Description:** Enhanced search with rich filtering

**Features:**
- **Filters:**
  - By department (with hierarchy)
  - By user/creator
  - By date range
  - By tags
  - By status
  - By visibility level
- **Saved Searches:** Store frequent queries
- **Search Suggestions:** Autocomplete as you type
- **Visual Search:** Find by thumbnail similarity
- **Search Analytics:** Track popular queries
- **Federated Search:** Search across recordings, documents, transcripts

**Implementation:**
- Enhance existing vector search
- Add filter UI components
- Store saved searches in user preferences

---

### 15. Mobile & PWA 💡 LOW PRIORITY
**Description:** Mobile-optimized experience

**Features:**
- **Responsive Design:** Mobile-first approach
- **PWA Support:** Installable app experience
- **Offline Mode:** View cached recordings
- **Touch Gestures:** Swipe actions
- **Mobile Navigation:** Bottom nav bar
- **Push Notifications:** Mobile alerts

**Implementation:**
- CSS: Enhance mobile breakpoints
- PWA: Add manifest.json, service worker
- UI: Mobile-optimized components

---

## 🏗️ Implementation Roadmap

### **Phase 1: Foundation** ✅ COMPLETE
**Duration:** Completed
**Status:** ✅ Done

- [x] Create 9 database migrations
- [x] Apply initial migrations (030, 031, 032, 033, 035, 037)
- [x] Design RLS policies for security
- [x] Create helper functions
- [x] Document implementation plan

**Deliverables:**
- ✅ Enhanced organizations, users, departments tables
- ✅ Audit logs, user invitations, API keys tables
- ✅ Comprehensive RLS policies
- ✅ Database helper functions

---

### **Phase 2: Core Backend** ⏳ IN PROGRESS
**Duration:** 3-4 days
**Status:** Ready to start

#### 2.1 Apply Remaining Migrations
- [ ] Apply migration 034 (user_sessions)
- [ ] Apply migration 036 (content_permissions)
- [ ] Apply migration 038 (org_webhooks)
- [ ] Verify all RLS policies
- [ ] Test helper functions

#### 2.2 TypeScript Types & Validation
- [ ] Generate TypeScript types from Supabase schema
- [ ] Create Zod validation schemas for all APIs
- [ ] Update database.ts types file
- [ ] Create type guards and utilities

#### 2.3 Profile Management APIs
**File:** `app/api/profile/route.ts`
- [ ] GET /api/profile - Get current user profile
- [ ] PATCH /api/profile - Update profile (name, title, bio, phone, timezone)
- [ ] GET /api/profile/sessions - List active sessions
- [ ] DELETE /api/profile/sessions/[id] - Revoke session
- [ ] POST /api/profile/avatar - Upload avatar

**Validation Schemas:**
- updateProfileSchema
- uploadAvatarSchema

#### 2.4 Organization Management APIs
**File:** `app/api/organizations/current/route.ts`
- [ ] GET /api/organizations/current - Get org details
- [ ] PATCH /api/organizations/current - Update org (name, logo, branding)
- [ ] GET /api/organizations/stats - Usage statistics

**Validation Schemas:**
- updateOrgSchema
- uploadLogoSchema

#### 2.5 Member Management APIs
**File:** `app/api/organizations/members/route.ts`
- [ ] GET /api/organizations/members - List members (with filters)
- [ ] POST /api/organizations/members - Invite member
- [ ] GET /api/organizations/members/[id] - Get member details
- [ ] PATCH /api/organizations/members/[id] - Update role/departments
- [ ] DELETE /api/organizations/members/[id] - Remove member
- [ ] POST /api/organizations/members/bulk-invite - CSV import

**Validation Schemas:**
- inviteMemberSchema
- updateMemberSchema
- bulkInviteSchema

#### 2.6 Department Management APIs
**File:** `app/api/organizations/departments/route.ts`
- [ ] GET /api/organizations/departments - List departments (tree)
- [ ] POST /api/organizations/departments - Create department
- [ ] GET /api/organizations/departments/[id] - Get department
- [ ] PATCH /api/organizations/departments/[id] - Update department
- [ ] DELETE /api/organizations/departments/[id] - Delete department
- [ ] GET /api/organizations/departments/[id]/members - List members

**Validation Schemas:**
- createDepartmentSchema
- updateDepartmentSchema

#### 2.7 Security & Audit APIs
**File:** `app/api/organizations/audit-logs/route.ts`
- [ ] GET /api/organizations/audit-logs - List with filters
- [ ] GET /api/organizations/audit-logs/export - Export to CSV

**Validation Schemas:**
- auditLogFilterSchema

#### 2.8 Permissions Management APIs
**File:** `app/api/organizations/permissions/route.ts`
- [ ] GET /api/organizations/permissions - List permission rules
- [ ] POST /api/organizations/permissions - Create rule
- [ ] PATCH /api/organizations/permissions/[id] - Update rule
- [ ] DELETE /api/organizations/permissions/[id] - Delete rule

**Validation Schemas:**
- createPermissionRuleSchema
- updatePermissionRuleSchema

#### 2.9 API Keys Management
**File:** `app/api/organizations/api-keys/route.ts`
- [ ] GET /api/organizations/api-keys - List keys
- [ ] POST /api/organizations/api-keys - Generate key
- [ ] DELETE /api/organizations/api-keys/[id] - Revoke key

**Validation Schemas:**
- createApiKeySchema

#### 2.10 Webhooks Management
**File:** `app/api/organizations/webhooks/route.ts`
- [ ] GET /api/organizations/webhooks - List webhooks
- [ ] POST /api/organizations/webhooks - Create webhook
- [ ] PATCH /api/organizations/webhooks/[id] - Update webhook
- [ ] DELETE /api/organizations/webhooks/[id] - Delete webhook
- [ ] POST /api/organizations/webhooks/[id]/test - Test webhook
- [ ] GET /api/organizations/webhooks/[id]/deliveries - List deliveries

**Validation Schemas:**
- createWebhookSchema
- updateWebhookSchema

---

### **Phase 3: UI Components** ⏳ NEXT
**Duration:** 3-4 days
**Status:** Blocked by Phase 2

#### 3.1 Shared Components
- [ ] UserAvatar - Display user avatar with fallback
- [ ] RoleBadge - Styled role indicator
- [ ] DepartmentSelector - Tree select with search
- [ ] PermissionGuard - Hide/show based on role
- [ ] AuditLogEntry - Formatted log display
- [ ] UsageProgressBar - Visual usage indicator
- [ ] DataTable - Sortable, filterable table
- [ ] ConfirmDialog - Reusable confirmation modal
- [ ] EmptyState - Consistent empty states
- [ ] LoadingState - Skeleton loaders

#### 3.2 Form Components
- [ ] ProfileForm - Profile editing form
- [ ] OrganizationForm - Org settings form
- [ ] InviteMemberForm - User invitation form
- [ ] DepartmentForm - Department CRUD form
- [ ] ApiKeyForm - API key generation form
- [ ] WebhookForm - Webhook configuration form

#### 3.3 Complex Components
- [ ] MemberTable - Member list with actions
- [ ] DepartmentTree - Hierarchical department view
- [ ] SessionList - Active sessions with revoke
- [ ] AuditLogViewer - Log viewer with filters
- [ ] ApiKeyManager - API key management
- [ ] WebhookManager - Webhook configuration
- [ ] PermissionRulesTable - Permission rules display

---

### **Phase 4: Settings Pages** ⏳ NEXT
**Duration:** 4-5 days
**Status:** Blocked by Phase 3

#### 4.1 Profile Settings
**File:** `app/(dashboard)/settings/profile/page.tsx`
**Replaces:** Clerk `<UserProfile />`

**Sections:**
- Personal Information (name, email, title, bio)
- Avatar Upload
- Department Assignment (read-only or admin-editable)
- Timezone & Preferences
- Notification Preferences
- UI Preferences (theme, default views)
- Active Sessions Management
- Password Change (via Clerk)
- Danger Zone (delete account)

#### 4.2 Organization General Settings
**File:** `app/(dashboard)/settings/organization/general/page.tsx`
**Replaces:** Clerk `<OrganizationProfile />`

**Sections:**
- Organization Name & Slug
- Logo Upload
- Branding (primary color picker)
- Contact Information
- Description
- Custom Domain (enterprise)
- Feature Flags

#### 4.3 Member Management
**File:** `app/(dashboard)/settings/organization/members/page.tsx`

**Features:**
- Data table with columns: Avatar, Name, Email, Role, Department, Last Active, Status
- Filters: Role, Department, Status
- Search: Name/email
- Bulk actions: Assign department, Export CSV
- Actions: Edit role, Assign dept, View activity, Remove
- Invite button → Modal

#### 4.4 Department Management
**File:** `app/(dashboard)/settings/organization/departments/page.tsx`

**Features:**
- Tree view with expand/collapse
- Add/Edit/Delete modals
- Member count per department
- Default visibility settings
- Breadcrumb navigation
- Drag-and-drop reorganization (future)

#### 4.5 Billing & Usage Dashboard
**File:** `app/(dashboard)/settings/billing/page.tsx`

**Features:**
- Current plan display
- Usage dashboard (recordings, storage, AI, users, API)
- Usage breakdown by user/department
- Invoice history
- Payment methods
- Upgrade/downgrade flows

#### 4.6 Security Dashboard
**File:** `app/(dashboard)/settings/organization/security/page.tsx`

**Features:**
- Audit log viewer with filters
- Real-time log updates
- Export to CSV
- Session management (all org sessions)
- 2FA enforcement toggle (future)
- Data retention settings

#### 4.7 Integrations Hub
**File:** `app/(dashboard)/settings/organization/integrations/page.tsx`

**Sections:**
- **API Keys:**
  - List with prefix, created, last used
  - Generate with scopes
  - Copy/revoke actions
- **Webhooks:**
  - List with URL, events, status
  - Add/edit/test modals
  - Delivery logs

#### 4.8 Content Permissions
**File:** `app/(dashboard)/settings/organization/permissions/page.tsx`

**Features:**
- Permission rules table
- Default visibility per content type
- Department access matrix
- Add/edit rule modals

---

### **Phase 5: Advanced Features** 🔮 FUTURE
**Duration:** 5-7 days
**Status:** Planned

- [ ] Bulk user import (CSV)
- [ ] Webhook delivery worker
- [ ] Advanced analytics dashboard
- [ ] Notification system
- [ ] Department quotas
- [ ] Content collections
- [ ] Comments & collaboration

---

### **Phase 6: Polish & Optimization** 🔮 FUTURE
**Duration:** 3-4 days
**Status:** Planned

- [ ] Performance optimization (React Query caching)
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Mobile responsiveness
- [ ] Dark mode support
- [ ] Keyboard shortcuts
- [ ] Loading states & skeletons
- [ ] Empty states
- [ ] Error boundaries

---

### **Phase 7: Security & Testing** 🔮 FUTURE
**Duration:** 3-4 days
**Status:** Planned

- [ ] Security audit (RLS policies, API permissions)
- [ ] Unit tests (API routes)
- [ ] Integration tests (user flows)
- [ ] E2E tests (critical paths)
- [ ] Performance testing
- [ ] Load testing

---

### **Phase 8: Documentation** 🔮 FUTURE
**Duration:** 2-3 days
**Status:** Planned

- [ ] Admin guide
- [ ] API documentation
- [ ] Permission matrix reference
- [ ] Deployment guide
- [ ] Migration guide (from Clerk UI)

---

## 🎨 UI/UX Design System

### Component Library
- **Base:** shadcn/ui (Radix UI primitives + Tailwind CSS)
- **Icons:** Lucide Icons
- **Fonts:** Inter (sans-serif)
- **Animations:** Framer Motion (subtle, purposeful)

### Color System
- **Brand:** Use org.primary_color from database
- **Semantic Colors:**
  - Success: Green (#10b981)
  - Warning: Yellow (#f59e0b)
  - Error: Red (#ef4444)
  - Info: Blue (#3b82f6)

### Typography Scale
- **Headings:** font-semibold, tracking-tight
- **Body:** font-normal, leading-relaxed
- **Labels:** font-medium, text-sm

### Spacing System
- **Base unit:** 4px (0.25rem)
- **Common spacing:** 4, 8, 12, 16, 24, 32, 48, 64px

### Layout Patterns
```
┌─────────────────────────────────────────┐
│  Top Navigation (App Header)            │
├──────┬──────────────────────────────────┤
│      │  ┌────────────────────────────┐  │
│      │  │ Page Header                │  │
│ Side │  │ - Title + Breadcrumbs      │  │
│ bar  │  │ - Action Buttons           │  │
│      │  └────────────────────────────┘  │
│      │                                  │
│ Nav  │  ┌────────────────────────────┐  │
│ Menu │  │ Filters / Search Bar       │  │
│      │  └────────────────────────────┘  │
│      │                                  │
│      │  ┌────────────────────────────┐  │
│      │  │                            │  │
│      │  │ Main Content Area          │  │
│      │  │ (Table / Form / Dashboard) │  │
│      │  │                            │  │
│      │  └────────────────────────────┘  │
│      │                                  │
│      │  Pagination / Load More          │
└──────┴──────────────────────────────────┘
```

### Interaction Patterns
- **Optimistic UI:** Immediate feedback, revert on error
- **Confirmation Dialogs:** For destructive actions (delete, revoke)
- **Inline Editing:** Click to edit where appropriate
- **Keyboard Shortcuts:** Power user features (Cmd+K for search)
- **Contextual Help:** Tooltips with (?) icons
- **Progressive Disclosure:** Hide advanced options by default

### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

---

## 🔧 Technical Implementation Details

### API Route Pattern
All routes use consistent error handling and auth:

```typescript
import { apiHandler, requireOrg, successResponse } from '@/lib/utils/api';
import { parseBody } from '@/lib/utils/api';
import { mySchema } from '@/lib/validations/api';

export const POST = apiHandler(async (request) => {
  const { orgId, userId, role } = await requireOrg();
  const body = await parseBody(request, mySchema);

  // Business logic here

  return successResponse(data);
});
```

### RLS Policy Pattern
All queries use service role on backend, client role for direct queries:

```sql
-- Users can read their own data
CREATE POLICY "Users can read own data"
  ON table_name FOR SELECT
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_id = (auth.uid())::TEXT
    )
  );

-- Admins can manage org data
CREATE POLICY "Admins can manage org data"
  ON table_name FOR ALL
  USING (
    org_id IN (
      SELECT org_id FROM users
      WHERE clerk_id = (auth.uid())::TEXT
      AND role IN ('owner', 'admin')
    )
  );
```

### Component Pattern
All components use TypeScript and follow Next.js conventions:

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface MyComponentProps {
  initialData?: string;
}

export function MyComponent({ initialData }: MyComponentProps) {
  const [data, setData] = useState(initialData);

  return (
    <div className="space-y-4">
      {/* Component JSX */}
    </div>
  );
}
```

---

## 🚀 Agent & MCP Server Usage Strategy

### Recommended Agents for Each Phase

#### Phase 2 (Backend APIs)
1. **supabase-specialist** - Apply remaining migrations, verify RLS
2. **api-architect** - Build all API routes with proper validation
3. **test-engineer** - Write unit tests for API routes

#### Phase 3 (UI Components)
1. **tailwind-ui-architect** - Build shadcn/ui components
2. **nextjs-vercel-pro:frontend-developer** - React components and state

#### Phase 4 (Settings Pages)
1. **nextjs-vercel-pro:fullstack-developer** - Full page implementations
2. **tailwind-ui-architect** - UI polish and responsiveness

#### Phase 5+ (Advanced Features)
1. **security-pro:security-auditor** - Security review and penetration testing
2. **performance-optimizer:performance-engineer** - Query and rendering optimization
3. **test-engineer** - Comprehensive test suite

### MCP Servers to Leverage
1. **mcp__supabase__*** - All database operations
2. **mcp__shadcn-ui__*** - Component reference and demos
3. **mcp__ide__getDiagnostics** - Type checking and error detection

### Parallel Execution Strategy
For maximum efficiency, run agents in parallel:

**Example for Phase 2:**
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ supabase-       │  │ api-architect   │  │ api-architect   │
│ specialist      │  │ Profile APIs    │  │ Org APIs        │
│ Migrations      │  │                 │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
        ↓                     ↓                     ↓
   ✅ Complete          ✅ Complete          ✅ Complete
```

---

## 📋 Immediate Next Steps

### Action Items for This Session
1. ✅ Complete database schema analysis
2. ⏳ Apply remaining 3 migrations (034, 036, 038)
3. ⏳ Generate TypeScript types from schema
4. ⏳ Create Zod validation schemas
5. ⏳ Start Phase 2 API development

### Ready to Execute
All planning is complete. The system is architected and ready for implementation. We have:
- ✅ 9 database migrations (6 applied, 3 ready)
- ✅ Comprehensive permission matrix
- ✅ Feature ideation complete
- ✅ UI/UX design principles defined
- ✅ Technical architecture documented
- ✅ Implementation roadmap planned
- ✅ Agent strategy defined

---

## 🎯 Success Metrics

### Functional Goals
- [ ] All 4 roles properly enforced across the system
- [ ] Complete CRUD for users, orgs, departments
- [ ] Content visibility working correctly
- [ ] Audit logging comprehensive and queryable
- [ ] Session management functional

### Security Goals
- [ ] All RLS policies tested and verified
- [ ] No privilege escalation vulnerabilities
- [ ] API keys properly hashed and secured
- [ ] Webhook signatures verified
- [ ] CSRF protection in place

### Performance Goals
- [ ] API routes: p95 < 200ms
- [ ] Page load: LCP < 1s
- [ ] Database queries optimized
- [ ] Proper indexes on all lookups
- [ ] Pagination on large datasets

### UX Goals
- [ ] Intuitive navigation
- [ ] Clear error messages
- [ ] Loading states on all async ops
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] WCAG 2.1 AA compliant

### Code Quality Goals
- [ ] TypeScript strict mode
- [ ] 80%+ test coverage
- [ ] ESLint passing
- [ ] Prettier formatted
- [ ] No console errors/warnings

---

**Ready to build! 🚀 Let's create an enterprise-grade organization management system that sets a new standard for SaaS platforms!**
