# Department Management API

This document describes the department management API routes for hierarchical organization structure.

## Overview

Departments provide a hierarchical structure for organizing users and content within an organization. Key features:

- **Hierarchical Structure**: Departments can have parent-child relationships
- **Member Management**: Users can belong to multiple departments
- **Content Visibility**: Departments define default visibility for content
- **Circular Reference Prevention**: Built-in validation prevents invalid hierarchies
- **RLS Security**: All queries are scoped to the user's organization

## API Routes

### 1. List Departments

**Endpoint**: `GET /api/organizations/departments`

**Authentication**: Requires organization membership (any role)

**Query Parameters**:
- `includeTree` (boolean, optional): Return hierarchical tree structure instead of flat list
- `includeMembers` (boolean, optional): Include member count per department

**Response**:
```json
{
  "data": {
    "departments": [
      {
        "id": "uuid",
        "orgId": "uuid",
        "parentId": "uuid | null",
        "name": "Engineering",
        "description": "Engineering department",
        "slug": "engineering",
        "defaultVisibility": "department",
        "createdAt": "2025-10-14T10:00:00Z",
        "updatedAt": "2025-10-14T10:00:00Z",
        "createdBy": "uuid",
        "memberCount": 15,
        "children": []  // Only if includeTree=true
      }
    ],
    "total": 1
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
# Flat list with member counts
curl -X GET "https://your-app.com/api/organizations/departments?includeMembers=true" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Hierarchical tree
curl -X GET "https://your-app.com/api/organizations/departments?includeTree=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 2. Create Department

**Endpoint**: `POST /api/organizations/departments`

**Authentication**: Requires admin or owner role

**Request Body**:
```json
{
  "name": "Engineering",
  "description": "Engineering department (optional)",
  "slug": "engineering (optional, auto-generated if not provided)",
  "parentId": "uuid (optional)",
  "defaultVisibility": "department (optional, defaults to 'department')"
}
```

**Validation**:
- `name`: Required, 1-255 characters
- `description`: Optional, max 2000 characters
- `slug`: Optional, lowercase letters/numbers/hyphens only, auto-generated from name if not provided
- `parentId`: Optional UUID, must exist in same organization
- `defaultVisibility`: One of: `private`, `department`, `org`, `public`

**Response**:
```json
{
  "data": {
    "department": {
      "id": "uuid",
      "orgId": "uuid",
      "parentId": "uuid | null",
      "name": "Engineering",
      "description": "Engineering department",
      "slug": "engineering",
      "defaultVisibility": "department",
      "createdAt": "2025-10-14T10:00:00Z",
      "updatedAt": "2025-10-14T10:00:00Z",
      "createdBy": "uuid",
      "memberCount": 0
    }
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
curl -X POST "https://your-app.com/api/organizations/departments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Engineering",
    "description": "Engineering team",
    "defaultVisibility": "department"
  }'
```

**Error Responses**:
- `400 Bad Request`: Invalid input, parent not found, slug already exists
- `403 Forbidden`: Not admin or owner
- `500 Internal Server Error`: Database error

---

### 3. Get Department Details

**Endpoint**: `GET /api/organizations/departments/{id}`

**Authentication**: Requires organization membership

**Response**:
```json
{
  "data": {
    "department": {
      "id": "uuid",
      "orgId": "uuid",
      "parentId": "uuid | null",
      "name": "Engineering",
      "description": "Engineering department",
      "slug": "engineering",
      "defaultVisibility": "department",
      "createdAt": "2025-10-14T10:00:00Z",
      "updatedAt": "2025-10-14T10:00:00Z",
      "createdBy": "uuid",
      "memberCount": 15,
      "path": ["Root Dept", "Engineering"]  // Breadcrumb path
    }
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
curl -X GET "https://your-app.com/api/organizations/departments/DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 4. Update Department

**Endpoint**: `PATCH /api/organizations/departments/{id}`

**Authentication**: Requires admin or owner role

**Request Body**:
```json
{
  "name": "Engineering (optional)",
  "description": "Updated description (optional)",
  "parentId": "uuid | null (optional)",
  "defaultVisibility": "department (optional)"
}
```

**Validation**:
- All fields are optional
- Cannot set department as its own parent
- Cannot create circular references (parent cannot be a descendant)
- Parent must exist in same organization

**Response**:
```json
{
  "data": {
    "department": {
      "id": "uuid",
      "orgId": "uuid",
      "parentId": "uuid | null",
      "name": "Engineering",
      "description": "Updated description",
      "slug": "engineering",
      "defaultVisibility": "department",
      "createdAt": "2025-10-14T10:00:00Z",
      "updatedAt": "2025-10-14T12:00:00Z",
      "createdBy": "uuid",
      "memberCount": 15
    }
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
curl -X PATCH "https://your-app.com/api/organizations/departments/DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Software Engineering",
    "description": "Updated description"
  }'
```

**Error Responses**:
- `400 Bad Request`: Circular reference, invalid parent, department is own parent
- `403 Forbidden`: Not admin or owner
- `404 Not Found`: Department not found

---

### 5. Delete Department

**Endpoint**: `DELETE /api/organizations/departments/{id}`

**Authentication**: Requires admin or owner role

**Query Parameters**:
- `reassignUsersTo` (string, optional): Department ID to reassign users to

**Validation**:
- Cannot delete department with child departments
- If `reassignUsersTo` provided, users are moved to target department
- If not provided, all user associations are removed

**Response**:
```json
{
  "data": {
    "message": "Department deleted successfully",
    "reassignedUsers": true
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
# Delete and remove all users
curl -X DELETE "https://your-app.com/api/organizations/departments/DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Delete and reassign users to another department
curl -X DELETE "https://your-app.com/api/organizations/departments/DEPT_ID?reassignUsersTo=OTHER_DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Error Responses**:
- `400 Bad Request`: Department has children, invalid reassignment target
- `403 Forbidden`: Not admin or owner
- `404 Not Found`: Department not found

---

### 6. List Department Members

**Endpoint**: `GET /api/organizations/departments/{id}/members`

**Authentication**: Requires organization membership

**Query Parameters**:
- `page` (number, optional, default: 1): Page number
- `limit` (number, optional, default: 50, max: 100): Items per page
- `includeDetails` (boolean, optional, default: false): Include user details

**Response**:
```json
{
  "data": {
    "members": [
      {
        "userId": "uuid",
        "departmentId": "uuid",
        "createdAt": "2025-10-14T10:00:00Z",
        "user": {  // Only if includeDetails=true
          "id": "uuid",
          "email": "user@example.com",
          "name": "John Doe",
          "role": "contributor"
        }
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 50,
      "totalPages": 1,
      "hasMore": false
    }
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
# Simple list
curl -X GET "https://your-app.com/api/organizations/departments/DEPT_ID/members" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With user details and pagination
curl -X GET "https://your-app.com/api/organizations/departments/DEPT_ID/members?includeDetails=true&page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

### 7. Add User to Department

**Endpoint**: `POST /api/organizations/departments/{id}/members`

**Authentication**: Requires admin or owner role

**Request Body**:
```json
{
  "userId": "uuid"
}
```

**Validation**:
- User must exist in same organization
- Prevents duplicate memberships

**Response**:
```json
{
  "data": {
    "member": {
      "userId": "uuid",
      "departmentId": "uuid",
      "createdAt": "2025-10-14T10:00:00Z",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "name": "John Doe"
      }
    },
    "message": "User user@example.com added to department Engineering"
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
curl -X POST "https://your-app.com/api/organizations/departments/DEPT_ID/members" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID"
  }'
```

**Error Responses**:
- `400 Bad Request`: User not found, already member, not in organization
- `403 Forbidden`: Not admin or owner
- `404 Not Found`: Department not found

---

### 8. Remove User from Department

**Endpoint**: `DELETE /api/organizations/departments/{id}/members`

**Authentication**: Requires admin or owner role

**Request Body**:
```json
{
  "userId": "uuid"
}
```

**Response**:
```json
{
  "data": {
    "message": "User user@example.com removed from department Engineering"
  },
  "requestId": "req_..."
}
```

**Example**:
```bash
curl -X DELETE "https://your-app.com/api/organizations/departments/DEPT_ID/members" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID"
  }'
```

**Error Responses**:
- `400 Bad Request`: User not found, not member, not in organization
- `403 Forbidden`: Not admin or owner
- `404 Not Found`: Department not found

---

## Database Functions

The API leverages PostgreSQL functions from migration `031_create_departments_table.sql`:

### `get_department_path(dept_id UUID)`

Returns breadcrumb path from root to specified department.

**Example**:
```sql
SELECT get_department_path('uuid');
-- Returns: ['Company', 'Engineering', 'Backend']
```

### `is_descendant_of(child_id UUID, ancestor_id UUID)`

Checks if a department is a descendant of another (for circular reference prevention).

**Example**:
```sql
SELECT is_descendant_of('child_uuid', 'parent_uuid');
-- Returns: true/false
```

---

## Security Considerations

### Row-Level Security (RLS)

All tables have RLS enabled:

1. **departments**: Users can only access departments in their organization
2. **user_departments**: Users can only see memberships within their organization
3. **Admin operations**: Only admins and owners can create/update/delete departments

### Authorization Checks

- **GET endpoints**: Require organization membership
- **POST/PATCH/DELETE endpoints**: Require admin or owner role
- **Organization scoping**: All queries include `org_id` filter
- **Clerk integration**: User authentication via Clerk, mapped to internal users table

### Validation

- **Circular reference prevention**: `is_descendant_of()` function prevents invalid hierarchies
- **Parent validation**: Parent department must exist in same organization
- **Slug uniqueness**: Slugs must be unique within organization
- **User validation**: Users must belong to same organization

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "code": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {},  // Optional error details
  "requestId": "req_..."
}
```

**Common Error Codes**:
- `UNAUTHORIZED` (401): Not authenticated
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Resource not found
- `BAD_REQUEST` (400): Invalid input or business logic violation
- `VALIDATION_ERROR` (400): Request body validation failed
- `INTERNAL_ERROR` (500): Server error

---

## Performance Considerations

1. **Indexes**: All foreign keys and frequently queried columns are indexed
2. **Pagination**: Member lists support pagination to handle large departments
3. **Selective loading**: Use `includeTree` and `includeDetails` flags to control response size
4. **RLS optimization**: Queries use indexes for `org_id` filtering

---

## Testing Checklist

### Unit Tests
- [ ] Validate Zod schemas for all request/response types
- [ ] Test helper functions (buildDepartmentTree, generateSlug)
- [ ] Test circular reference detection logic

### Integration Tests
- [ ] Create department with valid data
- [ ] Create department with parent relationship
- [ ] Prevent circular reference creation
- [ ] List departments in flat and tree structure
- [ ] Update department name and parent
- [ ] Delete department with user reassignment
- [ ] Add/remove users from department
- [ ] Pagination for member lists

### Security Tests
- [ ] Unauthorized access returns 401
- [ ] Non-admin cannot create/update/delete departments
- [ ] Cross-organization access is blocked
- [ ] RLS policies enforce organization boundaries

---

## Migration Dependencies

This API requires the following database migrations:

1. `030_enhance_organizations_table.sql` - Organization structure
2. `031_create_departments_table.sql` - Department tables and functions
3. `032_enhance_users_table.sql` - User fields

Ensure all migrations are applied before using this API.
