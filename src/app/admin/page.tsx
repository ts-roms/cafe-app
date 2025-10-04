"use client";
import React, { useEffect, useMemo, useState } from "react";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import {
  getSettings,
  saveSettings,
  type Settings,
  getAuditLogs,
  addAudit,
  type AuditEntry,
  saveAuditLogs,
  getUsers,
  saveUsers,
  addUser,
  updateUser,
  deleteUser,
  type UserRecord,
  getTimeOffRequests,
  type TimeOffRequest,
  getPromos,
  savePromos,
  addPromo,
  updatePromo,
  type Promo,
} from "@/lib/storage";
import { getRBACConfig, saveRBACConfig, type RBACConfig } from "@/lib/rbac";

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"settings" | "audit" | "roles" | "users" | "calendar" | "promos">("settings");

  // settings
  const [settings, setSettings] = useState<Settings>(getSettings());

  // audit
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  // users
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [newUserName, setNewUserName] = useState("");
  const [newUserUsername, setNewUserUsername] = useState("");
  const [newUserCode, setNewUserCode] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<string>("cashier");
  // New user extra fields
  const [newUserBirthday, setNewUserBirthday] = useState<string>("");
  const [newUserVacation, setNewUserVacation] = useState<string>("");
  const [newUserSick, setNewUserSick] = useState<string>("");
  const [newUserPersonal, setNewUserPersonal] = useState<string>("");

  // time off for calendar
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  // promos
  const [promos, setPromos] = useState<Promo[]>([]);

  // roles/permissions (RBAC)
  const [rbac, setRbac] = useState<RBACConfig>(getRBACConfig());
  const [newRole, setNewRole] = useState("");
  const [newPerm, setNewPerm] = useState("");

  // calendar state
  const [calYear, setCalYear] = useState<number>(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState<number>(new Date().getMonth());

  useEffect(() => {
    setSettings(getSettings());
    setAudit(getAuditLogs());
    setUsers(getUsers());
    setRbac(getRBACConfig());
    setTimeOff(getTimeOffRequests());
    setPromos(getPromos());
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "settings:update", details: JSON.stringify({ companyName: settings.companyName, currency: settings.currency, taxRate: settings.taxRate, kioskEnabled: settings.kioskEnabled }) });
    alert("Settings saved");
  };

  const clearAudit = () => {
    if (!confirm("Clear all audit logs?")) return;
    saveAuditLogs([]);
    setAudit([]);
  };

  const csv = useMemo(() => toCSV(audit), [audit]);

  const roleNames = useMemo(() => Object.keys(rbac.roles), [rbac]);

  const userCountByRole = useMemo(() => {
    const map: Record<string, number> = {};
    for (const u of users) {
      map[u.role] = (map[u.role] || 0) + 1;
    }
    return map;
  }, [users]);

  const togglePerm = (role: string, perm: string) => {
    const current = new Set(rbac.roles[role] || []);
    if (current.has(perm)) current.delete(perm);
    else current.add(perm);
    const next: RBACConfig = { roles: { ...rbac.roles, [role]: Array.from(current) }, permissions: rbac.permissions } as RBACConfig;
    setRbac(next);
    saveRBACConfig(next);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "rbac:toggle", details: `${role} ${perm}` });
  };

  const createRole = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRole.trim();
    if (!name) return;
    if (rbac.roles[name]) return alert("Role already exists");
    const next: RBACConfig = { roles: { ...rbac.roles, [name]: [] }, permissions: rbac.permissions } as RBACConfig;
    setRbac(next);
    saveRBACConfig(next);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "rbac:role:add", details: name });
    setNewRole("");
  };

  const createPermission = (e: React.FormEvent) => {
    e.preventDefault();
    const perm = newPerm.trim();
    if (!perm) return;
    if (rbac.permissions.includes(perm)) return alert("Permission already exists");
    const next: RBACConfig = { roles: { ...rbac.roles }, permissions: [...rbac.permissions, perm] } as RBACConfig;
    setRbac(next);
    saveRBACConfig(next);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "rbac:permission:add", details: perm });
    setNewPerm("");
  };

  const deleteRole = (role: string) => {
    if (role === "admin") return alert("Cannot delete admin role");
    if (userCountByRole[role]) return alert("Cannot delete role in use by users");
    const { [role]: _, ...rest } = rbac.roles;
    const next: RBACConfig = { roles: { ...rest }, permissions: rbac.permissions } as RBACConfig;
    setRbac(next);
    saveRBACConfig(next);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "rbac:role:delete", details: role });
  };

  const submitAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    const n = newUserName.trim();
    const un = newUserUsername.trim();
    if (!n || !un) { alert("Enter name and username"); return; }
    if (!rbac.roles[newUserRole]) return alert("Role does not exist");
    if (users.some(u => (u.username || '').toLowerCase() === un.toLowerCase())) { alert('Username already exists'); return; }
    const vac = Math.max(0, parseFloat(newUserVacation) || 0);
    const sick = Math.max(0, parseFloat(newUserSick) || 0);
    const pers = Math.max(0, parseFloat(newUserPersonal) || 0);
    const credits = (vac > 0 || sick > 0 || pers > 0) ? { vacation: vac, sick, personal: pers } : undefined;
    const rec: UserRecord = {
      id: crypto.randomUUID(),
      name: n,
      role: newUserRole,
      username: un,
      code: newUserCode.trim() || undefined,
      password: newUserPassword || undefined,
      birthday: newUserBirthday || undefined,
      leaveCredits: credits,
    };
    addUser(rec);
    setUsers((cur) => [rec, ...cur]);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:add", details: `${rec.name} (${rec.role})` });
    setNewUserName("");
    setNewUserUsername("");
    setNewUserCode("");
    setNewUserPassword("");
    setNewUserRole("cashier");
    setNewUserBirthday("");
    setNewUserVacation("");
    setNewUserSick("");
    setNewUserPersonal("");
  };

  const onChangeUser = (id: string, name: string, role: string) => {
    const rec: UserRecord | undefined = users.find(u => u.id === id);
    if (!rec) return;
    const next: UserRecord = { ...rec, name, role };
    updateUser(next);
    setUsers(cur => cur.map(u => (u.id === id ? next : u)));
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update", details: `${next.name} (${next.role})` });
  };

  const onChangeUserBirthday = (id: string, birthday: string) => {
    const rec: UserRecord | undefined = users.find(u => u.id === id);
    if (!rec) return;
    const next: UserRecord = { ...rec, birthday: birthday || undefined };
    updateUser(next);
    setUsers(cur => cur.map(u => (u.id === id ? next : u)));
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:birthday", details: `${next.name} -> ${birthday || ""}` });
  };

  const onDeleteUser = (id: string) => {
    if (!confirm("Delete this user?")) return;
    const rec = users.find(u => u.id === id);
    deleteUser(id);
    setUsers(cur => cur.filter(u => u.id !== id));
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:delete", details: rec ? rec.name : id });
  };

  return (
    <RequirePermission permission="settings:manage">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("settings")} className={`px-3 py-1 rounded border ${tab === "settings" ? "bg-foreground text-background" : ""}`}>Settings</button>
          <button onClick={() => setTab("roles")} className={`px-3 py-1 rounded border ${tab === "roles" ? "bg-foreground text-background" : ""}`}>Roles</button>
          <button onClick={() => setTab("users")} className={`px-3 py-1 rounded border ${tab === "users" ? "bg-foreground text-background" : ""}`}>Users</button>
          <button onClick={() => setTab("promos")} className={`px-3 py-1 rounded border ${tab === "promos" ? "bg-foreground text-background" : ""}`}>Promos</button>
          <button onClick={() => setTab("calendar")} className={`px-3 py-1 rounded border ${tab === "calendar" ? "bg-foreground text-background" : ""}`}>Calendar</button>
          <button onClick={() => setTab("audit")} className={`px-3 py-1 rounded border ${tab === "audit" ? "bg-foreground text-background" : ""}`}>Audit Logs</button>
        </div>

        {tab === "settings" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Company Settings</h2>
            <form onSubmit={save} className="grid sm:grid-cols-3 gap-2 p-3 border rounded">
              <input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Company Name" />
              <input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Currency (e.g., USD)" />
              <input value={settings.taxRate} onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) || 0 })} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Tax Rate %" inputMode="decimal" />
              <label className="sm:col-span-3 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!settings.kioskEnabled} onChange={(e) => setSettings({ ...settings, kioskEnabled: !!e.target.checked })} />
                <span>Enable Time Kiosk (/kiosk)</span>
              </label>
              <button className="px-4 py-2 rounded bg-foreground text-background sm:col-span-3">Save</button>
            </form>
            <p className="text-xs opacity-70">Tax rate applies by default in POS; you can still apply per-order discounts there.</p>
          </section>
        )}

        {tab === "roles" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-semibold">Roles & Permissions</h2>
              <div className="flex gap-3 flex-wrap">
                <form onSubmit={createRole} className="flex gap-2">
                  <input value={newRole} onChange={(e) => setNewRole(e.target.value)} className="border rounded px-3 py-1 bg-transparent" placeholder="New role name" />
                  <button className="px-3 py-1 border rounded">Add Role</button>
                </form>
                <form onSubmit={createPermission} className="flex gap-2">
                  <input value={newPerm} onChange={(e) => setNewPerm(e.target.value)} className="border rounded px-3 py-1 bg-transparent" placeholder="New permission (e.g., orders:approve)" />
                  <button className="px-3 py-1 border rounded">Add Permission</button>
                </form>
              </div>
            </div>
            {roleNames.length === 0 ? (
              <p className="opacity-70">No roles defined.</p>
            ) : (
              <div className="space-y-3">
                {roleNames.map((r) => (
                  <div key={r} className="p-3 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{r} <span className="text-xs opacity-60">({userCountByRole[r] || 0} users)</span></div>
                      {r !== "admin" && !userCountByRole[r] && (
                        <button className="text-xs px-2 py-1 border rounded" onClick={() => deleteRole(r)}>Delete</button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(rbac.permissions || []).map((p) => (
                        <label key={p} className="text-sm flex items-center gap-1 border rounded px-2 py-1">
                          <input
                            type="checkbox"
                            checked={(rbac.roles[r] || []).includes(p)}
                            onChange={() => togglePerm(r, p)}
                          />
                          <span>{p}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "users" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Users</h2>
              <form onSubmit={submitAddUser} className="flex flex-wrap gap-2 items-center">
                <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className="border rounded px-3 py-1 bg-transparent" placeholder="Name" />
                <input value={newUserUsername} onChange={(e) => setNewUserUsername(e.target.value)} className="border rounded px-3 py-1 bg-transparent" placeholder="Username" />
                <input value={newUserCode} onChange={(e) => setNewUserCode(e.target.value)} className="border rounded px-3 py-1 bg-transparent" placeholder="Code (optional)" />
                <input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className="border rounded px-3 py-1 bg-transparent" placeholder="Password" />
                <input type="date" value={newUserBirthday} onChange={(e) => setNewUserBirthday(e.target.value)} className="border rounded px-3 py-1 bg-transparent" title="Birthday" />
                <div className="flex items-center gap-1">
                  <input value={newUserVacation} onChange={(e) => setNewUserVacation(e.target.value)} className="w-16 border rounded px-2 py-1 bg-transparent text-right" placeholder="V" inputMode="decimal" title="Vacation credits" />
                  <span className="opacity-60">/</span>
                  <input value={newUserSick} onChange={(e) => setNewUserSick(e.target.value)} className="w-16 border rounded px-2 py-1 bg-transparent text-right" placeholder="S" inputMode="decimal" title="Sick credits" />
                  <span className="opacity-60">/</span>
                  <input value={newUserPersonal} onChange={(e) => setNewUserPersonal(e.target.value)} className="w-16 border rounded px-2 py-1 bg-transparent text-right" placeholder="P" inputMode="decimal" title="Personal credits" />
                </div>
                <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="border rounded px-3 py-1 bg-transparent">
                  {roleNames.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <button className="px-3 py-1 border rounded">Add</button>
              </form>
            </div>

            {users.length === 0 ? (
              <p className="opacity-70">No users in directory. Add one above.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Name</th>
                      <th className="text-left p-2 border">Username</th>
                      <th className="text-left p-2 border">Code</th>
                      <th className="text-left p-2 border">Role</th>
                      <th className="text-left p-2 border">Birthday</th>
                      <th className="text-left p-2 border">Leave Credits (V/S/P)</th>
                      <th className="text-left p-2 border">Password</th>
                      <th className="text-left p-2 border">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border">
                          <input value={u.name} onChange={(e) => onChangeUser(u.id, e.target.value, u.role)} className="border rounded px-2 py-1 bg-transparent w-full" />
                        </td>
                        <td className="p-2 border">
                          <input value={u.username || ""} onChange={(e) => {
                            const rec = users.find(x => x.id === u.id);
                            if (!rec) return;
                            const newUsername = (e.target.value || '').trim();
                            // Enforce uniqueness (case-insensitive) and non-empty
                            if (newUsername && users.some(x => x.id !== u.id && (x.username || '').toLowerCase() === newUsername.toLowerCase())) {
                              alert('Username already exists');
                              return;
                            }
                            const next = { ...rec, username: newUsername || undefined } as UserRecord;
                            updateUser(next);
                            setUsers(cur => cur.map(x => x.id === u.id ? next : x));
                            addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:username", details: `${rec.name} -> ${newUsername}` });
                          }} className="border rounded px-2 py-1 bg-transparent w-full" placeholder="username" />
                        </td>
                        <td className="p-2 border">
                          <input value={u.code || ""} onChange={(e) => {
                            const rec = users.find(x => x.id === u.id);
                            if (!rec) return;
                            const next = { ...rec, code: e.target.value || undefined } as UserRecord;
                            updateUser(next);
                            setUsers(cur => cur.map(x => x.id === u.id ? next : x));
                            addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:code", details: `${rec.name}` });
                          }} className="border rounded px-2 py-1 bg-transparent w-full" placeholder="code" />
                        </td>
                        <td className="p-2 border">
                          <select value={u.role} onChange={(e) => onChangeUser(u.id, u.name, e.target.value)} className="border rounded px-2 py-1 bg-transparent">
                            {roleNames.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 border">
                          <input type="date" value={u.birthday || ""} onChange={(e) => onChangeUserBirthday(u.id, e.target.value)} className="border rounded px-2 py-1 bg-transparent" />
                        </td>
                        <td className="p-2 border">
                          <div className="flex items-center gap-1">
                            <input
                              value={String(u.leaveCredits?.vacation ?? 0)}
                              onChange={(e) => {
                                const rec = users.find(x => x.id === u.id);
                                if (!rec) return;
                                const val = parseFloat(e.target.value) || 0;
                                const next = { ...rec, leaveCredits: { ...rec.leaveCredits, vacation: Math.max(0, val) } } as UserRecord;
                                updateUser(next);
                                setUsers(cur => cur.map(x => x.id === u.id ? next : x));
                                addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:leave:vacation", details: rec.name });
                              }}
                              className="w-14 border rounded px-2 py-1 bg-transparent text-right"
                              inputMode="decimal"
                              title="Vacation credits"
                            />
                            <span className="opacity-60">/</span>
                            <input
                              value={String(u.leaveCredits?.sick ?? 0)}
                              onChange={(e) => {
                                const rec = users.find(x => x.id === u.id);
                                if (!rec) return;
                                const val = parseFloat(e.target.value) || 0;
                                const next = { ...rec, leaveCredits: { ...rec.leaveCredits, sick: Math.max(0, val) } } as UserRecord;
                                updateUser(next);
                                setUsers(cur => cur.map(x => x.id === u.id ? next : x));
                                addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:leave:sick", details: rec.name });
                              }}
                              className="w-14 border rounded px-2 py-1 bg-transparent text-right"
                              inputMode="decimal"
                              title="Sick credits"
                            />
                            <span className="opacity-60">/</span>
                            <input
                              value={String(u.leaveCredits?.personal ?? 0)}
                              onChange={(e) => {
                                const rec = users.find(x => x.id === u.id);
                                if (!rec) return;
                                const val = parseFloat(e.target.value) || 0;
                                const next = { ...rec, leaveCredits: { ...rec.leaveCredits, personal: Math.max(0, val) } } as UserRecord;
                                updateUser(next);
                                setUsers(cur => cur.map(x => x.id === u.id ? next : x));
                                addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:leave:personal", details: rec.name });
                              }}
                              className="w-14 border rounded px-2 py-1 bg-transparent text-right"
                              inputMode="decimal"
                              title="Personal credits"
                            />
                          </div>
                        </td>
                        <td className="p-2 border">
                          <input type="password" placeholder="Set new password" className="border rounded px-2 py-1 bg-transparent w-full" onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.currentTarget as HTMLInputElement;
                              const val = input.value;
                              input.value = '';
                              if (!val) return;
                              const rec = users.find(x => x.id === u.id);
                              if (!rec) return;
                              const next = { ...rec, password: val } as UserRecord;
                              updateUser(next);
                              setUsers(cur => cur.map(x => x.id === u.id ? next : x));
                              addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "user:update:password", details: rec.name });
                              alert('Password updated');
                            }
                          }} />
                        </td>
                        <td className="p-2 border">
                          <button className="text-xs px-2 py-1 border rounded" onClick={() => onDeleteUser(u.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "promos" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Promotions</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border text-sm" onClick={() => {
                  const p: Promo = { id: crypto.randomUUID(), code: "SAVE10", type: "percent", value: 10, minSubtotal: 0, active: true, uses: 0 };
                  addPromo(p);
                  setPromos(cur => [p, ...cur]);
                  addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "promo:add", details: `${p.code} ${p.type} ${p.value}` });
                }}>Add Promo</button>
                <button className="px-3 py-1 rounded border text-sm" onClick={() => {
                  savePromos(promos);
                  addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "promo:save", details: `${promos.length} promos` });
                  alert("Saved");
                }}>Save</button>
              </div>
            </div>
            {promos.length === 0 ? (
              <p className="opacity-70">No promos configured.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Code</th>
                      <th className="text-left p-2 border">Type</th>
                      <th className="text-right p-2 border">Value</th>
                      <th className="text-right p-2 border">Min Subtotal</th>
                      <th className="text-left p-2 border">Expires</th>
                      <th className="text-left p-2 border">Active</th>
                      <th className="text-right p-2 border">Max Uses</th>
                      <th className="text-right p-2 border">Uses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map((p, idx) => (
                      <tr key={p.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border"><input value={p.code} onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, code: e.target.value }: x))} className="border rounded px-2 py-1 bg-transparent" /></td>
                        <td className="p-2 border">
                          <select value={p.type} onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, type: e.target.value as any }: x))} className="border rounded px-2 py-1 bg-transparent">
                            <option value="amount">Amount</option>
                            <option value="percent">Percent</option>
                          </select>
                        </td>
                        <td className="p-2 border text-right"><input value={String(p.value)} onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, value: parseFloat(e.target.value)||0 }: x))} className="border rounded px-2 py-1 bg-transparent w-24 text-right" inputMode="decimal" /></td>
                        <td className="p-2 border text-right"><input value={String(p.minSubtotal || 0)} onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, minSubtotal: parseFloat(e.target.value)||0 }: x))} className="border rounded px-2 py-1 bg-transparent w-24 text-right" inputMode="decimal" /></td>
                        <td className="p-2 border"><input type="date" value={(p.expiresAt || "").slice(0,10)} onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, expiresAt: e.target.value ? new Date(e.target.value).toISOString() : undefined }: x))} className="border rounded px-2 py-1 bg-transparent" /></td>
                        <td className="p-2 border">
                          <label className="text-sm flex items-center gap-2">
                            <input type="checkbox" checked={p.active} onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, active: e.target.checked }: x))} />
                            <span>{p.active ? "Active" : "Inactive"}</span>
                          </label>
                        </td>
                        <td className="p-2 border text-right">
                          <input
                            value={p.maxUses != null ? String(p.maxUses) : ""}
                            onChange={e => setPromos(cur => cur.map((x,i)=> i===idx? { ...x, maxUses: (e.target.value.trim()==="" ? undefined : Math.max(0, parseInt(e.target.value)||0)) }: x))}
                            className="border rounded px-2 py-1 bg-transparent w-24 text-right"
                            inputMode="numeric"
                            placeholder="∞"
                            title="Maximum total uses (leave blank for unlimited)"
                          />
                        </td>
                        <td className="p-2 border text-right">{p.uses || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "calendar" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Calendar</h2>
              <div className="flex items-center gap-2">
                <button className="px-2 py-1 border rounded" onClick={() => {
                  let m = calMonth - 1; let y = calYear; if (m < 0) { m = 11; y -= 1; } setCalMonth(m); setCalYear(y);
                }}>{"<"}</button>
                <div className="min-w-32 text-center font-medium">{new Date(calYear, calMonth, 1).toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
                <button className="px-2 py-1 border rounded" onClick={() => {
                  let m = calMonth + 1; let y = calYear; if (m > 11) { m = 0; y += 1; } setCalMonth(m); setCalYear(y);
                }}>{">"}</button>
                <button className="px-2 py-1 border rounded" onClick={() => { setUsers(getUsers()); setTimeOff(getTimeOffRequests()); }}>Refresh</button>
              </div>
            </div>
            {(() => {
              const first = new Date(calYear, calMonth, 1);
              const startDow = first.getDay();
              const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
              const cells: (Date|null)[] = [];
              for (let i=0;i<startDow;i++) cells.push(null);
              for (let d=1; d<=daysInMonth; d++) cells.push(new Date(calYear, calMonth, d));
              const weeks: (Date|null)[][] = [];
              for (let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i, i+7));

              const md = (d: Date) => { const m = (d.getMonth()+1).toString().padStart(2,'0'); const dd = d.getDate().toString().padStart(2,'0'); return `${m}-${dd}`; };
              const ymd = (d: Date) => d.toISOString().slice(0,10);

              const birthdayEvents = (d: Date) => users.filter(u => u.birthday && (u.birthday as string).slice(5) === md(d)).map(u => ({ type: 'birthday' as const, label: `${u.name}` }));
              const leaveEvents = (d: Date) => {
                const key = ymd(d);
                return timeOff.filter(r => r.startDate <= key && key <= r.endDate).map(r => ({ type: r.status, label: `${r.userName} (${r.type})`, status: r.status }));
              };

              const DayCell = ({ d }: { d: Date }) => {
                const bdays = birthdayEvents(d);
                const leaves = leaveEvents(d);
                return (
                  <div className="h-28 p-2 border rounded flex flex-col gap-1">
                    <div className="text-xs font-medium">{d.getDate()}</div>
                    <div className="flex-1 overflow-auto space-y-1">
                      {bdays.map((e, i) => (
                        <div key={`b${i}`} className="text-xs px-1 py-0.5 rounded bg-pink-200 text-pink-900 dark:bg-pink-900/30 dark:text-pink-200" title="Birthday">🎂 {e.label}</div>
                      ))}
                      {leaves.map((e, i) => (
                        <div key={`l${i}`} className={`text-xs px-1 py-0.5 rounded ${e.status === 'approved' ? 'bg-green-200 text-green-900 dark:bg-green-900/30 dark:text-green-200' : e.status === 'pending' ? 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900/30 dark:text-yellow-200' : 'bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-100'}`} title="Time Off">
                          🏖️ {e.label}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              };

              return (
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-2 text-xs opacity-70">
                    {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (<div key={d} className="p-1">{d}</div>))}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {weeks.map((row, idx) => (
                      <React.Fragment key={idx}>
                        {row.map((cell, j) => cell ? <DayCell key={j} d={cell} /> : <div key={j} className="h-28 p-2 border rounded bg-black/5 dark:bg-white/10"></div>)}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 text-xs opacity-80">
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded inline-block bg-pink-400"></span> Birthday</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded inline-block bg-green-400"></span> Leave (Approved)</span>
                    <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded inline-block bg-yellow-400"></span> Leave (Pending)</span>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {tab === "audit" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Audit Logs</h2>
              <div className="flex gap-2">
                <a
                  className="px-3 py-1 rounded border"
                  href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
                  download={`audit-${new Date().toISOString().slice(0,10)}.csv`}
                >Export CSV</a>
                <button onClick={clearAudit} className="px-3 py-1 rounded border">Clear</button>
              </div>
            </div>
            {audit.length === 0 ? (
              <p className="opacity-70">No audit entries yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Date</th>
                      <th className="text-left p-2 border">User</th>
                      <th className="text-left p-2 border">Action</th>
                      <th className="text-left p-2 border">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((a) => (
                      <tr key={a.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border whitespace-nowrap">{new Date(a.at).toLocaleString()}</td>
                        <td className="p-2 border">{a.user?.name || "—"}</td>
                        <td className="p-2 border">{a.action}</td>
                        <td className="p-2 border">{a.details || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </RequirePermission>
  );
}

function toCSV(rows: AuditEntry[]): string {
  const head = ["at","user","action","details"].join(",");
  const body = rows.map(r => [
    new Date(r.at).toISOString(),
    safe(r.user?.name || ""),
    safe(r.action),
    safe(r.details || "")
  ].join(",")).join("\n");
  return head + "\n" + body;
}

function safe(s: string): string {
  const needsQuote = /[",\n]/.test(s);
  const v = s.replaceAll('"', '""');
  return needsQuote ? `"${v}"` : v;
}
