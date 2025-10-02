"use client";
import React, { useEffect, useMemo, useState } from "react";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import { getTimeLogs, saveTimeLogs, getShifts, saveShifts, addShift, addAudit, getTimeOffRequests, saveTimeOffRequests, addTimeOffRequest, updateTimeOffRequest, type TimeLog, type Shift, type TimeOffRequest } from "@/lib/storage";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function hoursBetween(startIso: string, endIso?: string): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const h = (end - start) / 3600000;
  return Math.max(0, h);
}

export default function TimePage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [tab, setTab] = useState<"logs" | "attendance" | "shifts" | "team" | "timeoff" | "timeoffTeam">("logs");

  // shift form (admin)
  const [empName, setEmpName] = useState("");
  const [shiftDate, setShiftDate] = useState(ymd(new Date()));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  // time off form (staff/cashier)
  const [toType, setToType] = useState<TimeOffRequest["type"]>("vacation");
  const [toStart, setToStart] = useState<string>(ymd(new Date()));
  const [toEnd, setToEnd] = useState<string>(ymd(new Date()));
  const [toReason, setToReason] = useState<string>("");

  useEffect(() => {
    setLogs(getTimeLogs());
    setShifts(getShifts());
    setTimeOff(getTimeOffRequests());
  }, []);

  const myOpenLog = useMemo(() => logs.find((l) => l.userId === user?.id && !l.clockOut), [logs, user?.id]);
  const myLogs = useMemo(() => logs.filter((l) => l.userId === user?.id), [logs, user?.id]);

  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  const isManagerOrAdmin = isAdmin || isManager;

  const myTimeOff = useMemo(() => timeOff.filter(r => r.userId === user?.id), [timeOff, user?.id]);

  const teamLogs = useMemo(() => {
    // Show only staff and cashier logs; ignore entries without role for clarity
    return logs.filter(l => l.userRole === "cashier" || l.userRole === "staff");
  }, [logs]);

  const todayShiftsForMe = useMemo(() => {
    if (!user) return [] as Shift[];
    const today = ymd(new Date());
    return shifts.filter(s => s.userName === user.name && s.date === today);
  }, [shifts, user]);

  const clockIn = () => {
    if (!user) return;
    if (myOpenLog) return alert("Already clocked in");

    // Optional: soft warning if clocking in outside scheduled shift
    if (todayShiftsForMe.length > 0) {
      const now = new Date();
      const hh = now.getHours().toString().padStart(2, "0");
      const mm = now.getMinutes().toString().padStart(2, "0");
      const cur = `${hh}:${mm}`;
      const withinAny = todayShiftsForMe.some(s => cur >= s.start && cur <= s.end);
      if (!withinAny) {
        const proceed = confirm("You are clocking in outside your assigned shift. Proceed?");
        if (!proceed) return;
      }
    }

    const entry: TimeLog = {
      id: crypto.randomUUID(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      clockIn: new Date().toISOString(),
    };
    const updated = [entry, ...logs];
    setLogs(updated);
    saveTimeLogs(updated);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "time:in", details: "Clock in" });
  };

  const clockOut = () => {
    if (!user) return;
    if (!myOpenLog) return alert("Not clocked in");
    const updated = logs.map((l) => (l.id === myOpenLog.id ? { ...l, clockOut: new Date().toISOString() } : l));
    setLogs(updated);
    saveTimeLogs(updated);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "time:out", details: "Clock out" });
  };

  // Attendance for last 14 days (simple: based on clockIn date)
  const last14 = useMemo(() => {
    const days: { date: string; present: boolean; hours: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = ymd(d);
      const logsForDay = myLogs.filter(l => ymd(new Date(l.clockIn)) === key);
      const hours = logsForDay.reduce((sum, l) => sum + hoursBetween(l.clockIn, l.clockOut), 0);
      days.push({ date: key, present: logsForDay.length > 0, hours: parseFloat(hours.toFixed(2)) });
    }
    return days;
  }, [myLogs]);

  const submitShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const n = empName.trim();
    if (!n || !/\d{4}-\d{2}-\d{2}/.test(shiftDate) || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
      alert("Please enter valid name, date (YYYY-MM-DD), and times (HH:MM)");
      return;
    }
    const s: Shift = { id: crypto.randomUUID(), userName: n, date: shiftDate, start, end };
    addShift(s);
    const next = [s, ...shifts];
    setShifts(next);
    saveShifts(next);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "shift:add", details: `${s.userName} ${s.date} ${s.start}-${s.end}` });
    setEmpName("");
  };

  const submitTimeOff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!/\d{4}-\d{2}-\d{2}/.test(toStart) || !/\d{4}-\d{2}-\d{2}/.test(toEnd)) {
      alert("Please select valid dates");
      return;
    }
    if (toEnd < toStart) {
      alert("End date cannot be before start date");
      return;
    }
    const req: TimeOffRequest = {
      id: crypto.randomUUID(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      type: toType,
      startDate: toStart,
      endDate: toEnd,
      reason: toReason || undefined,
      status: "pending",
      requestedAt: new Date().toISOString(),
    };
    addTimeOffRequest(req);
    setTimeOff(cur => [req, ...cur]);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "timeoff:request", details: `${req.type} ${req.startDate}..${req.endDate}` });
    setToReason("");
  };

  const decideTimeOff = (id: string, decision: "approved" | "declined") => {
    if (!user || !isManagerOrAdmin) return;
    const rec = timeOff.find(r => r.id === id);
    if (!rec) return;
    const updated: TimeOffRequest = { ...rec, status: decision, decidedAt: new Date().toISOString(), decidedBy: { id: user.id, name: user.name } };
    updateTimeOffRequest(updated);
    setTimeOff(cur => cur.map(r => (r.id === id ? updated : r)));
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: decision === "approved" ? "timeoff:approve" : "timeoff:decline", details: `${rec.userName} ${rec.startDate}..${rec.endDate}` });
  };

  const myVisibleShifts = useMemo(() => {
    if (isAdmin) return shifts;
    if (!user) return [] as Shift[];
    return shifts.filter(s => s.userName === user.name);
  }, [shifts, isAdmin, user]);

  return (
    <RequirePermission permission="time:record">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Time In/Out</h1>

        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setTab("logs")} className={`px-3 py-1 rounded border ${tab === "logs" ? "bg-foreground text-background" : ""}`}>My Logs</button>
          <button onClick={() => setTab("attendance")} className={`px-3 py-1 rounded border ${tab === "attendance" ? "bg-foreground text-background" : ""}`}>Attendance</button>
          <button onClick={() => setTab("shifts")} className={`px-3 py-1 rounded border ${tab === "shifts" ? "bg-foreground text-background" : ""}`}>Shifts</button>
          <button onClick={() => setTab("timeoff")} className={`px-3 py-1 rounded border ${tab === "timeoff" ? "bg-foreground text-background" : ""}`}>My Time Off</button>
          {isManagerOrAdmin && (
            <>
              <button onClick={() => setTab("team")} className={`px-3 py-1 rounded border ${tab === "team" ? "bg-foreground text-background" : ""}`}>Team Logs</button>
              <button onClick={() => setTab("timeoffTeam")} className={`px-3 py-1 rounded border ${tab === "timeoffTeam" ? "bg-foreground text-background" : ""}`}>Team Time Off</button>
            </>
          )}
        </div>

        {/* Clock controls always visible */}
        <div className="flex gap-2">
          <button onClick={clockIn} className="px-4 py-2 rounded border">Time In</button>
          <button onClick={clockOut} className="px-4 py-2 rounded border">Time Out</button>
        </div>

        {tab === "logs" && (
          <section>
            <h2 className="text-xl font-semibold mb-2">My Logs</h2>
            {myLogs.length === 0 ? (
              <p className="opacity-70">No logs yet.</p>
            ) : (
              <ul className="space-y-2">
                {myLogs.map((l) => (
                  <li key={l.id} className="p-2 border rounded flex justify-between">
                    <span>In: {new Date(l.clockIn).toLocaleString()}</span>
                    <span>{l.clockOut ? `Out: ${new Date(l.clockOut).toLocaleString()}` : "(Open)"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "attendance" && (
          <section>
            <h2 className="text-xl font-semibold mb-2">Attendance (Last 14 days)</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10">
                  <tr>
                    <th className="text-left p-2 border">Date</th>
                    <th className="text-left p-2 border">Status</th>
                    <th className="text-right p-2 border">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {last14.map((d) => (
                    <tr key={d.date} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                      <td className="p-2 border">{d.date}</td>
                      <td className="p-2 border">{d.present ? "Present" : "Absent"}</td>
                      <td className="p-2 border text-right">{d.hours.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "shifts" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Shifts</h2>

            {isAdmin && (
              <form onSubmit={submitShift} className="grid sm:grid-cols-5 gap-2 p-3 border rounded">
                <input value={empName} onChange={(e) => setEmpName(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-2" placeholder="Employee name" />
                <input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" />
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" />
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" />
                <button className="px-4 py-2 rounded bg-foreground text-background sm:col-span-5">Add Shift</button>
              </form>
            )}

            {myVisibleShifts.length === 0 ? (
              <p className="opacity-70">No shifts scheduled.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      {isAdmin && <th className="text-left p-2 border">Employee</th>}
                      <th className="text-left p-2 border">Date</th>
                      <th className="text-left p-2 border">Start</th>
                      <th className="text-left p-2 border">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myVisibleShifts.map((s) => (
                      <tr key={s.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        {isAdmin && <td className="p-2 border">{s.userName}</td>}
                        <td className="p-2 border">{s.date}</td>
                        <td className="p-2 border">{s.start}</td>
                        <td className="p-2 border">{s.end}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "timeoff" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">My Time Off</h2>
            <form onSubmit={submitTimeOff} className="grid sm:grid-cols-6 gap-2 p-3 border rounded">
              <select value={toType} onChange={e => setToType(e.target.value as TimeOffRequest["type"])} className="border rounded px-3 py-2 bg-transparent sm:col-span-2">
                <option value="vacation">Vacation</option>
                <option value="sick">Sick</option>
                <option value="personal">Personal</option>
                <option value="unpaid">Unpaid</option>
                <option value="other">Other</option>
              </select>
              <input type="date" value={toStart} onChange={e => setToStart(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-2" />
              <input type="date" value={toEnd} onChange={e => setToEnd(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-2" />
              <input value={toReason} onChange={e => setToReason(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-6" placeholder="Reason (optional)" />
              <button className="px-4 py-2 rounded bg-foreground text-background sm:col-span-6">Submit Request</button>
            </form>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10">
                  <tr>
                    <th className="text-left p-2 border">Type</th>
                    <th className="text-left p-2 border">Dates</th>
                    <th className="text-left p-2 border">Reason</th>
                    <th className="text-left p-2 border">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {myTimeOff.length === 0 ? (
                    <tr><td className="p-2 border" colSpan={4}>No time off requests yet.</td></tr>
                  ) : (
                    myTimeOff.map(r => (
                      <tr key={r.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border">{r.type}</td>
                        <td className="p-2 border">{r.startDate} .. {r.endDate}</td>
                        <td className="p-2 border">{r.reason || "—"}</td>
                        <td className="p-2 border">{r.status}{r.decidedBy ? ` by ${r.decidedBy.name}` : ""}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "timeoffTeam" && isManagerOrAdmin && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Team Time Off</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10">
                  <tr>
                    <th className="text-left p-2 border">Employee</th>
                    <th className="text-left p-2 border">Role</th>
                    <th className="text-left p-2 border">Type</th>
                    <th className="text-left p-2 border">Dates</th>
                    <th className="text-left p-2 border">Reason</th>
                    <th className="text-left p-2 border">Status</th>
                    <th className="text-left p-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = [...timeOff].sort((a,b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1));
                    return rows.length === 0 ? (
                      <tr><td className="p-2 border" colSpan={7}>No time off requests.</td></tr>
                    ) : (
                      rows.map(r => (
                        <tr key={r.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                          <td className="p-2 border">{r.userName}</td>
                          <td className="p-2 border">{r.userRole || ""}</td>
                          <td className="p-2 border">{r.type}</td>
                          <td className="p-2 border">{r.startDate} .. {r.endDate}</td>
                          <td className="p-2 border">{r.reason || "—"}</td>
                          <td className="p-2 border">{r.status}</td>
                          <td className="p-2 border">
                            {r.status === "pending" ? (
                              <div className="flex gap-2">
                                <button className="text-xs px-2 py-1 border rounded" onClick={() => decideTimeOff(r.id, "approved")}>Approve</button>
                                <button className="text-xs px-2 py-1 border rounded" onClick={() => decideTimeOff(r.id, "declined")}>Decline</button>
                              </div>
                            ) : (
                              <span className="text-xs opacity-70">{r.decidedBy ? `By ${r.decidedBy.name}` : "—"}</span>
                            )}
                          </td>
                        </tr>
                      ))
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "team" && isManagerOrAdmin && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">Team Logs (Staff & Cashiers)</h2>
            </div>
            {teamLogs.length === 0 ? (
              <p className="opacity-70">No team logs to show.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Name</th>
                      <th className="text-left p-2 border">Role</th>
                      <th className="text-left p-2 border">In</th>
                      <th className="text-left p-2 border">Out</th>
                      <th className="text-right p-2 border">Hours</th>
                      <th className="text-left p-2 border">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamLogs.map((l) => {
                      const hrs = hoursBetween(l.clockIn, l.clockOut);
                      return (
                        <tr key={l.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                          <td className="p-2 border">{l.userName}</td>
                          <td className="p-2 border">{l.userRole || ""}</td>
                          <td className="p-2 border whitespace-nowrap">{new Date(l.clockIn).toLocaleString()}</td>
                          <td className="p-2 border whitespace-nowrap">{l.clockOut ? new Date(l.clockOut).toLocaleString() : "—"}</td>
                          <td className="p-2 border text-right">{hrs.toFixed(2)}</td>
                          <td className="p-2 border">{l.clockOut ? "Closed" : "Open"}</td>
                        </tr>
                      );
                    })}
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
