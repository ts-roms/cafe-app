"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { RequirePermission } from "@/components/Guard";
import {
  getSales,
  type Sale,
  getInvoices,
  addInvoice,
  type Invoice,
  getExpenses,
  addExpense,
  type Expense,
  addAudit,
} from "@/lib/storage";

export default function AccountingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"ledger" | "invoices" | "expenses" | "reports">("ledger");

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // simple form state
  const [invCustomer, setInvCustomer] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [invStatus, setInvStatus] = useState<"unpaid" | "paid">("unpaid");

  const [expCategory, setExpCategory] = useState("General");
  const [expNote, setExpNote] = useState("");
  const [expAmount, setExpAmount] = useState("");

  useEffect(() => {
    setSales(getSales());
    setInvoices(getInvoices());
    setExpenses(getExpenses());
  }, []);

  const salesTotal = useMemo(() => sales.reduce((s, x) => s + x.total, 0), [sales]);
  const invoicesTotal = useMemo(() => invoices.reduce((s, x) => s + x.amount, 0), [invoices]);
  const invoicesPaidTotal = useMemo(() => invoices.filter(i => i.status === "paid").reduce((s, x) => s + x.amount, 0), [invoices]);
  const expensesTotal = useMemo(() => expenses.reduce((s, x) => s + x.amount, 0), [expenses]);
  const net = useMemo(() => salesTotal + invoicesPaidTotal - expensesTotal, [salesTotal, invoicesPaidTotal, expensesTotal]);

  const salesCsv = useMemo(() => salesToCSV(sales), [sales]);
  const invoicesCsv = useMemo(() => invoicesToCSV(invoices), [invoices]);
  const expensesCsv = useMemo(() => expensesToCSV(expenses), [expenses]);

  const submitInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(invAmount);
    if (!invCustomer.trim() || !isFinite(amt) || amt <= 0) return alert("Enter a valid customer and amount");
    const inv: Invoice = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      customer: invCustomer.trim(),
      amount: parseFloat(amt.toFixed(2)),
      status: invStatus,
    };
    addInvoice(inv);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "invoice:add", details: `${inv.customer} ${inv.status} ${inv.amount.toFixed(2)}` });
    setInvoices((cur) => [inv, ...cur]);
    setInvCustomer("");
    setInvAmount("");
    setInvStatus("unpaid");
    setTab("invoices");
  };

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(expAmount);
    if (!isFinite(amt) || amt <= 0) return alert("Enter a valid amount");
    const exp: Expense = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      category: expCategory.trim() || "General",
      note: expNote.trim() || undefined,
      amount: parseFloat(amt.toFixed(2)),
    };
    addExpense(exp);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "expense:add", details: `${exp.category} ${exp.amount.toFixed(2)}` });
    setExpenses((cur) => [exp, ...cur]);
    setExpNote("");
    setExpAmount("");
    setTab("expenses");
  };

  return (
    <RequirePermission permission="accounting:view">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Accounting</h1>
        <div className="flex gap-2 flex-wrap">
          <TabButton label="Ledger" active={tab === "ledger"} onClick={() => setTab("ledger")} />
          <TabButton label="Invoices" active={tab === "invoices"} onClick={() => setTab("invoices")} />
          <TabButton label="Expenses" active={tab === "expenses"} onClick={() => setTab("expenses")} />
          <TabButton label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} />
        </div>

        {tab === "ledger" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-semibold">Sales Ledger</h2>
              <a className="px-3 py-1 rounded border text-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(salesCsv)}`} download={`sales-${new Date().toISOString().slice(0,10)}.csv`}>Export CSV</a>
            </div>
            {sales.length === 0 ? (
              <p className="opacity-70">No sales recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Date</th>
                      <th className="text-left p-2 border">Cashier</th>
                      <th className="text-left p-2 border">Items</th>
                      <th className="text-right p-2 border">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s) => (
                      <tr key={s.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border whitespace-nowrap">{new Date(s.at).toLocaleString()}</td>
                        <td className="p-2 border">{s.cashier.name}</td>
                        <td className="p-2 border text-sm">
                          {s.items.map((it) => (
                            <div key={it.id}>{it.name} x {it.qty} @ ${it.price.toFixed(2)}</div>
                          ))}
                        </td>
                        <td className="p-2 border text-right font-medium">${s.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="p-2 border font-semibold" colSpan={3}>Grand Total</td>
                      <td className="p-2 border text-right font-semibold">${salesTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "invoices" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Invoices</h2>
              <a className="px-3 py-1 rounded border text-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(invoicesCsv)}`} download={`invoices-${new Date().toISOString().slice(0,10)}.csv`}>Export CSV</a>
            </div>
            <form onSubmit={submitInvoice} className="grid sm:grid-cols-4 gap-2 p-3 border rounded">
              <input value={invCustomer} onChange={(e) => setInvCustomer(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Customer" />
              <input value={invAmount} onChange={(e) => setInvAmount(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Amount" inputMode="decimal" />
              <select value={invStatus} onChange={(e) => setInvStatus(e.target.value as "unpaid" | "paid")} className="border rounded px-3 py-2 bg-transparent sm:col-span-1">
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
              <button className="px-4 py-2 rounded bg-foreground text-background sm:col-span-1">Add</button>
            </form>

            {invoices.length === 0 ? (
              <p className="opacity-70">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Date</th>
                      <th className="text-left p-2 border">Customer</th>
                      <th className="text-left p-2 border">Status</th>
                      <th className="text-right p-2 border">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((i) => (
                      <tr key={i.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border whitespace-nowrap">{new Date(i.at).toLocaleString()}</td>
                        <td className="p-2 border">{i.customer}</td>
                        <td className="p-2 border">{i.status}</td>
                        <td className="p-2 border text-right font-medium">${i.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="p-2 border font-semibold" colSpan={3}>Total</td>
                      <td className="p-2 border text-right font-semibold">${invoicesTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "expenses" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Expenses</h2>
              <a className="px-3 py-1 rounded border text-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(expensesCsv)}`} download={`expenses-${new Date().toISOString().slice(0,10)}.csv`}>Export CSV</a>
            </div>
            <form onSubmit={submitExpense} className="grid sm:grid-cols-5 gap-2 p-3 border rounded">
              <input value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Category" />
              <input value={expNote} onChange={(e) => setExpNote(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-2" placeholder="Note (optional)" />
              <input value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Amount" inputMode="decimal" />
              <button className="px-4 py-2 rounded bg-foreground text-background sm:col-span-1">Add</button>
            </form>

            {expenses.length === 0 ? (
              <p className="opacity-70">No expenses yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Date</th>
                      <th className="text-left p-2 border">Category</th>
                      <th className="text-left p-2 border">Note</th>
                      <th className="text-right p-2 border">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((ex) => (
                      <tr key={ex.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border whitespace-nowrap">{new Date(ex.at).toLocaleString()}</td>
                        <td className="p-2 border">{ex.category}</td>
                        <td className="p-2 border">{ex.note || "—"}</td>
                        <td className="p-2 border text-right font-medium">${ex.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="p-2 border font-semibold" colSpan={3}>Total</td>
                      <td className="p-2 border text-right font-semibold">${expensesTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "reports" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Financial Reports (Summary)</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Sales Total" value={`$${salesTotal.toFixed(2)}`} />
              <StatCard label="Invoices (Paid)" value={`$${invoicesPaidTotal.toFixed(2)}`} />
              <StatCard label="Expenses" value={`$${expensesTotal.toFixed(2)}`} />
              <StatCard label="Net Income" value={`$${net.toFixed(2)}`} />
            </div>
            <p className="text-xs opacity-70">Note: Invoices counted as revenue only when status is Paid.</p>
          </section>
        )}
      </div>
    </RequirePermission>
  );
}

function salesToCSV(rows: Sale[]): string {
  const head = ["at","cashier","items","subtotal","discount","tax","total"].join(",");
  const body = rows.map(s => {
    const subtotal = s.items.reduce((sum, it) => sum + it.price * it.qty, 0);
    const itemsStr = s.items.map(it => `${it.name} x${it.qty} @ ${it.price.toFixed(2)}`).join("; ");
    const arr = [
      new Date(s.at).toISOString(),
      safe(s.cashier.name),
      safe(itemsStr),
      subtotal.toFixed(2),
      (s.discountAmount || 0).toFixed(2),
      (s.taxAmount || 0).toFixed(2),
      s.total.toFixed(2),
    ];
    return arr.join(",");
  }).join("\n");
  return head + "\n" + body;
}

function invoicesToCSV(rows: Invoice[]): string {
  const head = ["at","customer","status","amount"].join(",");
  const body = rows.map(r => [
    new Date(r.at).toISOString(),
    safe(r.customer),
    r.status,
    r.amount.toFixed(2)
  ].join(",")).join("\n");
  return head + "\n" + body;
}

function expensesToCSV(rows: Expense[]): string {
  const head = ["at","category","note","amount"].join(",");
  const body = rows.map(r => [
    new Date(r.at).toISOString(),
    safe(r.category),
    safe(r.note || ""),
    r.amount.toFixed(2)
  ].join(",")).join("\n");
  return head + "\n" + body;
}

function safe(s: string): string {
  const needsQuote = /[",\n]/.test(s);
  let v = s.replaceAll('"', '""');
  return needsQuote ? `"${v}"` : v;
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded border ${active ? "bg-foreground text-background" : ""}`}
    >
      {label}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 border rounded">
      <div className="text-xs opacity-70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
