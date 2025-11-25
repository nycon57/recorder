/**
 * Shared UI Components
 *
 * This module exports reusable UI components for the organization management system.
 * All components are built with shadcn/ui, Tailwind CSS, and TypeScript.
 */

// User Avatar Component
export { UserAvatar } from './UserAvatar';
export type { UserAvatarProps } from './UserAvatar';

// Role Badge Component
export { RoleBadge, getRoleColor, getRoleConfig } from './RoleBadge';
export type { RoleBadgeProps } from './RoleBadge';

// Department Selector Component
export { DepartmentSelector } from './DepartmentSelector';
export type { DepartmentSelectorProps, Department } from './DepartmentSelector';

// Permission Guard Component
export { PermissionGuard, usePermission, getRoleLevel, compareRoles } from './PermissionGuard';
export type { PermissionGuardProps } from './PermissionGuard';

// Usage Progress Bar Component
export { UsageProgressBar } from './UsageProgressBar';
export type { UsageProgressBarProps } from './UsageProgressBar';

// Audit Log Entry Component
export { AuditLogEntry } from './AuditLogEntry';
export type { AuditLogEntryProps, AuditLogEntryData, AuditLogUser } from './AuditLogEntry';
