export type Role = "admin" | "manager" | "cashier" | "staff";

export type Permission =
  | "pos:use"
  | "inventory:manage"
  | "accounting:view"
  | "reports:view"
  | "time:record"
  | "users:manage"
  | "settings:manage"
  | "admin:all";

export const rolePermissions: Record<Role, Permission[]> = {
  admin: [
    "admin:all",
    "pos:use",
    "inventory:manage",
    "accounting:view",
    "reports:view",
    "time:record",
    "users:manage",
    "settings:manage",
  ],
  manager: [
    "pos:use",
    "inventory:manage",
    "accounting:view",
    "reports:view",
    "time:record",
    "settings:manage",
  ],
  cashier: ["pos:use", "time:record"],
  staff: ["time:record"],
};

export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  const perms = rolePermissions[role] ?? [];
  return perms.includes("admin:all") || perms.includes(permission);
}
