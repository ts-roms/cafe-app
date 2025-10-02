
const SALES_KEY = "cafe_sales";
const TIME_KEY = "cafe_timelogs";
const INVOICE_KEY = "cafe_invoices";
const EXPENSE_KEY = "cafe_expenses";
const INVENTORY_KEY = "cafe_inventory";
const CUSTOMERS_KEY = "cafe_customers";

export type SaleItem = { id: string; name: string; price: number; qty: number };
export type Customer = { id: string; name: string; phone?: string };
export type Sale = {
  id: string;
  at: string; // ISO date
  cashier: { id: string; name: string };
  items: SaleItem[];
  total: number;
  receiptNo?: string;
  customer?: { id: string; name: string };
};

export type InventoryItem = { id: string; name: string; price: number; stock: number };

// Seed inventory if missing
const DEFAULT_INVENTORY: InventoryItem[] = [
  { id: "coffee", name: "Coffee", price: 3, stock: 20 },
  { id: "latte", name: "Latte", price: 4, stock: 20 },
  { id: "tea", name: "Tea", price: 2.5, stock: 20 },
  { id: "sandwich", name: "Sandwich", price: 5.5, stock: 20 },
  { id: "cake", name: "Cake Slice", price: 3.25, stock: 20 },
];

export type TimeLog = {
  id: string;
  userId: string;
  userName: string;
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
