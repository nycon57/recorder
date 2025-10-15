# Department Management API - Quick Start Guide

## Prerequisites

1. User must be authenticated via Clerk
2. User must belong to an organization
3. Admin or Owner role required for mutations (POST/PATCH/DELETE)

## Quick Examples

### 1. List All Departments (Flat)

```bash
curl -X GET "https://your-app.com/api/organizations/departments" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "data": {
    "departments": [
      {
        "id": "uuid",
        "name": "Engineering",
        "slug": "engineering",
        "parentId": null,
        "defaultVisibility": "department"
      }
    ],
    "total": 1
  }
}
```

### 2. List Departments as Tree

```bash
curl -X GET "https://your-app.com/api/organizations/departments?includeTree=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response includes nested children**:
```json
{
  "data": {
    "departments": [
      {
        "id": "uuid",
        "name": "Engineering",
        "children": [
          {
            "id": "uuid",
            "name": "Backend",
            "parentId": "parent-uuid",
            "children": []
          }
        ]
      }
    ]
  }
}
```

### 3. Create Department

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

### 4. Create Child Department

```bash
curl -X POST "https://your-app.com/api/organizations/departments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend",
    "parentId": "PARENT_DEPT_UUID",
    "defaultVisibility": "department"
  }'
```

### 5. Update Department

```bash
curl -X PATCH "https://your-app.com/api/organizations/departments/DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Software Engineering",
    "description": "Updated description"
  }'
```

### 6. Move Department (Change Parent)

```bash
curl -X PATCH "https://your-app.com/api/organizations/departments/DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parentId": "NEW_PARENT_UUID"
  }'
```

### 7. Delete Department (Remove Users)

```bash
curl -X DELETE "https://your-app.com/api/organizations/departments/DEPT_ID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 8. Delete Department (Reassign Users)

```bash
curl -X DELETE "https://your-app.com/api/organizations/departments/DEPT_ID?reassignUsersTo=OTHER_DEPT_UUID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 9. List Department Members

```bash
curl -X GET "https://your-app.com/api/organizations/departments/DEPT_ID/members?includeDetails=true" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response**:
```json
{
  "data": {
    "members": [
      {
        "userId": "uuid",
        "departmentId": "uuid",
        "createdAt": "2025-10-14T10:00:00Z",
        "user": {
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
  }
}
```

### 10. Add User to Department

```bash
curl -X POST "https://your-app.com/api/organizations/departments/DEPT_ID/members" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID"
  }'
```

### 11. Remove User from Department

```bash
curl -X DELETE "https://your-app.com/api/organizations/departments/DEPT_ID/members" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_UUID"
  }'
```

## TypeScript Client Example

```typescript
import { z } from 'zod';

// Import types
import type { Department, DepartmentMember } from '@/lib/validations/departments';

class DepartmentAPI {
  private baseUrl = '/api/organizations/departments';

  async listDepartments(options?: {
    includeTree?: boolean;
    includeMembers?: boolean;
  }) {
    const params = new URLSearchParams();
    if (options?.includeTree) params.set('includeTree', 'true');
    if (options?.includeMembers) params.set('includeMembers', 'true');

    const response = await fetch(`${this.baseUrl}?${params}`);
    return response.json();
  }

  async createDepartment(data: {
    name: string;
    description?: string;
    parentId?: string;
    defaultVisibility?: 'private' | 'department' | 'org' | 'public';
  }) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async getDepartment(id: string) {
    const response = await fetch(`${this.baseUrl}/${id}`);
    return response.json();
  }

  async updateDepartment(id: string, data: {
    name?: string;
    description?: string;
    parentId?: string | null;
    defaultVisibility?: 'private' | 'department' | 'org' | 'public';
  }) {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async deleteDepartment(id: string, reassignUsersTo?: string) {
    const url = reassignUsersTo
      ? `${this.baseUrl}/${id}?reassignUsersTo=${reassignUsersTo}`
      : `${this.baseUrl}/${id}`;

    const response = await fetch(url, { method: 'DELETE' });
    return response.json();
  }

  async listMembers(departmentId: string, options?: {
    page?: number;
    limit?: number;
    includeDetails?: boolean;
  }) {
    const params = new URLSearchParams();
    if (options?.page) params.set('page', options.page.toString());
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.includeDetails) params.set('includeDetails', 'true');

    const response = await fetch(
      `${this.baseUrl}/${departmentId}/members?${params}`
    );
    return response.json();
  }

  async addMember(departmentId: string, userId: string) {
    const response = await fetch(`${this.baseUrl}/${departmentId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  }

  async removeMember(departmentId: string, userId: string) {
    const response = await fetch(`${this.baseUrl}/${departmentId}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return response.json();
  }
}

// Usage
const api = new DepartmentAPI();

// List all departments as tree
const { data } = await api.listDepartments({ includeTree: true });

// Create department
const newDept = await api.createDepartment({
  name: 'Engineering',
  defaultVisibility: 'department',
});

// Add user to department
await api.addMember(newDept.data.department.id, 'user-uuid');
```

## React Hook Example

```typescript
import { useState, useEffect } from 'react';
import type { Department } from '@/lib/validations/departments';

export function useDepartments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/organizations/departments?includeTree=true')
      .then(res => res.json())
      .then(({ data }) => {
        setDepartments(data.departments);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const createDepartment = async (data: {
    name: string;
    parentId?: string;
  }) => {
    const response = await fetch('/api/organizations/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to create department');

    const result = await response.json();
    setDepartments([...departments, result.data.department]);
    return result.data.department;
  };

  return {
    departments,
    loading,
    error,
    createDepartment,
  };
}

// Usage in component
function DepartmentList() {
  const { departments, loading, createDepartment } = useDepartments();

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      {departments.map(dept => (
        <div key={dept.id}>
          <h3>{dept.name}</h3>
          {dept.children && dept.children.map(child => (
            <div key={child.id} style={{ marginLeft: 20 }}>
              {child.name}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Common Patterns

### Building Breadcrumbs

```typescript
async function getBreadcrumbs(departmentId: string) {
  const response = await fetch(`/api/organizations/departments/${departmentId}`);
  const { data } = await response.json();
  return data.department.path; // ['Company', 'Engineering', 'Backend']
}
```

### Recursive Tree Rendering

```typescript
function DepartmentTree({ departments }: { departments: Department[] }) {
  return (
    <ul>
      {departments.map(dept => (
        <li key={dept.id}>
          <span>{dept.name}</span>
          {dept.children && dept.children.length > 0 && (
            <DepartmentTree departments={dept.children} />
          )}
        </li>
      ))}
    </ul>
  );
}
```

### Department Selector

```typescript
function DepartmentSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (deptId: string) => void;
}) {
  const { departments } = useDepartments();

  const flattenDepartments = (depts: Department[], level = 0): Array<{ id: string; name: string; level: number }> => {
    return depts.flatMap(dept => [
      { id: dept.id, name: dept.name, level },
      ...(dept.children ? flattenDepartments(dept.children, level + 1) : []),
    ]);
  };

  const options = flattenDepartments(departments);

  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">Select department</option>
      {options.map(opt => (
        <option key={opt.id} value={opt.id}>
          {'  '.repeat(opt.level)}{opt.name}
        </option>
      ))}
    </select>
  );
}
```

## Error Handling

```typescript
try {
  const response = await fetch('/api/organizations/departments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Engineering' }),
  });

  if (!response.ok) {
    const error = await response.json();

    switch (error.code) {
      case 'FORBIDDEN':
        console.error('You need admin privileges');
        break;
      case 'BAD_REQUEST':
        console.error('Invalid input:', error.message);
        break;
      case 'VALIDATION_ERROR':
        console.error('Validation failed:', error.details);
        break;
      default:
        console.error('Unexpected error:', error.message);
    }

    throw new Error(error.message);
  }

  const { data } = await response.json();
  return data.department;
} catch (error) {
  console.error('Failed to create department:', error);
  throw error;
}
```

## Performance Tips

1. **Use includeTree=false for large organizations**: Flat lists are faster
2. **Paginate member lists**: Use `limit` parameter to reduce payload size
3. **Use includeDetails=false** when you only need member IDs
4. **Cache department hierarchies**: They don't change frequently

## Security Notes

1. All mutations (POST/PATCH/DELETE) require admin or owner role
2. All queries automatically scoped to user's organization
3. Cross-organization access is prevented by RLS policies
4. Circular references are automatically prevented

## Migration Required

Ensure the following migration is applied:
```bash
# Apply department migration
psql $DATABASE_URL -f supabase/migrations/031_create_departments_table.sql
```
