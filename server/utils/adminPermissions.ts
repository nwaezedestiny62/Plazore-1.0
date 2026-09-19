import {
  ROLE_PERMISSIONS,
  type AdminPermission,
  type AdminRole,
} from "../models/AdminMembership.js";

export function permissionsForRole(
  role: AdminRole,
  extra: string[] = []
): Set<AdminPermission> {
  const base = ROLE_PERMISSIONS[role] || [];
  const set = new Set<AdminPermission>(base);
  for (const p of extra) {
    if (base.includes(p as AdminPermission) || role === "super_admin") {
      set.add(p as AdminPermission);
    }
  }
  // Super admin always has everything
  if (role === "super_admin") {
    for (const p of Object.values(ROLE_PERMISSIONS).flat()) {
      set.add(p);
    }
  }
  return set;
}

export function hasPermission(
  role: AdminRole,
  extra: string[] | undefined,
  needed: AdminPermission
): boolean {
  return permissionsForRole(role, extra || []).has(needed);
}

export function canAssignRole(
  actorRole: AdminRole,
  targetRole: AdminRole
): boolean {
  // Only Super Admin may invite / assign roles (including Super Admin)
  if (actorRole === "super_admin") {
    return true;
  }

  // Nobody else may assign Super Admin
  if (targetRole === "super_admin") {
    return false;
  }

  // Optional: allow operations_admin to invite non–super roles
  // (only applies if you also give them "team.manage" in ROLE_PERMISSIONS)
  if (actorRole === "operations_admin") {
    return true;
  }

  return false;
}