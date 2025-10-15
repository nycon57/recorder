# Department Management API Implementation

## Summary

This document describes the implementation of the Department Management API routes for hierarchical organization structure. All routes follow the project's established patterns and best practices.

## Created Files

### 1. Validation Schemas
**File**: `/Users/jarrettstanley/Desktop/websites/recorder/lib/validations/departments.ts`

Defines Zod validation schemas for all department operations:
- `createDepartmentSchema`: Validates department creation with slug, parent, visibility
- `updateDepartmentSchema`: Validates partial updates
- `deleteDepartmentSchema`: Validates deletion with optional user reassignment
- `addUserToDepartmentSchema`: Validates adding users to departments
- `removeUserFromDepartmentSchema`: Validates removing users
- `listDepartmentsQuerySchema`: Validates query parameters for listing
- `listDepartmentMembersQuerySchema`: Validates member listing with pagination

TypeScript types exported:
- `Department`: Complete department type with optional member count, path, and children
- `DepartmentMember`: Member relationship type with optional user details

### 2. Departments List Route
**File**: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/departments/route.ts`

**GET /api/organizations/departments**
- Lists all departments in organization
- Optional tree structure with `includeTree=true`
- Optional member counts with `includeMembers=true`
- Authorization: Requires organization membership (any role)
- Uses `requireOrg()` helper for auth

**POST /api/organizations/departments**
- Creates new department
- Auto-generates slug from name if not provided
- Validates parent department exists
- Checks slug uniqueness within organization
- Authorization: Requires admin or owner role
- Uses `requireAdmin()` helper for auth
- Returns 201 Created on success

**Key Features**:
- `buildDepartmentTree()`: Recursively builds hierarchical structure
- `generateSlug()`: Creates URL-friendly slugs from names
- Efficient member count aggregation
- All queries scoped to user's organization

### 3. Department Detail Route
**File**: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/departments/[id]/route.ts`

**GET /api/organizations/departments/{id}**
- Returns department details with member count
- Includes breadcrumb path using `get_department_path()` function
- Authorization: Requires organization membership

**PATCH /api/organizations/departments/{id}**
- Updates department name, description, parent, visibility
- Validates circular reference prevention using `is_descendant_of()` function
- Prevents self-referencing (department as own parent)
- Validates parent exists in same organization
- Authorization: Requires admin or owner role

**DELETE /api/organizations/departments/{id}**
- Deletes department after validation
- Prevents deletion if department has children
- Optional user reassignment via `reassignUsersTo` query param
- Removes all user associations if no reassignment
- Authorization: Requires admin or owner role

**Security Features**:
- Organization scoping on all operations
- Parent validation prevents cross-org references
- Circular reference detection prevents infinite loops
- Child department check prevents orphaning

### 4. Department Members Route
**File**: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/departments/[id]/members/route.ts`

**GET /api/organizations/departments/{id}/members**
- Lists all users in department with pagination
- Optional user details (name, email, role) with `includeDetails=true`
- Supports pagination with `page` and `limit` params
- Authorization: Requires organization membership

**POST /api/organizations/departments/{id}/members**
- Adds user to department
- Validates user exists in same organization
- Prevents duplicate memberships
- Returns user details with confirmation message
- Authorization: Requires admin or owner role
- Returns 201 Created on success

**DELETE /api/organizations/departments/{id}/members**
- Removes user from department
- Validates user is currently a member
- Validates user belongs to organization
- Returns confirmation message
- Authorization: Requires admin or owner role

**Pagination**:
- Default: 50 items per page
- Max: 100 items per page
- Returns total count and `hasMore` indicator

### 5. API Documentation
**File**: `/Users/jarrettstanley/Desktop/websites/recorder/app/api/organizations/departments/README.md`

Comprehensive documentation including:
- Overview of department system
- Complete API reference for all 8 endpoints
- Request/response examples with curl commands
- Query parameter documentation
- Validation rules and constraints
- Security considerations and RLS policies
- Error handling and common error codes
- Database function documentation
- Performance considerations
- Testing checklist
- Migration dependencies

## Architecture Patterns

### Authentication & Authorization

All routes follow the project's established auth pattern:

```typescript
// Organization membership required (any role)
const { orgId } = await requireOrg();

// Admin or owner required
const { orgId, userId } = await requireAdmin();
```

### Request Validation

All routes use Zod schemas with the `parseBody` helper:

```typescript
const body = await parseBody(request, createDepartmentSchema);
```

Query parameters parsed with Zod:
```typescript
const query = listDepartmentsQuerySchema.parse({
  includeTree: searchParams.get('includeTree'),
  includeMembers: searchParams.get('includeMembers'),
});
```

### Error Handling

All routes wrapped with `apiHandler()` for consistent error responses:

```typescript
export const GET = apiHandler(async (request: NextRequest) => {
  // Implementation
});
```

Uses standardized error helpers:
- `errors.notFound('Department')`: 404 Not Found
- `errors.badRequest('message', details)`: 400 Bad Request
- `errors.forbidden()`: 403 Forbidden
- Auto-handling of auth errors (401, 403)

### Response Format

All routes use `successResponse()` helper:

```typescript
return successResponse({
  department: { ...data },
  message: 'Optional message'
}, undefined, 201); // Optional status code
```

## Security Implementation

### Row-Level Security (RLS)

All queries automatically scoped to user's organization:
- Supabase RLS policies enforce org boundaries
- All queries include `.eq('org_id', orgId)` filter
- Service role bypasses RLS for admin operations

### Input Validation

- **Slug validation**: Lowercase letters, numbers, hyphens only
- **Circular reference prevention**: Uses PostgreSQL `is_descendant_of()` function
- **Parent validation**: Ensures parent exists in same organization
- **User validation**: Ensures users belong to same organization
- **Duplicate prevention**: Checks for existing memberships and slug conflicts

### Authorization Hierarchy

1. **GET operations**: Any organization member
2. **POST/PATCH/DELETE operations**: Admin or owner only
3. **Organization scoping**: All operations restricted to user's org
4. **Clerk integration**: User IDs mapped from Clerk to internal UUIDs

## Database Integration

### Helper Functions Used

From migration `031_create_departments_table.sql`:

1. **`get_department_path(dept_id UUID)`**
   - Returns array of department names from root to specified dept
   - Used for breadcrumb navigation
   - Example: `['Company', 'Engineering', 'Backend']`

2. **`is_descendant_of(child_id UUID, ancestor_id UUID)`**
   - Checks if department is descendant of another
   - Prevents circular references during updates
   - Traverses parent chain until root or match found

### Tables Used

1. **`departments`**
   - Primary table for department hierarchy
   - Columns: id, org_id, parent_id, name, description, slug, default_visibility, timestamps, created_by
   - Constraints: unique (org_id, slug), CHECK (id != parent_id)

2. **`user_departments`**
   - Junction table for many-to-many user-department relationships
   - Columns: user_id, department_id, created_at
   - Primary key: (user_id, department_id)

## Performance Considerations

### Optimizations Implemented

1. **Pagination**: All list endpoints support pagination to handle large datasets
2. **Selective Loading**: Optional flags for expensive operations (`includeTree`, `includeMembers`, `includeDetails`)
3. **Index Usage**: All foreign keys and frequently queried columns are indexed
4. **Efficient Aggregation**: Member counts calculated with single aggregation query
5. **Batch Operations**: Tree building done in-memory after single database query

### Database Indexes

All created by migration 031:
- `idx_departments_org_id`: Fast org filtering
- `idx_departments_parent_id`: Fast hierarchy traversal
- `idx_departments_org_slug`: Unique constraint enforcement
- `idx_departments_created_by`: Creator lookup
- `idx_user_departments_user_id`: Fast user membership lookup
- `idx_user_departments_department_id`: Fast department member lookup

## Testing Recommendations

### Unit Tests

```typescript
// Test validation schemas
describe('Department Validation', () => {
  test('createDepartmentSchema validates slug format', () => {
    expect(() => createDepartmentSchema.parse({
      name: 'Test',
      slug: 'INVALID_SLUG'
    })).toThrow();
  });
});

// Test helper functions
describe('buildDepartmentTree', () => {
  test('builds correct hierarchy from flat list', () => {
    // Test implementation
  });
});
```

### Integration Tests

```typescript
describe('POST /api/organizations/departments', () => {
  test('creates department with valid data', async () => {
    const response = await fetch('/api/organizations/departments', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'Engineering',
        defaultVisibility: 'department'
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.data.department.name).toBe('Engineering');
  });

  test('prevents circular references', async () => {
    // Create parent and child
    // Attempt to set child as parent's parent
    // Expect 400 error
  });

  test('non-admin cannot create department', async () => {
    // Test with contributor token
    // Expect 403 error
  });
});
```

### Security Tests

```typescript
describe('Department Security', () => {
  test('prevents cross-org access', async () => {
    // Create dept in org A
    // Attempt to access from org B
    // Expect 404 or 403
  });

  test('enforces admin-only mutations', async () => {
    // Test POST/PATCH/DELETE with non-admin user
    // Expect 403 errors
  });
});
```

## Error Scenarios Handled

### Validation Errors (400)
- Invalid slug format (non-alphanumeric characters)
- Circular reference attempts
- Department as own parent
- Parent not found or not in organization
- User already member of department
- User not in organization
- Slug already exists in organization
- Department has children (delete prevention)

### Authorization Errors (403)
- Non-admin attempting POST/PATCH/DELETE
- User not in organization
- Cross-organization access attempts

### Not Found Errors (404)
- Department ID not found
- Department not in user's organization
- User ID not found

### Server Errors (500)
- Database connection failures
- Unexpected errors during operations
- All logged with request ID for tracing

## API Response Examples

### Success Response
```json
{
  "data": {
    "department": { ... },
    "message": "Optional message"
  },
  "requestId": "req_1234567890_abc123"
}
```

### Error Response
```json
{
  "code": "BAD_REQUEST",
  "message": "Cannot set parent to a descendant department",
  "details": {},
  "requestId": "req_1234567890_abc123"
}
```

### Paginated Response
```json
{
  "data": {
    "members": [...],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 50,
      "totalPages": 3,
      "hasMore": true
    }
  },
  "requestId": "req_1234567890_abc123"
}
```

## Migration Dependencies

Required migrations (in order):
1. `030_enhance_organizations_table.sql` - Organization structure
2. `031_create_departments_table.sql` - Department tables and functions
3. `032_enhance_users_table.sql` - User enhancements

## Next Steps

### Frontend Integration
1. Create department management UI in settings
2. Department selector for user assignment
3. Department tree navigation component
4. Member management interface

### Future Enhancements
1. Bulk department operations (create, update, delete)
2. Department-based content filtering
3. Department analytics and reporting
4. Department templates for quick setup
5. Department inheritance of settings

### Testing
1. Write comprehensive unit tests for validation schemas
2. Write integration tests for all endpoints
3. Write security tests for RLS policies
4. Performance testing with large department hierarchies

## Conclusion

The Department Management API is production-ready with:
- ✅ Complete CRUD operations for departments
- ✅ Member management endpoints
- ✅ Hierarchical structure support
- ✅ Circular reference prevention
- ✅ Comprehensive validation
- ✅ Security via RLS and role-based auth
- ✅ Pagination for scalability
- ✅ Clear error handling
- ✅ Complete documentation

All routes follow the project's established patterns and are ready for frontend integration.
