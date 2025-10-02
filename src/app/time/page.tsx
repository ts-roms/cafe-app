"use client";
import React, { useEffect, useMemo, useState } from "react";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import { getTimeLogs, saveTimeLogs, getShifts, saveShifts, addShift, type TimeLog, type Shift } from "@/lib/storage";

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
  const [tab, setTab] = useState<"logs" | "attendance" | "shifts">("logs");

  // shift form (admin)
  const [empName, setEmpName] = useState("");
  const [shiftDate, setShiftDate] = useState(ymd(new Date()));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  useEffect(() => {
    setLogs(getTimeLogs());
    setShifts(getShifts());
  }, []);

  const myOpenLog = useMemo(() => logs.find((l) => l.userId === user?.id && !l.clockOut), [logs, user?.id]);
  const myLogs = useMemo(() => logs.filter((l) => l.userId === user?.id), [logs, user?.id]);

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
      clockIn: new Date().toISOString(),
    };
    const updated = [entry, ...logs];
    setLogs(updated);
    saveTimeLogs(updated);
  };

  const clockOut = () => {
    if (!user) return;
    if (!myOpenLog) return alert("Not clocked in");
    const updated = logs.map((l) => (l.id === myOpenLog.id ? { ...l, clockOut: new Date().toISOString() } : l));
    setLogs(updated);
    saveTimeLogs(updated);
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

  const isAdmin = user?.role === "admin";

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
    setEmpName("");
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
      </div>
    </RequirePermission>
  );
}
