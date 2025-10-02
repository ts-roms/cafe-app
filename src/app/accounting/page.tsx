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
  getSettings,
  getPaymentProviders,
  savePaymentProviders,
  type PaymentProvider,
  getBankAccounts,
  saveBankAccounts,
  addBankAccount,
  type BankAccount,
  getBankTransactions,
  saveBankTransactions,
  addBankTransactions,
  reconcileBankTransaction,
  type BankTransaction,
  getUsers,
  saveUsers,
  type UserRecord,
  getTimeLogs,
  type TimeLog,
} from "@/lib/storage";

function hoursBetween(startIso: string, endIso?: string): number {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const h = (end - start) / 3600000;
  return Math.max(0, h);
}

export default function AccountingPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"ledger" | "invoices" | "expenses" | "reports" | "payments" | "banking" | "tax" | "payroll">("ledger");

  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Integrations state
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);

  // Payroll state
  const [directory, setDirectory] = useState<UserRecord[]>([]);
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [payStart, setPayStart] = useState<string>(() => new Date(Date.now() - 13 * 86400000).toISOString().slice(0,10));
  const [payEnd, setPayEnd] = useState<string>(() => new Date().toISOString().slice(0,10));

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
    setProviders(getPaymentProviders());
    setAccounts(getBankAccounts());
    setTransactions(getBankTransactions());
    setDirectory(getUsers());
    setLogs(getTimeLogs());
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
          <TabButton label="Payments" active={tab === "payments"} onClick={() => setTab("payments")} />
          <TabButton label="Banking" active={tab === "banking"} onClick={() => setTab("banking")} />
          <TabButton label="Tax" active={tab === "tax"} onClick={() => setTab("tax")} />
          <TabButton label="Payroll" active={tab === "payroll"} onClick={() => setTab("payroll")} />
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

        {tab === "payments" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Payment Integrations</h2>
              <button
                className="px-3 py-1 rounded border text-sm"
                onClick={() => {
                  savePaymentProviders(providers);
                  addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "payments:providers:save" });
                  alert("Saved");
                }}
              >Save</button>
            </div>
            {providers.length === 0 ? (
              <p className="opacity-70">No providers configured.</p>
            ) : (
              <div className="space-y-3">
                {providers.map((p, idx) => (
                  <div key={p.id} className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold">{p.name} <span className="text-xs opacity-70">({p.type})</span></div>
                      <label className="text-sm flex items-center gap-2">
                        <input type="checkbox" checked={p.enabled} onChange={e => {
                          const next = [...providers];
                          next[idx] = { ...p, enabled: e.target.checked };
                          setProviders(next);
                        }} /> Enabled
                      </label>
                    </div>
                    {(p.type === "Stripe" || p.type === "PayPal" || p.type === "MockPay") && (
                      <div className="mt-2">
                        <label className="block text-xs mb-1">API Key / Secret</label>
                        <input value={p.apiKey || ""} onChange={e => {
                          const next = [...providers];
                          next[idx] = { ...p, apiKey: e.target.value };
                          setProviders(next);
                        }} className="w-full border rounded px-3 py-2 bg-transparent" placeholder="Optional for demo" />
                      </div>
                    )}
                  </div>
                ))}
                <button
                  className="px-3 py-2 border rounded"
                  onClick={() => {
                    const enabled = providers.find(x => x.enabled) || providers[0];
                    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "payments:test", details: `Test charge via ${enabled?.name}` });
                    alert(`Test charge approved via ${enabled?.name}`);
                  }}
                >Test $1 Charge (Mock)</button>
              </div>
            )}
          </section>
        )}

        {tab === "banking" && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Banking (Mock)</h2>
              <div className="flex gap-2">
                <button className="px-3 py-1 rounded border text-sm" onClick={() => {
                  const name = prompt("Bank account name", "Primary");
                  if (!name) return;
                  const acc = { id: crypto.randomUUID(), name } as BankAccount;
                  addBankAccount(acc);
                  const next = [acc, ...accounts];
                  setAccounts(next);
                  addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "bank:account:add", details: name });
                }}>Add Account</button>
                <button className="px-3 py-1 rounded border text-sm" onClick={() => {
                  const acc = accounts[0] || { id: crypto.randomUUID(), name: "Primary" } as BankAccount;
                  if (!accounts[0]) { addBankAccount(acc); setAccounts([acc, ...accounts]); }
                  const demo: BankTransaction[] = [
                    { id: crypto.randomUUID(), at: new Date().toISOString(), accountId: acc.id, description: "Card Settlement", amount: 45.75 },
                    { id: crypto.randomUUID(), at: new Date(Date.now() - 86400000).toISOString(), accountId: acc.id, description: "Cash Deposit", amount: 120.00 },
                    { id: crypto.randomUUID(), at: new Date(Date.now() - 2*86400000).toISOString(), accountId: acc.id, description: "Bank Fee", amount: -3.50 },
                  ];
                  addBankTransactions(demo);
                  setTransactions(prev => [...demo, ...prev]);
                  addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "bank:transactions:import", details: `${demo.length} rows` });
                }}>Import Demo Transactions</button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10">
                  <tr>
                    <th className="text-left p-2 border">Date</th>
                    <th className="text-left p-2 border">Account</th>
                    <th className="text-left p-2 border">Description</th>
                    <th className="text-right p-2 border">Amount</th>
                    <th className="text-left p-2 border">Status</th>
                    <th className="text-left p-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => {
                    const acc = accounts.find(a => a.id === t.accountId);
                    return (
                      <tr key={t.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border whitespace-nowrap">{new Date(t.at).toLocaleString()}</td>
                        <td className="p-2 border">{acc?.name || t.accountId}</td>
                        <td className="p-2 border">{t.description}</td>
                        <td className="p-2 border text-right">${t.amount.toFixed(2)}</td>
                        <td className="p-2 border">{t.matchedReceiptNo ? `Matched ${t.matchedReceiptNo}` : "Unmatched"}</td>
                        <td className="p-2 border">
                          {!t.matchedReceiptNo && (
                            <button className="text-xs px-2 py-1 border rounded" onClick={() => {
                              const rn = prompt("Enter receipt number to match", "R-");
                              if (!rn) return;
                              reconcileBankTransaction(t.id, rn);
                              setTransactions(cur => cur.map(x => x.id === t.id ? { ...x, matchedReceiptNo: rn } : x));
                              addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "bank:reconcile", details: rn });
                            }}>Reconcile</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "tax" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Tax</h2>
            {(() => {
              const settings = getSettings();
              const totalTax = sales.reduce((s, x) => s + (x.taxAmount || 0), 0);
              const csv = ((): string => {
                const head = ["date","receipt","subtotal","discount","tax","total"].join(",");
                const body = sales.map(s => {
                  const subtotal = s.items.reduce((sum, it) => sum + it.price * it.qty, 0);
                  return [
                    new Date(s.at).toISOString(),
                    s.receiptNo || "",
                    subtotal.toFixed(2),
                    (s.discountAmount||0).toFixed(2),
                    (s.taxAmount||0).toFixed(2),
                    s.total.toFixed(2)
                  ].join(",");
                }).join("\n");
                return head + "\n" + body;
              })();
              return (
                <div className="space-y-3">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <StatCard label="Tax Rate" value={`${settings.taxRate || 0}%`} />
                    <StatCard label="Tax Collected" value={`$${totalTax.toFixed(2)}`} />
                    <StatCard label="Sales Count" value={String(sales.length)} />
                  </div>
                  <div className="flex gap-2">
                    <a className="px-3 py-1 rounded border text-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`tax-${new Date().toISOString().slice(0,10)}.csv`}>Export CSV</a>
                    <button className="px-3 py-1 rounded border text-sm" onClick={() => {
                      addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "tax:file", details: `Tax filed for ${new Date().toISOString().slice(0,10)}` });
                      alert("Marked as filed (audit recorded)");
                    }}>Mark as Filed</button>
                  </div>
                </div>
              );
            })()}
          </section>
        )}

        {tab === "payroll" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Payroll</h2>
            <div className="grid sm:grid-cols-4 gap-2 p-3 border rounded">
              <label className="text-sm">Start
                <input type="date" value={payStart} onChange={e => setPayStart(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" />
              </label>
              <label className="text-sm">End
                <input type="date" value={payEnd} onChange={e => setPayEnd(e.target.value)} className="w-full border rounded px-3 py-2 bg-transparent" />
              </label>
              <button className="px-4 py-2 rounded border sm:col-span-2" onClick={() => { setLogs(getTimeLogs()); setDirectory(getUsers()); }}>Refresh</button>
            </div>

            {directory.length === 0 ? (
              <p className="opacity-70">No users in directory. Add users in Admin &gt; Users to compute payroll.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">Employee</th>
                      <th className="text-right p-2 border">Hours</th>
                      <th className="text-right p-2 border">Rate</th>
                      <th className="text-right p-2 border">Gross</th>
                      <th className="text-left p-2 border">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {directory.map((u, idx) => {
                      const start = new Date(`${payStart}T00:00:00`);
                      const end = new Date(`${payEnd}T23:59:59`);
                      const myLogs = logs.filter(l => l.userName === u.name && new Date(l.clockIn) >= start && new Date(l.clockIn) <= end);
                      const hours = myLogs.reduce((sum, l) => sum + hoursBetween(l.clockIn, l.clockOut), 0);
                      const rate = u.hourlyRate || 10;
                      const gross = hours * rate;
                      return (
                        <tr key={u.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                          <td className="p-2 border">{u.name} <span className="opacity-60">({u.role})</span></td>
                          <td className="p-2 border text-right">{hours.toFixed(2)}</td>
                          <td className="p-2 border text-right">
                            <input
                              value={String(rate)}
                              onChange={e => {
                                const v = parseFloat(e.target.value) || 0;
                                const next = [...directory];
                                next[idx] = { ...u, hourlyRate: v };
                                setDirectory(next);
                              }}
                              className="w-24 border rounded px-2 py-1 bg-transparent text-right"
                              inputMode="decimal"
                            />
                          </td>
                          <td className="p-2 border text-right">${gross.toFixed(2)}</td>
                          <td className="p-2 border">
                            <button className="text-xs px-2 py-1 border rounded" onClick={() => {
                              // persist rate
                              const next = directory.map(x => x.id === u.id ? { ...x, hourlyRate: u.hourlyRate || 10 } : x);
                              saveUsers(next);
                              setDirectory(next);
                              addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "payroll:mark:paid", details: `${u.name} ${gross.toFixed(2)} ${payStart}..${payEnd}` });
                              alert(`Marked paid (mock): ${u.name} $${gross.toFixed(2)}`);
                            }}>Mark Paid (Mock)</button>
                          </td>
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
