export type Role = "admin" | "cashier" | "staff";

export type Permission =
  | "pos:use"
  | "accounting:view"
  | "time:record"
  | "admin:all";

export const rolePermissions: Record<Role, Permission[]> = {
  admin: ["admin:all", "pos:use", "accounting:view", "time:record"],
  cashier: ["pos:use", "time:record"],
  staff: ["time:record"],
};

export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  const perms = rolePermissions[role] ?? [];
  return perms.includes("admin:all") || perms.includes(permission);
}
