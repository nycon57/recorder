# Profile Management API Implementation

## Summary

Successfully implemented profile management API routes for the organization management system following Next.js 14 App Router patterns and project conventions.

## Files Created

### API Routes

#### 1. `/app/api/profile/route.ts`
Main profile endpoint for fetching and updating user data.

**Endpoints:**
- `GET /api/profile` - Fetch current user profile
  - Authentication: Required (Clerk)
  - Returns: Full user profile excluding sensitive fields
  - Fields: id, email, name, avatar_url, title, bio, phone, timezone, org_id, role, status, activity tracking, preferences, timestamps

- `PATCH /api/profile` - Update user profile
  - Authentication: Required (Clerk)
  - Validation: Zod schema (updateProfileSchema)
  - Updatable fields: name, title, bio, phone, timezone, notification_preferences, ui_preferences
  - Automatically updates `updated_at` timestamp
  - Returns: Updated user profile

**Security:**
- Uses `requireAuth()` for authentication
- Uses `supabaseAdmin` client to bypass RLS (auth already validated)
- Updates only allowed fields via Zod schema validation
- User can only update their own profile (matched by clerk_id)

---

#### 2. `/app/api/profile/avatar/route.ts`
Avatar image upload and management endpoint.

**Endpoints:**
- `POST /api/profile/avatar` - Upload user avatar
  - Authentication: Required (Clerk)
  - Content-Type: multipart/form-data
  - File validation:
    - Allowed types: JPEG, PNG, WebP, GIF
    - Max size: 5MB
  - Image processing:
    - Resizes to 500x500px (cover, center)
    - Converts to WebP format (quality: 85%)
    - Uses sharp library for optimization
  - Storage: Supabase Storage (avatars bucket)
  - Path pattern: `org_{org_id}/avatars/{user_id}-{timestamp}.webp`
  - Updates `users.avatar_url` in database
  - Returns: `{ avatarUrl: string }`

- `DELETE /api/profile/avatar` - Remove user avatar
  - Authentication: Required (Clerk)
  - Sets `users.avatar_url` to null
  - Returns: `{ success: true }`

**Security:**
- File type validation (only images)
- File size validation (5MB max)
- Image processing prevents malicious file uploads
- Files stored under org-specific paths
- Public read access (avatars are public)

---

#### 3. `/app/api/profile/sessions/route.ts`
User session management endpoint.

**Endpoints:**
- `GET /api/profile/sessions` - List all active sessions
  - Authentication: Required (Clerk)
  - Returns only active sessions (not revoked, not expired)
  - Sorted by last_active_at (descending)
  - Response fields:
    - id, clerkSessionId, ipAddress, userAgent
    - deviceType, browser, os, location
    - createdAt, lastActiveAt, expiresAt
  - Excludes sensitive `session_token` field
  - Returns: `{ sessions: [...], total: number }`

- `DELETE /api/profile/sessions` - Revoke a specific session
  - Authentication: Required (Clerk)
  - Validation: Zod schema (revokeSessionSchema)
  - Body: `{ sessionId: UUID }`
  - Verifies session ownership (user can only revoke own sessions)
  - Sets `revoked_at` timestamp (soft delete)
  - Returns: `{ success: true, sessionId: string }`

**Security:**
- User can only view/revoke their own sessions
- Ownership verification before revocation
- RLS policies on user_sessions table enforce access control
- Soft delete pattern (revoked_at) for audit trail

---

### Validation Schemas

Added to `/lib/validations/api.ts`:

```typescript
// Update user profile schema
export const updateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  title: z.string().max(255).optional().nullable(),
  bio: z.string().max(1000).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  timezone: z.string().max(100).optional(),
  notification_preferences: z.record(z.any()).optional(),
  ui_preferences: z.record(z.any()).optional(),
});

// Avatar upload schema
export const avatarUploadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().positive().max(5 * 1024 * 1024), // Max 5MB
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
});

// Revoke session schema
export const revokeSessionSchema = z.object({
  sessionId: z.string().uuid(),
});
```

---

### Database Migration

Created `/supabase/migrations/039_create_avatars_storage_bucket.sql`:

**Storage Bucket:**
- Bucket ID: `avatars`
- Public: true (avatars are publicly readable)

**RLS Policies:**
1. Users can upload their own avatar (INSERT)
2. Users can update their own avatar (UPDATE)
3. Users can delete their own avatar (DELETE)
4. Anyone can view avatars (SELECT)
5. Service role has full access

**Security:**
- Authenticated users only for writes
- Public read access
- Path pattern enforced: `org_{org_id}/avatars/*`

---

## Architecture Patterns Used

### 1. API Handler Wrapper
All routes use `apiHandler()` for consistent error handling and request ID generation:

```typescript
export const GET = apiHandler(async (request: NextRequest) => {
  // Implementation
});
```

### 2. Authentication
Uses `requireAuth()` for endpoints that only need user authentication (not org context):

```typescript
const { userId } = await requireAuth();
```

### 3. Validation
Uses `parseBody()` with Zod schemas for request validation:

```typescript
const body = await parseBody(request, updateProfileSchema);
```

### 4. Response Helpers
Uses standardized response functions:

```typescript
return successResponse(data);
return errors.notFound('Resource');
return errors.badRequest('Message');
```

### 5. Admin Client Pattern
Uses `supabaseAdmin` client to bypass RLS after auth validation:

```typescript
const supabase = supabaseAdmin;
// Auth already validated via requireAuth()
```

### 6. Timestamp Management
Automatically updates `updated_at` on mutations:

```typescript
{
  ...body,
  updated_at: new Date().toISOString(),
}
```

---

## Security Considerations

### Input Validation
- All user inputs validated with Zod schemas
- File uploads validated (type, size)
- SQL injection prevented via Supabase client parameterization

### Authentication & Authorization
- All routes require Clerk authentication
- User can only access/modify their own data
- Ownership verification before destructive operations
- RLS policies as defense-in-depth

### File Upload Security
- File type whitelist (only images)
- File size limits (5MB max)
- Image processing with sharp (prevents malicious files)
- Files stored under org-specific paths
- Public URLs only for avatars (appropriate for profile images)

### Session Management
- Users can only view/revoke their own sessions
- Soft delete pattern for audit trail
- Expired sessions filtered from responses
- Session token excluded from API responses

### Error Handling
- Generic error messages to avoid information leakage
- Detailed errors logged server-side only
- Request IDs for debugging without exposing internals

---

## Testing Checklist

### Profile Route (`/api/profile`)
- [ ] GET fetches user profile successfully
- [ ] GET returns 401 for unauthenticated requests
- [ ] PATCH updates allowed fields successfully
- [ ] PATCH rejects invalid data (Zod validation)
- [ ] PATCH updates `updated_at` timestamp
- [ ] PATCH returns 400 for invalid JSON body

### Avatar Route (`/api/profile/avatar`)
- [ ] POST uploads and processes image successfully
- [ ] POST resizes image to 500x500px
- [ ] POST converts image to WebP format
- [ ] POST rejects files over 5MB
- [ ] POST rejects non-image files
- [ ] POST updates users.avatar_url
- [ ] DELETE removes avatar successfully
- [ ] DELETE sets avatar_url to null

### Sessions Route (`/api/profile/sessions`)
- [ ] GET lists active sessions only
- [ ] GET excludes revoked sessions
- [ ] GET excludes expired sessions
- [ ] GET excludes session_token from response
- [ ] DELETE revokes session successfully
- [ ] DELETE rejects revoking another user's session
- [ ] DELETE returns 404 for non-existent session

### Security Tests
- [ ] Authenticated users can only access their own data
- [ ] Unauthenticated requests return 401
- [ ] File upload validates file types
- [ ] File upload enforces size limits
- [ ] Session revocation verifies ownership
- [ ] RLS policies prevent unauthorized access

---

## API Usage Examples

### Fetch User Profile
```bash
curl -X GET https://your-app.com/api/profile \
  -H "Authorization: Bearer <clerk-token>"
```

### Update Profile
```bash
curl -X PATCH https://your-app.com/api/profile \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "title": "Software Engineer",
    "bio": "Building awesome things",
    "phone": "+1234567890",
    "timezone": "America/New_York"
  }'
```

### Upload Avatar
```bash
curl -X POST https://your-app.com/api/profile/avatar \
  -H "Authorization: Bearer <clerk-token>" \
  -F "file=@avatar.jpg"
```

### Remove Avatar
```bash
curl -X DELETE https://your-app.com/api/profile/avatar \
  -H "Authorization: Bearer <clerk-token>"
```

### List Active Sessions
```bash
curl -X GET https://your-app.com/api/profile/sessions \
  -H "Authorization: Bearer <clerk-token>"
```

### Revoke Session
```bash
curl -X DELETE https://your-app.com/api/profile/sessions \
  -H "Authorization: Bearer <clerk-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "uuid-here"
  }'
```

---

## Dependencies

### Existing (Already Installed)
- `sharp@^0.34.4` - Image processing and optimization
- `zod` - Request validation
- `@supabase/supabase-js` - Database client
- `@clerk/nextjs` - Authentication

### No Additional Packages Required
All required dependencies are already in package.json.

---

## Database Schema

### Users Table (Enhanced)
Fields used by profile API:
- `id` (UUID) - Internal user ID
- `clerk_id` (TEXT) - Clerk user ID for auth
- `email` (TEXT)
- `name` (TEXT)
- `avatar_url` (TEXT)
- `title` (TEXT) - Job title
- `bio` (TEXT) - User biography
- `phone` (TEXT) - Phone number
- `timezone` (TEXT) - User timezone
- `notification_preferences` (JSONB)
- `ui_preferences` (JSONB)
- `updated_at` (TIMESTAMPTZ)

### User Sessions Table
Fields:
- `id` (UUID)
- `user_id` (UUID) - References users(id)
- `org_id` (UUID) - References organizations(id)
- `session_token` (TEXT) - Unique session token
- `clerk_session_id` (TEXT) - Reference to Clerk session
- `ip_address` (INET)
- `user_agent` (TEXT)
- `device_type` (TEXT) - desktop, mobile, tablet
- `browser` (TEXT)
- `os` (TEXT)
- `location` (JSONB) - Geolocation data
- `created_at` (TIMESTAMPTZ)
- `last_active_at` (TIMESTAMPTZ)
- `expires_at` (TIMESTAMPTZ)
- `revoked_at` (TIMESTAMPTZ) - Soft delete

### Storage Bucket: avatars
- Public read access
- Authenticated write access
- Path pattern: `org_{org_id}/avatars/{user_id}-{timestamp}.webp`

---

## Next Steps

1. **Apply Migration**
   ```bash
   # Apply the avatars storage bucket migration
   supabase migration up
   ```

2. **Frontend Integration**
   - Create ProfileSettings component
   - Implement avatar upload UI with preview
   - Build session management interface
   - Add form validation with react-hook-form + Zod

3. **Testing**
   - Write unit tests for validation schemas
   - Write integration tests for API routes
   - Test file upload scenarios
   - Test session management flows

4. **Monitoring**
   - Add logging for profile updates
   - Track avatar upload failures
   - Monitor session revocations
   - Set up alerts for suspicious activity

5. **Documentation**
   - Update API documentation
   - Add JSDoc comments to routes
   - Create user guide for profile settings
   - Document session management best practices

---

## File Paths (Absolute)

### API Routes
- `/Users/jarrettstanley/Desktop/websites/recorder/app/api/profile/route.ts`
- `/Users/jarrettstanley/Desktop/websites/recorder/app/api/profile/avatar/route.ts`
- `/Users/jarrettstanley/Desktop/websites/recorder/app/api/profile/sessions/route.ts`

### Validation Schemas
- `/Users/jarrettstanley/Desktop/websites/recorder/lib/validations/api.ts` (updated)

### Database Migration
- `/Users/jarrettstanley/Desktop/websites/recorder/supabase/migrations/039_create_avatars_storage_bucket.sql`

### Documentation
- `/Users/jarrettstanley/Desktop/websites/recorder/PROFILE_MANAGEMENT_API_IMPLEMENTATION.md`

---

## Summary of Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/profile` | Required | Fetch current user profile |
| PATCH | `/api/profile` | Required | Update user profile |
| POST | `/api/profile/avatar` | Required | Upload avatar image |
| DELETE | `/api/profile/avatar` | Required | Remove avatar |
| GET | `/api/profile/sessions` | Required | List active sessions |
| DELETE | `/api/profile/sessions` | Required | Revoke session |

All endpoints follow the project's established patterns and security best practices.
