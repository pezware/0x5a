const WILDCARD_PERMISSION = '*';

function normalizeRoleNames(input) {
  if (!input) {
    return [];
  }
  if (Array.isArray(input)) {
    return input.filter(Boolean).map(String);
  }
  return [String(input)];
}

export function createAccessPolicy(config) {
  if (!config || typeof config !== 'object') {
    throw new Error('createAccessPolicy requires a parsed platform config');
  }
  const roleDefinitions = config.roles ?? {};
  const roleMap = new Map();
  for (const [roleName, permissions] of Object.entries(roleDefinitions)) {
    if (!Array.isArray(permissions)) {
      throw new Error(`role ${roleName} must be an array of permission strings`);
    }
    const normalized = new Set(permissions.map((perm) => String(perm)));
    roleMap.set(roleName, normalized);
  }

  function getRolePermissions(roleName) {
    const permissions = roleMap.get(roleName);
    if (!permissions) {
      throw new Error(`Unknown role: ${roleName}`);
    }
    return Array.from(permissions);
  }

  function getPermissionsForRoles(roleNames) {
    const names = normalizeRoleNames(roleNames);
    const aggregate = new Set();
    for (const name of names) {
      const permissions = roleMap.get(name);
      if (!permissions) {
        continue;
      }
      for (const perm of permissions) {
        aggregate.add(perm);
      }
    }
    return aggregate;
  }

  function hasPermission(roleNames, permission) {
    if (!permission) {
      throw new Error('permission is required');
    }
    const permissions = getPermissionsForRoles(roleNames);
    return permissions.has(WILDCARD_PERMISSION) || permissions.has(permission);
  }

  function assertPermission(roleNames, permission) {
    if (!hasPermission(roleNames, permission)) {
      const resolved = Array.from(getPermissionsForRoles(roleNames)).sort();
      throw new Error(`Access denied for permission '${permission}'. Resolved permissions: ${resolved.join(', ')}`);
    }
  }

  return {
    getRolePermissions,
    getPermissionsForRoles,
    hasPermission,
    assertPermission
  };
}
