// Dynamic RBAC with admin-managed roles and permissions stored in localStorage

export type Role = string; // dynamic roles
export type Permission = string; // dynamic permissions

// This constant serves as the default seed for fresh installs. Admins can add more permissions later.
export const DEFAULT_PERMISSIONS: Permission[] = [
  "admin:all",
  "pos:use",
  "inventory:manage",
  "accounting:view",
  "reports:view",
  "time:record",
  "users:manage",
  "settings:manage",
];

const RBAC_KEY = "cafe_rbac_config";

export type RBACConfig = {
  roles: Record<Role, Permission[]>;
  permissions: Permission[]; // registry of available permissions
};

const DEFAULT_RBAC: RBACConfig = {
  roles: {
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
  },
  permissions: [...DEFAULT_PERMISSIONS],
};

export function getRBACConfig(): RBACConfig {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(RBAC_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RBACConfig> & { roles: Record<Role, Permission[]> };
      // Migrate older configs that don't have a permissions registry
      const fromRoles = Array.from(
        new Set(
          Object.values(parsed.roles || {}).flat()
        )
      );
      const permissions = Array.from(new Set([...(parsed.permissions || []), ...fromRoles, ...DEFAULT_PERMISSIONS]));
      const cfg: RBACConfig = { roles: parsed.roles || {}, permissions };
      return cfg;
    }
  } catch {}
  return { ...DEFAULT_RBAC, roles: { ...DEFAULT_RBAC.roles }, permissions: [...DEFAULT_RBAC.permissions] };
}

export function saveRBACConfig(cfg: RBACConfig) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(RBAC_KEY, JSON.stringify(cfg));
}

export function hasPermission(role: Role | null, permission: Permission): boolean {
  if (!role) return false;
  const cfg = getRBACConfig();
  const perms = cfg.roles[role] || [];
  return perms.includes("admin:all") || perms.includes(permission);
}

export function getPermissions(): Permission[] {
  return getRBACConfig().permissions;
}

export function addPermissionToRegistry(permission: Permission) {
  const p = permission.trim();
  if (!p) return;
  const cfg = getRBACConfig();
  if (!cfg.permissions.includes(p)) {
    const next = { ...cfg, permissions: [...cfg.permissions, p] };
    saveRBACConfig(next);
  }
}
