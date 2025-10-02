// Dynamic RBAC with admin-managed roles and permissions stored in localStorage

export type Role = string; // dynamic roles
export type Permission = string; // dynamic permissions

export const ALL_PERMISSIONS: Permission[] = [
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
};

export function getRBACConfig(): RBACConfig {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(RBAC_KEY) : null;
    if (raw) return JSON.parse(raw) as RBACConfig;
  } catch {}
  return { ...DEFAULT_RBAC, roles: { ...DEFAULT_RBAC.roles } };
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
