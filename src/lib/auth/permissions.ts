/**
 * Better Auth access control + role definitions
 *
 * Required by the admin plugin whenever `adminRoles` contains anything
 * outside the built-in defaults (`admin`, `user`). This codebase uses the
 * 4-role model `owner | admin | contributor | reader` everywhere (see
 * src/lib/security/rbac.ts, src/lib/validations/api.ts, src/lib/types/database.ts),
 * so each of those roles must be declared here for Better Auth to accept them.
 *
 * Role capabilities:
 * - owner:       full admin (every statement from adminAc)
 * - admin:       full admin (every statement from adminAc)
 * - contributor: no admin-plugin permissions (regular user)
 * - reader:      no admin-plugin permissions (regular user)
 *
 * See https://better-auth.com/docs/plugins/admin#pass-roles-to-the-plugin
 */

import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

// Inherit the admin plugin's default statement shape so `owner` and `admin`
// can be granted its full capability set.
const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  ...adminAc.statements,
});

export const admin = ac.newRole({
  ...adminAc.statements,
});

export const contributor = ac.newRole({
  user: [],
  session: [],
});

export const reader = ac.newRole({
  user: [],
  session: [],
});

export const roles = {
  owner,
  admin,
  contributor,
  reader,
} as const;
