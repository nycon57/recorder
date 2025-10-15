# Organization Management API - Quick Reference

## File Paths

All files created in this implementation:

```
/Users/jarrettstanley/Desktop/websites/recorder/
├── lib/validations/organizations.ts
├── app/api/organizations/
│   ├── current/route.ts
│   ├── stats/route.ts
│   └── members/
│       ├── route.ts
│       └── [id]/route.ts
└── ORGANIZATION_MANAGEMENT_API_SUMMARY.md
```

## API Endpoints

### Organization Management

```typescript
// Get current organization
GET /api/organizations/current

// Update organization
PATCH /api/organizations/current
Body: {
  name?: string;
  logo_url?: string;
  primary_color?: string; // hex color
  domain?: string;
  features?: Record<string, boolean>;
  settings?: Record<string, any>;
}

// Get organization statistics
GET /api/organizations/stats?include_quotas=true&include_usage=true
```

### Member Management

```typescript
// List members
GET /api/organizations/members?role=admin&status=active&page=1&limit=20

// Invite member
POST /api/organizations/members
Body: {
  email: string;
  role: "admin" | "contributor" | "reader";
  department_ids?: string[];
  custom_message?: string;
}

// Get member details
GET /api/organizations/members/[id]

// Update member
PATCH /api/organizations/members/[id]
Body: {
  role?: "owner" | "admin" | "contributor" | "reader";
  status?: "active" | "suspended";
  title?: string;
  department_ids?: string[];
}

// Remove member (soft delete)
DELETE /api/organizations/members/[id]
```

## Authorization Matrix

| Endpoint | Owner | Admin | Contributor | Reader |
|----------|-------|-------|-------------|--------|
| GET /organizations/current | ✅ | ✅ | ✅ | ✅ |
| PATCH /organizations/current | ✅ | ✅ | ❌ | ❌ |
| GET /organizations/stats | ✅ | ✅ | ❌ | ❌ |
| GET /members | ✅ | ✅ | ❌ | ❌ |
| POST /members | ✅ | ✅ | ❌ | ❌ |
| GET /members/[id] | ✅ | ✅ | ❌ | ❌ |
| PATCH /members/[id] | ✅ | ✅* | ❌ | ❌ |
| DELETE /members/[id] | ✅ | ✅* | ❌ | ❌ |

*Admin restrictions:
- Cannot modify owner roles
- Cannot assign owner role
- Cannot promote to admin role

## Response Types

### Success Response
```typescript
{
  data: T;
  requestId?: string;
}
```

### Error Response
```typescript
{
  code: string;
  message: string;
  details?: any;
  requestId?: string;
}
```

## HTTP Status Codes

- `200 OK` - Success
- `201 Created` - Resource created (invitations)
- `400 BAD_REQUEST` - Invalid input or business logic violation
- `401 UNAUTHORIZED` - Not authenticated
- `403 FORBIDDEN` - Insufficient permissions
- `404 NOT_FOUND` - Resource doesn't exist
- `402 QUOTA_EXCEEDED` - Organization limit reached
- `500 INTERNAL_ERROR` - Server error

## Key Security Features

1. **Role hierarchy enforcement**
   - Owner > Admin > Contributor > Reader
   - Only owner can assign/modify owner roles
   - At least one owner must remain

2. **Input validation**
   - All inputs validated with Zod schemas
   - UUID format validation
   - Email/domain/color format validation

3. **Quota enforcement**
   - Max users checked on invitation
   - Storage quotas displayed in stats
   - Returns 402 when quota exceeded

4. **Soft deletes**
   - Members marked with `deleted_at`
   - Preserves audit trail
   - Can be restored if needed

5. **Request tracing**
   - Every request gets unique requestId
   - Included in all responses
   - Used for logging and debugging

## Example Usage

### Update Organization Branding
```bash
curl -X PATCH https://app.example.com/api/organizations/current \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "logo_url": "https://storage.example.com/logo.png",
    "primary_color": "#FF5733",
    "domain": "acme.example.com"
  }'
```

### Invite New Member
```bash
curl -X POST https://app.example.com/api/organizations/members \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "role": "contributor",
    "custom_message": "Welcome to the team!"
  }'
```

### List Active Members
```bash
curl "https://app.example.com/api/organizations/members?status=active&page=1&limit=50"
```

### Update Member Role
```bash
curl -X PATCH https://app.example.com/api/organizations/members/{member-id} \
  -H "Content-Type: application/json" \
  -d '{
    "role": "admin"
  }'
```

## Testing Checklist

- [ ] All endpoints require proper authentication
- [ ] Role hierarchy is enforced correctly
- [ ] Cannot modify own role
- [ ] Cannot remove last owner
- [ ] Quota limits are enforced
- [ ] Input validation catches invalid data
- [ ] Soft deletes work correctly
- [ ] Domain uniqueness is enforced
- [ ] Request IDs are included in responses
- [ ] Errors return appropriate status codes

## Dependencies

Required database migrations:
- `030_enhance_organizations_table.sql`
- `031_create_departments_table.sql`
- `032_enhance_users_table.sql`
- `033_create_audit_logs_table.sql`
- `034_create_user_sessions_table.sql`
- `035_create_user_invitations_table.sql`

## Next Steps

1. **Email Integration**
   - Implement invitation email sending
   - Send notifications on role changes
   - Send removal notifications

2. **Session Management**
   - Revoke sessions on member removal
   - Track invitation acceptance

3. **Audit Logging**
   - Log all organization/member changes
   - Include IP, user agent, request ID

4. **Frontend Integration**
   - Build UI components for org settings
   - Create member management interface
   - Add invitation acceptance flow
