"use client";
import React, { useEffect, useMemo, useState } from "react";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import { getSettings, saveSettings, type Settings, getAuditLogs, addAudit, type AuditEntry, saveAuditLogs } from "@/lib/storage";

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"settings" | "audit">("settings");

  // settings
  const [settings, setSettings] = useState<Settings>(getSettings());

  // audit
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    setSettings(getSettings());
    setAudit(getAuditLogs());
  }, []);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "settings:update", details: JSON.stringify({ currency: settings.currency, taxRate: settings.taxRate }) });
    alert("Settings saved");
  };

  const clearAudit = () => {
    if (!confirm("Clear all audit logs?")) return;
    saveAuditLogs([]);
    setAudit([]);
  };

  const csv = useMemo(() => toCSV(audit), [audit]);

  return (
    <RequirePermission permission="settings:manage">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("settings")} className={`px-3 py-1 rounded border ${tab === "settings" ? "bg-foreground text-background" : ""}`}>Settings</button>
          <button onClick={() => setTab("audit")} className={`px-3 py-1 rounded border ${tab === "audit" ? "bg-foreground text-background" : ""}`}>Audit Logs</button>
        </div>

        {tab === "settings" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Company Settings</h2>
            <form onSubmit={save} className="grid sm:grid-cols-3 gap-2 p-3 border rounded">
              <input value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Company Name" />
              <input value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Currency (e.g., USD)" />
              <input value={settings.taxRate} onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) || 0 })} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Tax Rate %" inputMode="decimal" />
              <button className="px-4 py-2 rounded bg-foreground text-background sm:col-span-3">Save</button>
            </form>
            <p className="text-xs opacity-70">Tax rate applies by default in POS; you can still apply per-order discounts there.</p>
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
  let v = s.replaceAll('"', '""');
  return needsQuote ? `"${v}"` : v;
}
