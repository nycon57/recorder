export const createAccessControl = (statements?: unknown) => ({
  statements,
  newRole: (permissions: unknown) => permissions,
});
