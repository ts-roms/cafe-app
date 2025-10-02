"use client";
import React, { useEffect, useMemo, useState } from "react";
import { getUsers, getTimeLogs, saveTimeLogs, addAudit, getShifts, type UserRecord, type TimeLog, type Shift } from "@/lib/storage";

function ymd(date: Date): string { return date.toISOString().slice(0,10); }
function hhmmToMinutes(hhmm: string): number { const m = /^(\d{2}):(\d{2})$/.exec(hhmm || ""); if (!m) return 0; return parseInt(m[1])*60 + parseInt(m[2]); }
function dateIsoToLocalMinutes(iso: string): { date: string; minutes: number } { const d = new Date(iso); return { date: ymd(d), minutes: d.getHours()*60 + d.getMinutes() }; }

export default function KioskPage() {
  const [code, setCode] = useState("");
  const [dir, setDir] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [lastMsg, setLastMsg] = useState<string>("");
  const [recentForUser, setRecentForUser] = useState<TimeLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    setDir(getUsers());
    setLogs(getTimeLogs());
    setShifts(getShifts());
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
      // Clock out: compute OT/UT if shift known
      const updated = logs.map(l => {
        if (l.id !== open.id) return l;
        const out: TimeLog = { ...l, clockOut: nowIso };
        const { date: inDate, minutes: inMin } = dateIsoToLocalMinutes(l.clockIn);
        let sStart = l.shiftStart;
        let sEnd = l.shiftEnd;
        if (!sStart || !sEnd) {
          const cand = shifts.filter(s => s.userName === (rec.name) && s.date === inDate).sort((a,b)=>a.start.localeCompare(b.start))[0];
          if (cand) {
            sStart = cand.start; sEnd = cand.end;
            out.shiftDate = cand.date; out.shiftStart = cand.start; out.shiftEnd = cand.end;
          }
        }
        if (sStart) {
          const schedStart = hhmmToMinutes(sStart);
          const late = Math.max(0, inMin - schedStart);
          if (late > 0 && (out.lateMinutes || 0) === 0) out.lateMinutes = late;
        }
        if (sEnd) {
          const schedEnd = hhmmToMinutes(sEnd);
          const { minutes: outMin } = dateIsoToLocalMinutes(nowIso);
          out.overtimeMinutes = Math.max(0, outMin - schedEnd);
          out.undertimeMinutes = Math.max(0, schedEnd - outMin);
        }
        return out;
      });
      setLogs(updated);
      saveTimeLogs(updated);
      addAudit({ id: crypto.randomUUID(), at: nowIso, user: { id: rec.id, name: rec.name }, action: "time:out:kiosk", details: `Clock out by code` });
      setLastMsg(`Goodbye, ${rec.name}. Time Out recorded at ${new Date(nowIso).toLocaleTimeString()}`);
      setRecentForUser(updated.filter(l => l.userId === rec.id).slice(0,5));
    } else {
      // Clock in: attach shift and compute late
      const today = ymd(new Date());
      const scheduled = shifts.filter(s => s.userName === rec.name && s.date === today).sort((a,b)=>a.start.localeCompare(b.start))[0];
      const entry: TimeLog = {
        id: crypto.randomUUID(),
        userId: rec.id,
        userName: rec.name,
        userRole: rec.role,
        clockIn: nowIso,
        shiftDate: scheduled?.date,
        shiftStart: scheduled?.start,
        shiftEnd: scheduled?.end,
      };
      if (scheduled) {
        const { minutes: inMin } = dateIsoToLocalMinutes(nowIso);
        const schedStart = hhmmToMinutes(scheduled.start);
        entry.lateMinutes = Math.max(0, inMin - schedStart);
      }
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
              <li key={l.id} className="p-2 border rounded">
                <div className="flex items-center justify-between">
                  <span>In: {new Date(l.clockIn).toLocaleString()}</span>
                  <span>{l.clockOut ? `Out: ${new Date(l.clockOut).toLocaleString()}` : "(Open)"}</span>
                </div>
                {(l.shiftStart || l.shiftEnd) && (
                  <div className="text-xs opacity-80 mt-1">Scheduled: {l.shiftDate || ''} {l.shiftStart || '??'} - {l.shiftEnd || '??'}</div>
                )}
                {(l.lateMinutes || l.overtimeMinutes || l.undertimeMinutes) && (
                  <div className="text-xs mt-1 flex flex-wrap gap-2">
                    {l.lateMinutes ? <span className="px-2 py-0.5 rounded bg-yellow-200 text-yellow-900">Late {l.lateMinutes}m</span> : null}
                    {l.overtimeMinutes ? <span className="px-2 py-0.5 rounded bg-green-200 text-green-900">OT {l.overtimeMinutes}m</span> : null}
                    {l.undertimeMinutes ? <span className="px-2 py-0.5 rounded bg-red-200 text-red-900">UT {l.undertimeMinutes}m</span> : null}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
