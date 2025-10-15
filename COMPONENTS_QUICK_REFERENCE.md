# Shared Components Quick Reference

Quick reference guide for using the shared UI components in the organization management system.

## Import

```tsx
import {
  UserAvatar,
  RoleBadge,
  DepartmentSelector,
  PermissionGuard,
  UsageProgressBar,
  AuditLogEntry,
  DataTable,
} from '@/app/components/shared';
```

## UserAvatar

```tsx
<UserAvatar
  name="John Doe"
  avatarUrl="/avatars/john.jpg"
  email="john@example.com"
  title="Software Engineer"
  status="online"  // 'online' | 'offline' | 'away' | 'busy'
  size="md"        // 'sm' | 'md' | 'lg' | 'xl'
  showTooltip
/>
```

## RoleBadge

```tsx
<RoleBadge
  role="admin"     // 'owner' | 'admin' | 'contributor' | 'reader'
  size="md"        // 'sm' | 'md' | 'lg'
  showIcon
  showTooltip
/>
```

## DepartmentSelector

```tsx
<DepartmentSelector
  departments={departments}
  value={selectedDeptId}              // string or string[]
  onValueChange={setSelectedDeptId}
  multiple={false}
  showBreadcrumb
  showCreateNew
  onCreateNew={() => openCreateDialog()}
  placeholder="Select department..."
/>
```

## PermissionGuard

```tsx
// Minimum role
<PermissionGuard userRole={user.role} minRole="admin">
  <AdminPanel />
</PermissionGuard>

// Specific roles
<PermissionGuard
  userRole={user.role}
  allowedRoles={['owner', 'admin']}
  showDefaultFallback
>
  <BillingSettings />
</PermissionGuard>

// Custom permission
<PermissionGuard
  hasPermission={canEdit}
  fallback={<div>No permission</div>}
>
  <EditButton />
</PermissionGuard>
```

## UsageProgressBar

```tsx
<UsageProgressBar
  current={75}
  max={100}
  label="Storage"
  unit="GB"
  description="Monthly storage quota"
  showPercentage
  showValues
  warningThreshold={70}  // default: 70
  dangerThreshold={90}   // default: 90
  size="md"              // 'sm' | 'md' | 'lg'
/>
```

## AuditLogEntry

```tsx
<AuditLogEntry
  entry={auditLog}
  user={userInfo}
  defaultExpanded={false}
  showIpAddress
  showUserAgent
/>
```

## DataTable

```tsx
const columns: Column<User>[] = [
  {
    key: 'name',
    header: 'Name',
    accessor: (user) => user.name,
    sortable: true,
    filterable: true,
    width: '200px',
  },
  {
    key: 'email',
    header: 'Email',
    accessor: (user) => user.email,
    sortable: true,
  },
  {
    key: 'role',
    header: 'Role',
    accessor: (user) => <RoleBadge role={user.role} />,
  },
];

<DataTable
  columns={columns}
  data={users}
  getItemId={(user) => user.id}

  // Selection
  selectable
  selectedIds={selected}
  onSelectionChange={setSelected}

  // Search & Filter
  searchable
  searchPlaceholder="Search users..."

  // Pagination
  paginated
  pageSize={25}
  pageSizeOptions={[10, 25, 50, 100]}

  // Bulk Actions
  bulkActions={(ids) => (
    <Button onClick={() => handleDelete(ids)}>
      Delete {ids.length}
    </Button>
  )}

  // States
  isLoading={loading}
  emptyMessage="No users found"

  // Events
  onRowClick={(user) => navigate(`/users/${user.id}`)}
/>
```

## Color Schemes

### Roles
- **Owner**: Purple (`purple-700`, `purple-400` dark)
- **Admin**: Blue (`blue-700`, `blue-400` dark)
- **Contributor**: Green (`green-700`, `green-400` dark)
- **Reader**: Gray (`gray-700`, `gray-400` dark)

### Status
- **Online**: Green (`green-500`)
- **Away**: Yellow (`yellow-500`)
- **Busy**: Red (`red-500`)
- **Offline**: Gray (`gray-400`)

### Usage Thresholds
- **Safe** (< 70%): Green
- **Warning** (70-90%): Yellow
- **Danger** (> 90%): Red

## TypeScript Types

```tsx
import type {
  UserAvatarProps,
  RoleBadgeProps,
  DepartmentSelectorProps,
  Department,
  PermissionGuardProps,
  UsageProgressBarProps,
  AuditLogEntryProps,
  AuditLogEntryData,
  AuditLogUser,
  DataTableProps,
  Column,
} from '@/app/components/shared';
```

## Utility Hooks

```tsx
// Check permissions programmatically
import { usePermission } from '@/app/components/shared';

const canEdit = usePermission({
  userRole: user.role,
  minRole: 'contributor',
});

// Compare roles
import { compareRoles, getRoleLevel } from '@/app/components/shared';

const comparison = compareRoles('admin', 'contributor'); // 'higher'
const level = getRoleLevel('admin'); // 3

// Get role color
import { getRoleColor } from '@/app/components/shared';

const color = getRoleColor('admin'); // 'text-blue-700 dark:text-blue-400'
```

## Common Patterns

### User Info Display
```tsx
<div className="flex items-center gap-3">
  <UserAvatar
    name={user.name}
    avatarUrl={user.avatar_url}
    size="md"
  />
  <div>
    <div className="font-medium">{user.name}</div>
    <RoleBadge role={user.role} size="sm" />
  </div>
</div>
```

### Protected Feature
```tsx
<PermissionGuard userRole={user.role} minRole="admin">
  <Card>
    <h3>Admin Settings</h3>
    <UsageProgressBar
      current={org.storage_used}
      max={org.storage_limit}
      label="Storage"
      unit="GB"
    />
  </Card>
</PermissionGuard>
```

### User Management Table
```tsx
const columns: Column<User>[] = [
  {
    key: 'user',
    header: 'User',
    accessor: (user) => (
      <div className="flex items-center gap-2">
        <UserAvatar name={user.name} avatarUrl={user.avatar_url} size="sm" />
        <span>{user.name}</span>
      </div>
    ),
    sortable: true,
    filterable: true,
  },
  {
    key: 'role',
    header: 'Role',
    accessor: (user) => <RoleBadge role={user.role} />,
    sortable: true,
  },
  {
    key: 'department',
    header: 'Department',
    accessor: (user) => user.department?.name || 'None',
  },
];

<DataTable
  columns={columns}
  data={users}
  selectable
  searchable
  paginated
/>
```
