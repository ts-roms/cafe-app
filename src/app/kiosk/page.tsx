"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getUsers, getTimeLogs, saveTimeLogs, addAudit, type UserRecord, type TimeLog } from "@/lib/storage";

export default function KioskPage() {
  const [code, setCode] = useState("");
  const [dir, setDir] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [lastMsg, setLastMsg] = useState<string>("");
  const [recentForUser, setRecentForUser] = useState<TimeLog[]>([]);

  useEffect(() => {
    setDir(getUsers());
    setLogs(getTimeLogs());
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLastMsg("");
    const c = code.trim();
    if (!c) { setLastMsg("Enter your employee code"); return; }
    const rec = dir.find(u => (u.code || "").trim() === c);
    if (!rec) { setLastMsg("Code not found"); return; }

    // Check if there is an open log for this user
    const open = logs.find(l => l.userId === rec.id && !l.clockOut);
    const nowIso = new Date().toISOString();
    if (open) {
      // Clock out
      const updated = logs.map(l => l.id === open.id ? { ...l, clockOut: nowIso } : l);
      setLogs(updated);
      saveTimeLogs(updated);
      addAudit({ id: crypto.randomUUID(), at: nowIso, user: { id: rec.id, name: rec.name }, action: "time:out:kiosk", details: `Clock out by code` });
      setLastMsg(`Goodbye, ${rec.name}. Time Out recorded at ${new Date(nowIso).toLocaleTimeString()}`);
      setRecentForUser(updated.filter(l => l.userId === rec.id).slice(0,5));
    } else {
      // Optional soft warning: we cannot check shifts by name here without importing getShifts; keep kiosk simple
      const entry: TimeLog = {
        id: crypto.randomUUID(),
        userId: rec.id,
        userName: rec.name,
        userRole: rec.role,
        clockIn: nowIso,
      };
      const updated = [entry, ...logs];
      setLogs(updated);
      saveTimeLogs(updated);
      addAudit({ id: crypto.randomUUID(), at: nowIso, user: { id: rec.id, name: rec.name }, action: "time:in:kiosk", details: `Clock in by code` });
      setLastMsg(`Welcome, ${rec.name}. Time In recorded at ${new Date(nowIso).toLocaleTimeString()}`);
      setRecentForUser(updated.filter(l => l.userId === rec.id).slice(0,5));
    }
    setCode("");
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Time Kiosk</h1>
      <p className="text-sm opacity-80">Employees can clock in/out using their code. No login required.</p>
      <form onSubmit={submit} className="p-4 border rounded space-y-3">
        <div>
          <label className="block text-sm mb-1">Employee Code</label>
          <input
            value={code}
            onChange={e => setCode(e.target.value)}
            className="w-full border rounded px-3 py-2 bg-transparent"
            placeholder="Enter your code"
            autoFocus
            inputMode="numeric"
          />
        </div>
        <button className="px-4 py-2 rounded bg-foreground text-background w-full">Submit</button>
        {lastMsg && <div className="text-sm mt-1">{lastMsg}</div>}
      </form>

      {recentForUser.length > 0 && (
        <div className="p-3 border rounded">
          <div className="font-semibold mb-2">Your Recent Logs</div>
          <ul className="space-y-1 text-sm">
            {recentForUser.map(l => (
              <li key={l.id} className="flex items-center justify-between">
                <span>In: {new Date(l.clockIn).toLocaleString()}</span>
                <span>{l.clockOut ? `Out: ${new Date(l.clockOut).toLocaleString()}` : "(Open)"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
