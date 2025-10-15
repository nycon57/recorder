'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { UserRole } from '@/lib/types/database';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/app/components/ui/alert';

/**
 * Role hierarchy for permission checking
 * Higher number = more permissions
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  contributor: 2,
  reader: 1,
};

/**
 * Props for PermissionGuard component
 */
export interface PermissionGuardProps {
  /**
   * Child components to render if user has permission
   */
  children: React.ReactNode;
  /**
   * User's current role
   */
  userRole?: UserRole | null;
  /**
   * Minimum required role to view content
   */
  minRole?: UserRole;
  /**
   * Exact role(s) required (alternative to minRole)
   */
  allowedRoles?: UserRole[];
  /**
   * Custom permission check function
   */
  hasPermission?: boolean;
  /**
   * Fallback UI to show when user doesn't have permission
   * If not provided, children will be hidden
   */
  fallback?: React.ReactNode;
  /**
   * Show default "No permission" message as fallback
   */
  showDefaultFallback?: boolean;
  /**
   * Loading state (e.g., while fetching user role)
   */
  loading?: boolean;
  /**
   * Custom loading component
   */
  loadingFallback?: React.ReactNode;
  /**
   * Additional CSS classes for wrapper
   */
  className?: string;
  /**
   * Wrapper element type
   */
  as?: 'div' | 'section' | 'span';
}

/**
 * Default permission denied UI
 */
function DefaultFallback() {
  return (
    <Alert variant="destructive" className="max-w-2xl">
      <ShieldAlert className="size-4" />
      <AlertTitle>Access Denied</AlertTitle>
      <AlertDescription>
        You don't have permission to view this content. Please contact your
        organization administrator if you believe this is an error.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Default loading UI
 */
function DefaultLoading() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

/**
 * Check if user has minimum required role
 */
function hasMinimumRole(
  userRole: UserRole | null | undefined,
  minRole: UserRole
): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minRole];
}

/**
 * Check if user has one of the allowed roles
 */
function hasAllowedRole(
  userRole: UserRole | null | undefined,
  allowedRoles: UserRole[]
): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/**
 * PermissionGuard Component
 *
 * A flexible wrapper component that conditionally renders children based on user
 * permissions. Supports role-based access control with hierarchical or exact role
 * matching, custom permission checks, and customizable fallback UI.
 *
 * Features:
 * - Hierarchical role checking (owner > admin > contributor > reader)
 * - Exact role matching for specific permissions
 * - Custom permission check function
 * - Loading state handling
 * - Customizable fallback UI
 * - Default "Access Denied" message
 *
 * @example
 * ```tsx
 * // Minimum role required
 * <PermissionGuard userRole={currentUser.role} minRole="admin">
 *   <AdminPanel />
 * </PermissionGuard>
 *
 * // Exact roles allowed
 * <PermissionGuard
 *   userRole={currentUser.role}
 *   allowedRoles={['owner', 'admin']}
 *   showDefaultFallback
 * >
 *   <BillingSettings />
 * </PermissionGuard>
 *
 * // Custom permission check
 * <PermissionGuard
 *   hasPermission={canEditRecording}
 *   fallback={<div>You cannot edit this recording</div>}
 * >
 *   <EditButton />
 * </PermissionGuard>
 *
 * // With loading state
 * <PermissionGuard
 *   userRole={currentUser?.role}
 *   minRole="contributor"
 *   loading={isLoadingUser}
 * >
 *   <CreateRecordingButton />
 * </PermissionGuard>
 * ```
 */
export function PermissionGuard({
  children,
  userRole,
  minRole,
  allowedRoles,
  hasPermission,
  fallback,
  showDefaultFallback = false,
  loading = false,
  loadingFallback,
  className,
  as: Wrapper = 'div',
}: PermissionGuardProps) {
  // Handle loading state
  if (loading) {
    const LoadingComponent = loadingFallback || <DefaultLoading />;
    return <Wrapper className={className}>{LoadingComponent}</Wrapper>;
  }

  // Determine if user has permission
  let permitted = false;

  // Custom permission check takes precedence
  if (hasPermission !== undefined) {
    permitted = hasPermission;
  }
  // Check allowed roles (exact match)
  else if (allowedRoles && allowedRoles.length > 0) {
    permitted = hasAllowedRole(userRole, allowedRoles);
  }
  // Check minimum role (hierarchical)
  else if (minRole) {
    permitted = hasMinimumRole(userRole, minRole);
  }
  // If no permission criteria specified, default to permitted
  else {
    permitted = true;
  }

  // Render based on permission
  if (permitted) {
    return <Wrapper className={className}>{children}</Wrapper>;
  }

  // Render fallback
  const FallbackComponent = showDefaultFallback
    ? <DefaultFallback />
    : fallback || null;

  return FallbackComponent ? (
    <Wrapper className={className}>{FallbackComponent}</Wrapper>
  ) : null;
}

/**
 * Hook to check permissions programmatically
 */
export function usePermission({
  userRole,
  minRole,
  allowedRoles,
}: {
  userRole?: UserRole | null;
  minRole?: UserRole;
  allowedRoles?: UserRole[];
}): boolean {
  return React.useMemo(() => {
    if (allowedRoles && allowedRoles.length > 0) {
      return hasAllowedRole(userRole, allowedRoles);
    }
    if (minRole) {
      return hasMinimumRole(userRole, minRole);
    }
    return true;
  }, [userRole, minRole, allowedRoles]);
}

/**
 * Get role hierarchy level (useful for UI)
 */
export function getRoleLevel(role: UserRole): number {
  return ROLE_HIERARCHY[role];
}

/**
 * Compare two roles
 */
export function compareRoles(
  role1: UserRole,
  role2: UserRole
): 'higher' | 'equal' | 'lower' {
  const level1 = ROLE_HIERARCHY[role1];
  const level2 = ROLE_HIERARCHY[role2];

  if (level1 > level2) return 'higher';
  if (level1 < level2) return 'lower';
  return 'equal';
}
