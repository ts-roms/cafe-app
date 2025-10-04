
const SALES_KEY = "cafe_sales";
const TIME_KEY = "cafe_timelogs";
const INVOICE_KEY = "cafe_invoices";
const EXPENSE_KEY = "cafe_expenses";
const INVENTORY_KEY = "cafe_inventory";
const CUSTOMERS_KEY = "cafe_customers";
const SETTINGS_KEY = "cafe_settings";
const AUDIT_KEY = "cafe_audit";

// Double-entry accounting storage keys
const ACCOUNTS_KEY = "cafe_accounts";
const JOURNAL_KEY = "cafe_journal";
const RATES_KEY = "cafe_fx_rates";

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
  discountAmount?: number; // total discount applied (manual + promo)
  promoCode?: string; // applied promo code, if any
  promoDiscount?: number; // discount amount from promo only
  paymentMethod?: "cash" | "card" | "other";
  cashTendered?: number; // amount given by customer (cash payments)
  change?: number; // change due to customer (cash payments)
  paymentRef?: string; // reference number for card/other payments
  // Final amount charged (subtotal - discount + tax)
  total: number;
  receiptNo?: string;
  customer?: { id: string; name: string };
};

export type InventoryItem = { id: string; name: string; price: number; stock: number; barcode?: string; enabled?: boolean; archived?: boolean; categoryId?: string; tags?: string[] };

// Seed inventory if missing
const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: "coffee", name: "Coffee", price: 3, stock: 20, barcode: "0001", enabled: true, archived: false },
  { id: "latte", name: "Latte", price: 4, stock: 20, barcode: "0002", enabled: true, archived: false },
  { id: "tea", name: "Tea", price: 2.5, stock: 20, barcode: "0003", enabled: true, archived: false },
  { id: "sandwich", name: "Sandwich", price: 5.5, stock: 20, barcode: "0004", enabled: true, archived: false },
  { id: "cake", name: "Cake Slice", price: 3.25, stock: 20, barcode: "0005", enabled: true, archived: false },
];

import type { Role } from "@/lib/rbac";

export type TimeLog = {
  id: string;
  userId: string;
  userName: string;
  userRole?: Role; // role at the time of logging (optional for backward compatibility)
  clockIn: string; // ISO
  clockOut?: string; // ISO
  // Optional: attached scheduled shift info (if available at time of clock-in)
  shiftDate?: string; // YYYY-MM-DD of the scheduled shift
  shiftStart?: string; // HH:MM scheduled start (local time)
  shiftEnd?: string; // HH:MM scheduled end (local time)
  // Derived attendance metrics in minutes
  lateMinutes?: number; // minutes late based on scheduled start vs actual clock-in
  overtimeMinutes?: number; // minutes beyond scheduled end at clock-out
  undertimeMinutes?: number; // minutes short of scheduled end at clock-out
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

// Time Off requests
const TIME_OFF_KEY = "cafe_timeoff";
export type TimeOffRequest = {
  id: string;
  userId: string;
  userName: string;
  userRole?: Role;
  type: "vacation" | "sick" | "personal" | "unpaid" | "other";
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
  // Paid/unpaid handling
  paid?: boolean; // true if using leave credits; false for unpaid
  days?: number; // inclusive days in the request
  creditDeducted?: number; // number of days deducted from credits when approved (for audit)
  status: "pending" | "approved" | "declined";
  requestedAt: string; // ISO
  decidedAt?: string; // ISO
  decidedBy?: { id: string; name: string };
};

export function getTimeOffRequests(): TimeOffRequest[] {
  try {
    const raw = localStorage.getItem(TIME_OFF_KEY);
    return raw ? (JSON.parse(raw) as TimeOffRequest[]) : [];
  } catch {
    return [];
  }
}

export function saveTimeOffRequests(list: TimeOffRequest[]) {
  localStorage.setItem(TIME_OFF_KEY, JSON.stringify(list));
}

export function addTimeOffRequest(req: TimeOffRequest) {
  const all = getTimeOffRequests();
  all.unshift(req);
  saveTimeOffRequests(all);
}

export function updateTimeOffRequest(req: TimeOffRequest) {
  const all = getTimeOffRequests().map(r => (r.id === req.id ? req : r));
  saveTimeOffRequests(all);
}

// Inventory helpers
const CATEGORIES_KEY = "cafe_categories";
export type Category = { id: string; name: string };
export function getCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? (JSON.parse(raw) as Category[]) : [];
  } catch {
    return [];
  }
}
export function saveCategories(list: Category[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(list));
}
export function addCategory(cat: Category) {
  const all = getCategories();
  all.unshift(cat);
  saveCategories(all);
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
  return inv.find((i) => i.barcode && i.barcode === trimmed && i.enabled !== false && i.archived !== true);
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
  // Also reduce stock from Default warehouse if multi-warehouse tracking is enabled
  try {
    const wh = ensureDefaultWarehouse();
    for (const it of items) {
      adjustStock(wh.id, it.id, -it.qty);
    }
  } catch {}
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
  currency?: string; // original currency (optional)
  rateToBase?: number; // if currency provided, multiplier to base currency
};

export type Expense = {
  id: string;
  at: string; // ISO date
  category: string;
  note?: string;
  amount: number;
  currency?: string; // original currency (optional)
  rateToBase?: number; // if currency provided, multiplier to base currency
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

// --- Double-entry accounting types & helpers ---
export type AccountType = "Asset" | "Liability" | "Equity" | "Revenue" | "Expense";
export type Account = { id: string; code: string; name: string; type: AccountType };

const DEFAULT_ACCOUNTS: Account[] = [
  { id: "cash", code: "1010", name: "Cash", type: "Asset" },
  { id: "bank", code: "1020", name: "Bank", type: "Asset" },
  { id: "ar", code: "1100", name: "Accounts Receivable", type: "Asset" },
  { id: "inventory", code: "1200", name: "Inventory", type: "Asset" },
  { id: "sales", code: "4000", name: "Sales Revenue", type: "Revenue" },
  { id: "discounts", code: "4050", name: "Sales Discounts", type: "Revenue" },
  { id: "cogs", code: "5000", name: "Cost of Goods Sold", type: "Expense" },
  { id: "expenses", code: "6000", name: "Operating Expenses", type: "Expense" },
  { id: "tax", code: "2100", name: "Sales Tax Payable", type: "Liability" },
];

export function getAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as Account[];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(DEFAULT_ACCOUNTS));
    return [...DEFAULT_ACCOUNTS];
  } catch {
    return [...DEFAULT_ACCOUNTS];
  }
}

export function saveAccounts(list: Account[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
}

export type JournalLine = { accountId: string; debit: number; credit: number };
export type JournalEntry = {
  id: string;
  at: string; // ISO date
  memo?: string;
  currency?: string; // original currency code if different from base
  rateToBase?: number; // multiplier to convert original currency -> base
  lines: JournalLine[]; // amounts are in base currency
};

export function getJournal(): JournalEntry[] {
  try {
    const raw = localStorage.getItem(JOURNAL_KEY);
    return raw ? (JSON.parse(raw) as JournalEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveJournal(list: JournalEntry[]) {
  localStorage.setItem(JOURNAL_KEY, JSON.stringify(list));
}

export function addJournal(entry: JournalEntry) {
  const all = getJournal();
  all.unshift(entry);
  saveJournal(all);
}

export type ExchangeRates = Record<string, number>; // currency -> rateToBase

const DEFAULT_RATES: ExchangeRates = { USD: 1, EUR: 0.9, PHP: 58 };

export function getExchangeRates(): ExchangeRates {
  try {
    const raw = localStorage.getItem(RATES_KEY);
    return raw ? (JSON.parse(raw) as ExchangeRates) : { ...DEFAULT_RATES };
  } catch {
    return { ...DEFAULT_RATES };
  }
}

export function saveExchangeRates(r: ExchangeRates) {
  localStorage.setItem(RATES_KEY, JSON.stringify(r));
}

// Posting helpers
export function postSaleToJournal(sale: Sale) {
  const settings = getSettings();
  const baseCur = settings.currency;
  const subtotal = sale.items.reduce((s, it) => s + it.price * it.qty, 0);
  const discount = sale.discountAmount || 0;
  const tax = sale.taxAmount || 0;
  const netRevenue = Math.max(0, subtotal - discount);
  const total = sale.total; // netRevenue + tax
  const cashAccount = (sale.paymentMethod === "cash" || sale.paymentMethod === "card") ? "cash" : "cash";
  const lines: JournalLine[] = [
    { accountId: cashAccount, debit: round2(total), credit: 0 },
    { accountId: "sales", debit: 0, credit: round2(netRevenue) },
  ];
  if (tax > 0) lines.push({ accountId: "tax", debit: 0, credit: round2(tax) });
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    at: sale.at,
    memo: `Sale ${sale.receiptNo || sale.id.slice(0,6)}`,
    currency: baseCur,
    rateToBase: 1,
    lines,
  };
  addJournal(entry);
}

export function postInvoiceToJournal(inv: Invoice) {
  const settings = getSettings();
  const baseCur = settings.currency;
  const rate = inv.currency && inv.currency !== baseCur ? inv.rateToBase || 1 : 1;
  const baseAmt = round2(inv.amount * rate);
  const lines: JournalLine[] = [];
  if (inv.status === "paid") {
    lines.push({ accountId: "cash", debit: baseAmt, credit: 0 });
    lines.push({ accountId: "sales", debit: 0, credit: baseAmt });
  } else {
    lines.push({ accountId: "ar", debit: baseAmt, credit: 0 });
    lines.push({ accountId: "sales", debit: 0, credit: baseAmt });
  }
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    at: inv.at,
    memo: `Invoice ${inv.customer} (${inv.status})`,
    currency: inv.currency || baseCur,
    rateToBase: rate,
    lines,
  };
  addJournal(entry);
}

export function postExpenseToJournal(exp: Expense) {
  const settings = getSettings();
  const baseCur = settings.currency;
  const rate = exp.currency && exp.currency !== baseCur ? exp.rateToBase || 1 : 1;
  const baseAmt = round2(exp.amount * rate);
  const lines: JournalLine[] = [
    { accountId: "expenses", debit: baseAmt, credit: 0 },
    { accountId: "cash", debit: 0, credit: baseAmt },
  ];
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    at: exp.at,
    memo: `Expense ${exp.category}`,
    currency: exp.currency || baseCur,
    rateToBase: rate,
    lines,
  };
  addJournal(entry);
}

export function recordTaxPayment(amount: number) {
  const settings = getSettings();
  const baseCur = settings.currency;
  const baseAmt = round2(amount);
  const lines: JournalLine[] = [
    { accountId: "tax", debit: baseAmt, credit: 0 },
    { accountId: "cash", debit: 0, credit: baseAmt },
  ];
  const entry: JournalEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    memo: "Tax payment",
    currency: baseCur,
    rateToBase: 1,
    lines,
  };
  addJournal(entry);
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
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
  kioskEnabled: boolean; // controls /kiosk availability
};

const DEFAULT_SETTINGS: Settings = {
  companyName: "My Cafe",
  currency: "USD",
  taxRate: 0,
  kioskEnabled: true,
};

export function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    // Backfill any new defaults for backward compatibility
    return { ...DEFAULT_SETTINGS, ...parsed } as Settings;
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

// --- Discounts & Promos ---
const PROMOS_KEY = "cafe_promos";
export type Promo = {
  id: string;
  code: string; // case-insensitive code entered at POS
  type: "amount" | "percent"; // discount type
  value: number; // amount in currency or percent
  minSubtotal?: number; // optional: minimum subtotal to qualify (before discounts)
  active: boolean;
  expiresAt?: string; // ISO date-only or ISO datetime; if set and in past, not valid
  // Usage limiting: optional maximum uses and current usage counter
  maxUses?: number; // if set, promo can only be used this many times in total
  uses?: number; // number of times this promo has been used (persisted)
};

export function getPromos(): Promo[] {
  try {
    const raw = localStorage.getItem(PROMOS_KEY);
    return raw ? (JSON.parse(raw) as Promo[]) : [];
  } catch {
    return [];
  }
}

export function savePromos(list: Promo[]) {
  localStorage.setItem(PROMOS_KEY, JSON.stringify(list));
}

export function addPromo(p: Promo) {
  const all = getPromos();
  all.unshift(p);
  savePromos(all);
}

export function updatePromo(p: Promo) {
  const all = getPromos().map(x => (x.id === p.id ? p : x));
  savePromos(all);
}

export function incrementPromoUsage(id: string) {
  const all = getPromos();
  const idx = all.findIndex(p => p.id === id);
  if (idx === -1) return;
  const promo = all[idx];
  const nextUses = (promo.uses || 0) + 1;
  all[idx] = { ...promo, uses: nextUses };
  savePromos(all);
}

export function findPromoByCode(code: string): Promo | undefined {
  const c = (code || "").trim().toLowerCase();
  if (!c) return undefined;
  return getPromos().find(p => p.code.toLowerCase() === c);
}

// Users directory and RBAC config passthrough (for Admin management)

const USERS_KEY = "cafe_users";

export type UserRecord = {
  id: string;
  name: string;
  role: Role;
  // New auth fields (demo-only; stored in localStorage)
  username?: string; // unique username for login
  code?: string; // optional employee code
  password?: string; // plaintext for demo; do NOT use in production
  hourlyRate?: number; // optional: used by Payroll calculations
  birthday?: string; // optional: YYYY-MM-DD
  // Leave credits (days) that admin can manage
  leaveCredits?: {
    vacation?: number;
    sick?: number;
    personal?: number;
  };
};

export function getUsers(): UserRecord[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    let list: UserRecord[] = raw ? (JSON.parse(raw) as UserRecord[]) : [];
    // Seed a default admin user for first-time setup if no users exist
    if (list.length === 0) {
      const admin: UserRecord = {
        id: crypto.randomUUID(),
        name: "Administrator",
        role: "admin" as Role,
        username: "admin",
        code: "0000",
        password: "admin",
      };
      list = [admin];
      try { localStorage.setItem(USERS_KEY, JSON.stringify(list)); } catch {}
    }
    return list;
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


// --- Held Orders (Sales Processing) ---
const HELD_KEY = "cafe_held_orders";
export type HeldOrder = {
  id: string;
  at: string; // ISO
  cashier: { id: string; name: string };
  items: SaleItem[];
  note?: string;
};

export function getHeldOrders(): HeldOrder[] {
  try {
    const raw = localStorage.getItem(HELD_KEY);
    return raw ? (JSON.parse(raw) as HeldOrder[]) : [];
  } catch {
    return [];
  }
}

export function saveHeldOrders(list: HeldOrder[]) {
  localStorage.setItem(HELD_KEY, JSON.stringify(list));
}

export function addHeldOrder(h: HeldOrder) {
  const all = getHeldOrders();
  all.unshift(h);
  saveHeldOrders(all);
}

export function removeHeldOrder(id: string) {
  const next = getHeldOrders().filter(h => h.id !== id);
  saveHeldOrders(next);
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


// --- Inventory Module Extensions: Warehouses, Purchasing/Receiving, Serial/Expiry, Adjustments ---
const WAREHOUSES_KEY = "cafe_warehouses";
const STOCK_KEY = "cafe_stock_levels";
const PURCHASES_KEY = "cafe_purchases";
const SERIALS_KEY = "cafe_serial_batches";
const ADJUSTMENTS_KEY = "cafe_inventory_adjustments";

export type Warehouse = { id: string; name: string };

export type StockLevel = { itemId: string; warehouseId: string; qty: number };

export type SerialBatch = {
  id: string;
  itemId: string;
  warehouseId: string;
  qty: number;
  serial?: string;
  lot?: string;
  expiry?: string; // ISO date-only
  at: string; // received date ISO
  poId?: string;
};

export type PurchaseItem = { itemId: string; qty: number; cost: number; warehouseId: string };
export type PurchaseOrder = {
  id: string;
  at: string; // created ISO
  supplier: string;
  items: PurchaseItem[];
  status: "open" | "received";
};

export type InventoryAdjustment = {
  id: string;
  at: string;
  reason?: string;
  itemId: string;
  warehouseId: string;
  delta: number; // + increase, - decrease
};

export function getWarehouses(): Warehouse[] {
  try {
    const raw = localStorage.getItem(WAREHOUSES_KEY);
    const list = raw ? (JSON.parse(raw) as Warehouse[]) : [];
    if (list.length === 0) {
      const def = [{ id: "wh-default", name: "Default" }];
      localStorage.setItem(WAREHOUSES_KEY, JSON.stringify(def));
      return def;
    }
    return list;
  } catch {
    return [{ id: "wh-default", name: "Default" }];
  }
}

export function saveWarehouses(list: Warehouse[]) {
  localStorage.setItem(WAREHOUSES_KEY, JSON.stringify(list));
}

export function addWarehouse(wh: Warehouse) {
  const all = getWarehouses();
  const next = [wh, ...all];
  saveWarehouses(next);
}

export function ensureDefaultWarehouse(): Warehouse {
  const all = getWarehouses();
  const found = all.find(w => w.id === "wh-default");
  if (found) return found;
  const def = { id: "wh-default", name: "Default" } as Warehouse;
  addWarehouse(def);
  return def;
}

export function getStockLevels(): StockLevel[] {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    const levels = raw ? (JSON.parse(raw) as StockLevel[]) : [];
    // Seed stock levels from existing inventory if empty (first-run compatibility)
    if (levels.length === 0) {
      const inv = getInventory();
      const wh = ensureDefaultWarehouse();
      const seeded: StockLevel[] = inv
        .filter(p => (p.stock || 0) > 0)
        .map(p => ({ itemId: p.id, warehouseId: wh.id, qty: p.stock }));
      if (seeded.length > 0) {
        localStorage.setItem(STOCK_KEY, JSON.stringify(seeded));
        return seeded;
      }
    }
    return levels;
  } catch {
    return [];
  }
}

export function saveStockLevels(list: StockLevel[]) {
  localStorage.setItem(STOCK_KEY, JSON.stringify(list));
}

export function getStockFor(itemId: string, warehouseId: string): number {
  const levels = getStockLevels();
  return levels.find(s => s.itemId === itemId && s.warehouseId === warehouseId)?.qty || 0;
}

export function setStockLevel(warehouseId: string, itemId: string, qty: number) {
  const levels = getStockLevels();
  let updated = false;
  const next = levels.map(s => {
    if (s.itemId === itemId && s.warehouseId === warehouseId) {
      updated = true;
      return { ...s, qty };
    }
    return s;
  });
  if (!updated) next.push({ itemId, warehouseId, qty });
  saveStockLevels(next);
  syncInventoryTotals();
}

export function adjustStock(warehouseId: string, itemId: string, delta: number) {
  const cur = getStockFor(itemId, warehouseId);
  const nextQty = Math.max(0, cur + delta);
  setStockLevel(warehouseId, itemId, nextQty);
}

export function totalStockByItem(itemId: string): number {
  const levels = getStockLevels();
  return levels.filter(s => s.itemId === itemId).reduce((t, s) => t + s.qty, 0);
}

function syncInventoryTotals() {
  // Keep the existing INVENTORY_KEY in sync for compatibility with POS
  const inv = getInventory();
  const next = inv.map(p => ({ ...p, stock: totalStockByItem(p.id) }));
  saveInventory(next);
}

export function getPurchases(): PurchaseOrder[] {
  try {
    const raw = localStorage.getItem(PURCHASES_KEY);
    return raw ? (JSON.parse(raw) as PurchaseOrder[]) : [];
  } catch {
    return [];
  }
}

export function savePurchases(list: PurchaseOrder[]) {
  localStorage.setItem(PURCHASES_KEY, JSON.stringify(list));
}

export function addPurchase(po: PurchaseOrder) {
  const all = getPurchases();
  all.unshift(po);
  savePurchases(all);
}

export function getSerialBatches(): SerialBatch[] {
  try {
    const raw = localStorage.getItem(SERIALS_KEY);
    return raw ? (JSON.parse(raw) as SerialBatch[]) : [];
  } catch {
    return [];
  }
}

export function saveSerialBatches(list: SerialBatch[]) {
  localStorage.setItem(SERIALS_KEY, JSON.stringify(list));
}

export function addSerialBatches(list: SerialBatch[]) {
  const all = getSerialBatches();
  saveSerialBatches([...list, ...all]);
}

export function receivePurchase(poId: string, batches?: SerialBatch[]) {
  const all = getPurchases();
  const po = all.find(p => p.id === poId);
  if (!po || po.status === "received") return;
  // Update stock per item/warehouse
  for (const it of po.items) {
    adjustStock(it.warehouseId, it.itemId, it.qty);
  }
  if (batches?.length) addSerialBatches(batches);
  // Mark received
  const next = all.map(p => (p.id === poId ? { ...p, status: "received" } : p));
  
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-expect-error
  savePurchases(next);
  // Post-journal entry: Dr Inventory, Cr Cash
  try {
    const total = po.items.reduce((t, i) => t + i.cost * i.qty, 0);
    const settings = getSettings();
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      memo: `PO Receive ${po.supplier}`,
      currency: settings.currency,
      rateToBase: 1,
      lines: [
        { accountId: "inventory", debit: round2(total), credit: 0 },
        { accountId: "cash", debit: 0, credit: round2(total) },
      ],
    };
    addJournal(entry);
  } catch {}
}

export function getAdjustments(): InventoryAdjustment[] {
  try {
    const raw = localStorage.getItem(ADJUSTMENTS_KEY);
    return raw ? (JSON.parse(raw) as InventoryAdjustment[]) : [];
  } catch {
    return [];
  }
}

export function saveAdjustments(list: InventoryAdjustment[]) {
  localStorage.setItem(ADJUSTMENTS_KEY, JSON.stringify(list));
}

function getUnitCost(itemId: string): number {
  const inv = getInventory();
  const item = inv.find(p => p.id === itemId);
  // Prefer explicit cost if present, else fallback to price, else 0
  return (item as InventoryItem)?.price || item?.price || 0;
}

export function applyAdjustment(adj: InventoryAdjustment) {
  const all = getAdjustments();
  all.unshift(adj);
  saveAdjustments(all);
  adjustStock(adj.warehouseId, adj.itemId, adj.delta);
  // Journal: positive -> Dr Inventory / Cr COGS; negative -> Dr COGS / Cr Inventory
  try {
    const amt = Math.abs(adj.delta) * getUnitCost(adj.itemId);
    if (amt > 0) {
      const settings = getSettings();
      const positive = adj.delta > 0;
      const lines: JournalLine[] = positive
        ? [ { accountId: "inventory", debit: round2(amt), credit: 0 }, { accountId: "cogs", debit: 0, credit: round2(amt) } ]
        : [ { accountId: "cogs", debit: round2(amt), credit: 0 }, { accountId: "inventory", debit: 0, credit: round2(amt) } ];
      const entry: JournalEntry = {
        id: crypto.randomUUID(),
        at: adj.at,
        memo: `Inventory Adjust ${adj.reason || ""}`,
        currency: settings.currency,
        rateToBase: 1,
        lines,
      };
      addJournal(entry);
    }
  } catch {}
}
