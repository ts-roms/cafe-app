
const SALES_KEY = "cafe_sales";
const TIME_KEY = "cafe_timelogs";
const INVOICE_KEY = "cafe_invoices";
const EXPENSE_KEY = "cafe_expenses";
const INVENTORY_KEY = "cafe_inventory";
const CUSTOMERS_KEY = "cafe_customers";
const SETTINGS_KEY = "cafe_settings";
const AUDIT_KEY = "cafe_audit";

export type SaleItem = { id: string; name: string; price: number; qty: number };
export type Customer = { id: string; name: string; phone?: string };
export type Sale = {
  id: string;
  at: string; // ISO date
  cashier: { id: string; name: string };
  items: SaleItem[];
  // Order-level adjustments
  taxRate?: number; // percent (e.g., 12 for 12%)
  taxAmount?: number; // computed tax amount
  discountAmount?: number; // absolute amount discount applied to subtotal before tax
  paymentMethod?: "cash" | "card" | "other";
  // Final amount charged (subtotal - discount + tax)
  total: number;
  receiptNo?: string;
  customer?: { id: string; name: string };
};

export type InventoryItem = { id: string; name: string; price: number; stock: number; barcode?: string };

// Seed inventory if missing
const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: "coffee", name: "Coffee", price: 3, stock: 20, barcode: "0001" },
  { id: "latte", name: "Latte", price: 4, stock: 20, barcode: "0002" },
  { id: "tea", name: "Tea", price: 2.5, stock: 20, barcode: "0003" },
  { id: "sandwich", name: "Sandwich", price: 5.5, stock: 20, barcode: "0004" },
  { id: "cake", name: "Cake Slice", price: 3.25, stock: 20, barcode: "0005" },
];

import type { Role } from "@/lib/rbac";

export type TimeLog = {
  id: string;
  userId: string;
  userName: string;
  userRole?: Role; // role at the time of logging (optional for backward compatibility)
  clockIn: string; // ISO
  clockOut?: string; // ISO
};

export function getSales(): Sale[] {
  try {
    const raw = localStorage.getItem(SALES_KEY);
    return raw ? (JSON.parse(raw) as Sale[]) : [];
  } catch {
    return [];
  }
}

export function addSale(sale: Sale) {
  const all = getSales();
  all.unshift(sale);
  localStorage.setItem(SALES_KEY, JSON.stringify(all));
}

export function getTimeLogs(): TimeLog[] {
  try {
    const raw = localStorage.getItem(TIME_KEY);
    return raw ? (JSON.parse(raw) as TimeLog[]) : [];
  } catch {
    return [];
  }
}

export function saveTimeLogs(logs: TimeLog[]) {
  localStorage.setItem(TIME_KEY, JSON.stringify(logs));
}

// Inventory helpers
export function getInventory(): InventoryItem[] {
  try {
    const raw = localStorage.getItem(INVENTORY_KEY);
    if (raw) return JSON.parse(raw) as InventoryItem[];
    // seed
    localStorage.setItem(INVENTORY_KEY, JSON.stringify(DEFAULT_INVENTORY));
    return [...DEFAULT_INVENTORY];
  } catch {
    return [...DEFAULT_INVENTORY];
  }
}

export function saveInventory(list: InventoryItem[]) {
  localStorage.setItem(INVENTORY_KEY, JSON.stringify(list));
}

export function findInventoryByBarcode(code: string): InventoryItem | undefined {
  const trimmed = (code || "").trim();
  if (!trimmed) return undefined;
  const inv = getInventory();
  return inv.find((i) => i.barcode && i.barcode === trimmed);
}

export function adjustInventoryForSale(items: SaleItem[]): InventoryItem[] {
  const inv = getInventory();
  const updated = inv.map((p) => {
    const sold = items.find((i) => i.id === p.id);
    if (!sold) return p;
    const newStock = Math.max(0, p.stock - sold.qty);
    return { ...p, stock: newStock };
  });
  saveInventory(updated);
  return updated;
}

// Customers helpers
export function getCustomers(): Customer[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    return raw ? (JSON.parse(raw) as Customer[]) : [];
  } catch {
    return [];
  }
}

export function saveCustomers(list: Customer[]) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(list));
}

export function addOrGetCustomerByName(name: string): Customer {
  const trimmed = name.trim();
  const all = getCustomers();
  const existing = all.find((c) => c.name.toLowerCase() === trimmed.toLowerCase());
  if (existing) return existing;
  const c: Customer = { id: crypto.randomUUID(), name: trimmed };
  const next = [c, ...all];
  saveCustomers(next);
  return c;
}

// New: Simple accounting models
export type Invoice = {
  id: string;
  at: string; // ISO date
  customer: string;
  amount: number;
  status: "unpaid" | "paid";
};

export type Expense = {
  id: string;
  at: string; // ISO date
  category: string;
  note?: string;
  amount: number;
};

// Invoices helpers
export function getInvoices(): Invoice[] {
  try {
    const raw = localStorage.getItem(INVOICE_KEY);
    return raw ? (JSON.parse(raw) as Invoice[]) : [];
  } catch {
    return [];
  }
}

export function saveInvoices(list: Invoice[]) {
  localStorage.setItem(INVOICE_KEY, JSON.stringify(list));
}

export function addInvoice(inv: Invoice) {
  const all = getInvoices();
  all.unshift(inv);
  saveInvoices(all);
}

// Expenses helpers
export function getExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(EXPENSE_KEY);
    return raw ? (JSON.parse(raw) as Expense[]) : [];
  } catch {
    return [];
  }
}

export function saveExpenses(list: Expense[]) {
  localStorage.setItem(EXPENSE_KEY, JSON.stringify(list));
}

export function addExpense(exp: Expense) {
  const all = getExpenses();
  all.unshift(exp);
  saveExpenses(all);
}

// Shifts (Attendance) helpers
const SHIFTS_KEY = "cafe_shifts";

export type Shift = {
  id: string;
  // For simplicity in this demo we key shifts by employee display name
  userName: string;
  // ISO date-only string YYYY-MM-DD
  date: string;
  // 24h time HH:MM (local time)
  start: string;
  end: string;
};

export function getShifts(): Shift[] {
  try {
    const raw = localStorage.getItem(SHIFTS_KEY);
    return raw ? (JSON.parse(raw) as Shift[]) : [];
  } catch {
    return [];
  }
}

export function saveShifts(list: Shift[]) {
  localStorage.setItem(SHIFTS_KEY, JSON.stringify(list));
}

export function addShift(shift: Shift) {
  const all = getShifts();
  all.unshift(shift);
  saveShifts(all);
}

// Settings helpers and types
export type Settings = {
  companyName: string;
  currency: string; // e.g., USD
  taxRate: number; // percent, e.g., 12 means 12%
};

const DEFAULT_SETTINGS: Settings = {
  companyName: "My Cafe",
  currency: "USD",
  taxRate: 0,
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Settings) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// Audit log helpers and types
export type AuditEntry = {
  id: string;
  at: string; // ISO
  user?: { id: string; name: string };
  action: string; // e.g., "sale:checkout", "invoice:add"
  details?: string;
};

export function getAuditLogs(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveAuditLogs(list: AuditEntry[]) {
  localStorage.setItem(AUDIT_KEY, JSON.stringify(list));
}

export function addAudit(entry: AuditEntry) {
  const all = getAuditLogs();
  all.unshift(entry);
  saveAuditLogs(all);
}


// Users directory and RBAC config passthrough (for Admin management)

const USERS_KEY = "cafe_users";

export type UserRecord = {
  id: string;
  name: string;
  role: Role;
  hourlyRate?: number; // optional: used by Payroll calculations
};

export function getUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? (JSON.parse(raw) as UserRecord[]) : [];
  } catch {
    return [];
  }
}

export function saveUsers(list: UserRecord[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(list));
}

export function addUser(u: UserRecord) {
  const all = getUsers();
  all.unshift(u);
  saveUsers(all);
}

export function updateUser(u: UserRecord) {
  const all = getUsers().map(x => (x.id === u.id ? u : x));
  saveUsers(all);
}

export function deleteUser(id: string) {
  const all = getUsers().filter(x => x.id !== id);
  saveUsers(all);
}


// --- Payments Providers (Integrations) ---
const PAYMENT_PROVIDERS_KEY = "cafe_payment_providers";

export type PaymentProvider = {
  id: string; // stable id
  name: string; // display name
  type: "MockPay" | "Stripe" | "PayPal" | "Custom";
  enabled: boolean;
  apiKey?: string;
};

const DEFAULT_PROVIDERS: PaymentProvider[] = [
  { id: "mockpay", name: "MockPay", type: "MockPay", enabled: true },
  { id: "stripe", name: "Stripe", type: "Stripe", enabled: false, apiKey: "" },
  { id: "paypal", name: "PayPal", type: "PayPal", enabled: false, apiKey: "" },
];

export function getPaymentProviders(): PaymentProvider[] {
  try {
    const raw = localStorage.getItem(PAYMENT_PROVIDERS_KEY);
    return raw ? (JSON.parse(raw) as PaymentProvider[]) : [...DEFAULT_PROVIDERS];
  } catch {
    return [...DEFAULT_PROVIDERS];
  }
}

export function savePaymentProviders(list: PaymentProvider[]) {
  localStorage.setItem(PAYMENT_PROVIDERS_KEY, JSON.stringify(list));
}

// --- Banking (Mock API + Reconciliation) ---
const BANK_ACCOUNTS_KEY = "cafe_bank_accounts";
const BANK_TRANSACTIONS_KEY = "cafe_bank_transactions";

export type BankAccount = { id: string; name: string };
export type BankTransaction = {
  id: string;
  at: string; // ISO date
  accountId: string;
  description: string;
  amount: number; // positive = credit, negative = debit
  matchedReceiptNo?: string; // if reconciled to a Sale receipt
};

export function getBankAccounts(): BankAccount[] {
  try {
    const raw = localStorage.getItem(BANK_ACCOUNTS_KEY);
    return raw ? (JSON.parse(raw) as BankAccount[]) : [];
  } catch {
    return [];
  }
}

export function saveBankAccounts(list: BankAccount[]) {
  localStorage.setItem(BANK_ACCOUNTS_KEY, JSON.stringify(list));
}

export function addBankAccount(acc: BankAccount) {
  const all = getBankAccounts();
  all.unshift(acc);
  saveBankAccounts(all);
}

export function getBankTransactions(): BankTransaction[] {
  try {
    const raw = localStorage.getItem(BANK_TRANSACTIONS_KEY);
    return raw ? (JSON.parse(raw) as BankTransaction[]) : [];
  } catch {
    return [];
  }
}

export function saveBankTransactions(list: BankTransaction[]) {
  localStorage.setItem(BANK_TRANSACTIONS_KEY, JSON.stringify(list));
}

export function addBankTransactions(list: BankTransaction[]) {
  const all = getBankTransactions();
  const next = [...list, ...all];
  saveBankTransactions(next);
}

export function reconcileBankTransaction(txId: string, receiptNo: string) {
  const all = getBankTransactions();
  const next = all.map(t => (t.id === txId ? { ...t, matchedReceiptNo: receiptNo } : t));
  saveBankTransactions(next);
}
