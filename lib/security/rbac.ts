/**
 * Role-Based Access Control (RBAC)
 *
 * Defines permissions for different user roles within organizations.
 */

export type OrganizationRole = 'owner' | 'admin' | 'contributor' | 'reader';

export type Permission =
  // Organization management
  | 'org:update'
  | 'org:delete'
  | 'org:manage_members'
  | 'org:view_billing'
  | 'org:manage_billing'
  // Recording permissions
  | 'recording:create'
  | 'recording:read'
  | 'recording:update'
  | 'recording:delete'
  | 'recording:share'
  // Conversation permissions
  | 'conversation:create'
  | 'conversation:read'
  | 'conversation:update'
  | 'conversation:delete'
  // Document permissions
  | 'document:read'
  | 'document:update'
  | 'document:delete';

/**
 * Role permissions mapping
 */
const ROLE_PERMISSIONS: Record<OrganizationRole, Permission[]> = {
  owner: [
    // Full access
    'org:update',
    'org:delete',
    'org:manage_members',
    'org:view_billing',
    'org:manage_billing',
    'recording:create',
    'recording:read',
    'recording:update',
    'recording:delete',
    'recording:share',
    'conversation:create',
    'conversation:read',
    'conversation:update',
    'conversation:delete',
    'document:read',
    'document:update',
    'document:delete',
  ],
  admin: [
    // Most permissions except org deletion and billing
    'org:update',
    'org:manage_members',
    'org:view_billing',
    'recording:create',
    'recording:read',
    'recording:update',
    'recording:delete',
    'recording:share',
    'conversation:create',
    'conversation:read',
    'conversation:update',
    'conversation:delete',
    'document:read',
    'document:update',
    'document:delete',
  ],
  contributor: [
    // Can create and manage own content
    'recording:create',
    'recording:read',
    'recording:update',
    'recording:share',
    'conversation:create',
    'conversation:read',
    'conversation:update',
    'document:read',
    'document:update',
  ],
  reader: [
    // Read-only access
    'recording:read',
    'conversation:read',
    'document:read',
  ],
};

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes(permission);
}

/**
 * Check if user can perform action on resource
 */
export function canPerformAction(
  userRole: OrganizationRole,
  permission: Permission,
  options?: {
    isOwner?: boolean; // Is user the creator/owner of the resource
  }
): boolean {
  // Resource owner always has full access to their own resources
  if (options?.isOwner) {
    const ownerPermissions: Permission[] = [
      'recording:read',
      'recording:update',
      'recording:delete',
      'recording:share',
      'conversation:read',
      'conversation:update',
      'conversation:delete',
      'document:read',
      'document:update',
      'document:delete',
    ];
    if (ownerPermissions.includes(permission)) {
      return true;
    }
  }

  return hasPermission(userRole, permission);
}

/**
 * Authorization error
 */
export class AuthorizationError extends Error {
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

/**
 * Require specific permission
 */
export function requirePermission(role: OrganizationRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new AuthorizationError(
      `Permission denied: ${permission} requires higher privileges`
    );
  }
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: OrganizationRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if role can be assigned by another role
 */
export function canAssignRole(assignerRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  // Only owners can assign owner role
  if (targetRole === 'owner') {
    return assignerRole === 'owner';
  }

  // Admins and owners can assign admin/contributor/reader
  if (assignerRole === 'owner' || assignerRole === 'admin') {
    return true;
  }

  return false;
}
