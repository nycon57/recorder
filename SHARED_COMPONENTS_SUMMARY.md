# Shared UI Components Summary

This document provides an overview of all shared UI components created for the organization management system.

## Created Components

All components are located in `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/`

### 1. UserAvatar.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/UserAvatar.tsx`

**Features**:
- Display user avatar with fallback to initials
- Size variants: `sm`, `md`, `lg`, `xl`
- Status indicator (online/offline/away/busy)
- Tooltip with user information (name, email, title)
- Gradient fallback background
- Dark mode support

**Usage**:
```tsx
<UserAvatar
  name="John Doe"
  avatarUrl="/avatars/john.jpg"
  email="john@example.com"
  title="Software Engineer"
  status="online"
  size="md"
  showTooltip
/>
```

### 2. RoleBadge.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/RoleBadge.tsx`

**Features**:
- Color-coded role badges:
  - Owner: Purple with crown icon
  - Admin: Blue with shield icon
  - Contributor: Green with pen icon
  - Reader: Gray with eye icon
- Size variants: `sm`, `md`, `lg`
- Tooltip with role description
- Icon display toggle
- Dark mode support

**Utility Functions**:
- `getRoleColor(role)`: Get color class for a role
- `getRoleConfig(role)`: Get full role configuration

**Usage**:
```tsx
<RoleBadge role="admin" showIcon showTooltip size="md" />
```

### 3. DepartmentSelector.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/DepartmentSelector.tsx`

**Features**:
- Hierarchical tree view with expand/collapse
- Search/filter functionality
- Single or multi-select mode
- Breadcrumb display for selected department path
- "Create new" inline option
- Uses shadcn/ui Popover + Command components
- Keyboard navigation support

**Usage**:
```tsx
<DepartmentSelector
  departments={departments}
  value={selectedDeptId}
  onValueChange={setSelectedDeptId}
  showBreadcrumb
  showCreateNew
  onCreateNew={() => setCreateDialogOpen(true)}
/>
```

### 4. PermissionGuard.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/PermissionGuard.tsx`

**Features**:
- Wrapper component for role-based access control
- Hierarchical role checking (owner > admin > contributor > reader)
- Exact role matching option
- Custom permission check function
- Loading state handling
- Customizable fallback UI
- Default "Access Denied" message

**Hooks**:
- `usePermission()`: Programmatic permission checking
- `getRoleLevel()`: Get role hierarchy level
- `compareRoles()`: Compare two roles

**Usage**:
```tsx
// Minimum role required
<PermissionGuard userRole={currentUser.role} minRole="admin">
  <AdminPanel />
</PermissionGuard>

// Exact roles allowed
<PermissionGuard
  userRole={currentUser.role}
  allowedRoles={['owner', 'admin']}
  showDefaultFallback
>
  <BillingSettings />
</PermissionGuard>

// Custom permission check
<PermissionGuard
  hasPermission={canEditRecording}
  fallback={<div>You cannot edit this recording</div>}
>
  <EditButton />
</PermissionGuard>
```

### 5. UsageProgressBar.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/UsageProgressBar.tsx`

**Features**:
- Visual progress bar with color-coded thresholds:
  - Green (< 70%): Safe usage
  - Yellow (70-90%): Warning
  - Red (> 90%): Danger
- Configurable warning and danger thresholds
- Percentage and value display
- Detailed tooltip with usage statistics
- Size variants: `sm`, `md`, `lg`
- Warning message when over limit
- Dark mode support

**Usage**:
```tsx
<UsageProgressBar
  current={7.5}
  max={10}
  label="Storage"
  unit="GB"
  showPercentage
  showValues
  description="Monthly storage quota"
  tooltipContent={<div>Resets on the 1st of each month</div>}
/>
```

### 6. AuditLogEntry.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/AuditLogEntry.tsx`

**Features**:
- Formatted display of audit log entries
- User avatar with name
- Color-coded action badges
- Action-specific icons (create, update, delete, etc.)
- Relative timestamp display
- Expandable details section
- Diff viewer for old/new values
- Resource type badge
- Optional IP address and user agent display
- Technical details section

**Usage**:
```tsx
<AuditLogEntry
  entry={auditLog}
  user={userInfo}
  showIpAddress
  showUserAgent
  defaultExpanded
/>
```

### 7. DataTable.tsx

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/DataTable.tsx`

**Features**:
- Column-based sorting (clickable headers)
- Global search with column-specific filtering
- Pagination with configurable page sizes (10, 25, 50, 100)
- Row selection with select all
- Bulk action toolbar
- Loading skeleton state
- Customizable empty state
- External or internal sort control
- Row click handler
- Fully typed with TypeScript generics
- Responsive design
- Accessible keyboard navigation

**Usage**:
```tsx
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

const columns: Column<User>[] = [
  {
    key: 'name',
    header: 'Name',
    accessor: (row) => row.name,
    sortable: true,
    filterable: true,
  },
  {
    key: 'email',
    header: 'Email',
    accessor: (row) => row.email,
    sortable: true,
  },
  {
    key: 'role',
    header: 'Role',
    accessor: (row) => <RoleBadge role={row.role} />,
    sortable: true,
  },
];

<DataTable
  columns={columns}
  data={users}
  getItemId={(user) => user.id}
  selectable
  searchable
  paginated
  onSelectionChange={handleSelectionChange}
  bulkActions={(selectedIds) => (
    <Button onClick={() => handleBulkDelete(selectedIds)}>
      Delete {selectedIds.length} users
    </Button>
  )}
/>
```

## Index File

**Path**: `/Users/jarrettstanley/Desktop/websites/recorder/app/components/shared/index.ts`

Provides centralized exports for all shared components and their types:

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

## Component Design Principles

All components follow these principles:

1. **shadcn/ui Foundation**: Built using shadcn/ui components (Avatar, Badge, Popover, Command, Table, etc.)
2. **Tailwind CSS**: Styled with Tailwind utility classes
3. **TypeScript**: Fully typed with comprehensive interfaces
4. **Accessibility**: ARIA labels, keyboard navigation, screen reader support
5. **Dark Mode**: Full dark mode support with proper color adjustments
6. **Responsive**: Mobile-first responsive design
7. **Variants**: Size and style variants using `class-variance-authority`
8. **Documentation**: JSDoc comments with usage examples
9. **Reusability**: Generic and composable design

## Integration with Project

All components integrate seamlessly with the existing codebase:

- **Database Types**: Uses types from `/Users/jarrettstanley/Desktop/websites/recorder/lib/types/database.ts`
- **Utilities**: Uses `cn()` from `/Users/jarrettstanley/Desktop/websites/recorder/lib/utils.ts`
- **UI Components**: Built on shadcn/ui components from `/Users/jarrettstanley/Desktop/websites/recorder/app/components/ui/`
- **Import Aliases**: Uses `@/` alias configured in `tsconfig.json`

## Testing Recommendations

For each component, consider testing:

1. **UserAvatar**: Initials generation, fallback states, tooltip display
2. **RoleBadge**: Color coding, icon display, tooltip content
3. **DepartmentSelector**: Tree navigation, search filtering, selection modes
4. **PermissionGuard**: Role hierarchy, permission checks, fallback rendering
5. **UsageProgressBar**: Color thresholds, percentage calculations, over-limit warnings
6. **AuditLogEntry**: Diff viewer, expandable content, timestamp formatting
7. **DataTable**: Sorting, filtering, pagination, row selection, bulk actions

## Next Steps

1. Import components in organization management pages
2. Create example usage in Storybook (optional)
3. Add unit tests for utility functions
4. Create integration tests for interactive components
5. Document component usage in team wiki

## Dependencies

All components rely on these packages (already installed):

- `react` and `react-dom`
- `@radix-ui/*` (for shadcn/ui primitives)
- `class-variance-authority` (for variant management)
- `lucide-react` (for icons)
- `date-fns` (for date formatting in AuditLogEntry)
- `tailwind-merge` and `clsx` (for className utilities)

No additional dependencies required!
