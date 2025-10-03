import { getRBACConfig, saveRBACConfig, hasPermission } from '@/lib/rbac';

describe('RBAC', () => {
  beforeEach(() => {
    // Reset RBAC config in localStorage before each test
    try { localStorage.removeItem('cafe_rbac_config'); } catch {}
  });

  it('loads default roles when no config is saved', () => {
    const cfg = getRBACConfig();
    expect(cfg.roles.admin).toBeTruthy();
    expect(cfg.roles.cashier).toBeTruthy();
  });

  it('admin has all permissions via admin:all', () => {
    const cfg = getRBACConfig();
    for (const p of cfg.permissions) {
      expect(hasPermission('admin', p)).toBe(true);
    }
  });

  it('cashier has pos:use but not accounting:view by default', () => {
    expect(hasPermission('cashier', 'pos:use')).toBe(true);
    expect(hasPermission('cashier', 'accounting:view')).toBe(false);
  });

  it('respects saved RBAC changes', () => {
    const cfg = getRBACConfig();
    cfg.roles['tester'] = ['reports:view'];
    saveRBACConfig(cfg);
    expect(hasPermission('tester', 'reports:view')).toBe(true);
    expect(hasPermission('tester', 'pos:use')).toBe(false);
  });
});
