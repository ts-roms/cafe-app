"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import {
  addSale,
  type Sale,
  type SaleItem,
  getInventory,
  type InventoryItem,
  adjustInventoryForSale,
  getSales,
  addOrGetCustomerByName,
  getSettings,
  addAudit,
  getTimeLogs,
} from "@/lib/storage";

export default function POSPage() {
  const { user } = useAuth();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [recent, setRecent] = useState<Sale[]>([]);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [discount, setDiscount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "other">("cash");
  const [hasOpenTimeLog, setHasOpenTimeLog] = useState<boolean | null>(null);

  useEffect(() => {
    setInventory(getInventory());
    setRecent(getSales().slice(0, 5));
    const s = getSettings();
    setTaxRate(typeof s.taxRate === "number" ? s.taxRate : 0);
  }, []);

  useEffect(() => {
    if (!user) {
      setHasOpenTimeLog(null);
      return;
    }
    try {
      const logs = getTimeLogs();
      const open = logs.some((l) => l.userId === user.id && !l.clockOut);
      setHasOpenTimeLog(open);
    } catch {
      setHasOpenTimeLog(false);
    }
  }, [user]);

  const items: SaleItem[] = useMemo(
    () =>
      Object.entries(cart)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => {
          const p = inventory.find((c) => c.id === id)!;
          return { id, name: p.name, price: p.price, qty: q };
        }),
    [cart, inventory]
  );

  const subtotal = useMemo(() => items.reduce((s, it) => s + it.price * it.qty, 0), [items]);
  const discountAmt = useMemo(() => {
    const d = parseFloat(discount);
    return isFinite(d) && d > 0 ? Math.min(d, subtotal) : 0;
  }, [discount, subtotal]);
  const taxAmount = useMemo(() => {
    const base = Math.max(0, subtotal - discountAmt);
    return parseFloat(((base * (taxRate || 0)) / 100).toFixed(2));
  }, [subtotal, discountAmt, taxRate]);
  const grandTotal = useMemo(() => parseFloat((Math.max(0, subtotal - discountAmt) + taxAmount).toFixed(2)), [subtotal, discountAmt, taxAmount]);

  const addToCart = (id: string) =>
    setCart((c) => {
      const prod = inventory.find((p) => p.id === id);
      const current = c[id] || 0;
      if (!prod) return c;
      if (current >= prod.stock) {
        alert("Cannot add more. Out of stock for this item.");
        return c;
      }
      return { ...c, [id]: current + 1 };
    });

  const decFromCart = (id: string) => setCart((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) - 1) }));
  const clear = () => setCart({});

  const checkout = () => {
    if (!user) return;
    if (items.length === 0) return alert("Cart is empty");

    // Generate simple receipt number
    const now = new Date();
    const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const receiptNo = `R-${ymd}-${suffix}`;

    let saleCustomer: { id: string; name: string } | undefined;
    const trimmedName = customerName.trim();
    if (trimmedName) {
      const c = addOrGetCustomerByName(trimmedName);
      saleCustomer = { id: c.id, name: c.name };
    }

    const sale: Sale = {
      id: crypto.randomUUID(),
      at: now.toISOString(),
      cashier: { id: user.id, name: user.name },
      items,
      taxRate,
      taxAmount,
      discountAmount: discountAmt,
      paymentMethod,
      total: grandTotal,
      receiptNo,
      customer: saleCustomer,
    };

    addSale(sale);
    addAudit({ id: crypto.randomUUID(), at: now.toISOString(), user: { id: user.id, name: user.name }, action: "sale:checkout", details: `${receiptNo} ${saleCustomer?.name ? `for ${saleCustomer.name} ` : ""}- ${paymentMethod} - ${grandTotal.toFixed(2)}` });
    const updatedInv = adjustInventoryForSale(items);
    setInventory(updatedInv);
    setRecent((cur) => [sale, ...cur].slice(0, 5));
    clear();
    alert(`Sale recorded. Receipt: ${receiptNo}`);
  };

  return (
    <RequirePermission permission="pos:use">
      {user && (user.role === "cashier" || user.role === "staff") && hasOpenTimeLog === false ? (
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Time In Required</h2>
          <p className="mb-3">You need to clock in before using the POS.</p>
          <Link href="/time" className="underline">Go to Time page to Time In</Link>
        </div>
      ) : (
      <div className="grid md:grid-cols-2 gap-6">
        <section>
          <h1 className="text-2xl font-semibold mb-3">Catalog</h1>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {inventory.map((p) => {
              const out = p.stock <= 0;
              return (
                <button
                  key={p.id}
                  onClick={() => addToCart(p.id)}
                  disabled={out}
                  className={`p-3 border rounded text-left ${out ? "opacity-50 cursor-not-allowed" : "hover:bg-black/5 dark:hover:bg-white/10"}`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm">${p.price.toFixed(2)}</div>
                  <div className="text-xs opacity-70">Stock: {p.stock}</div>
                </button>
              );
            })}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cart</h2>
          {items.length === 0 ? (
            <p className="opacity-70">No items yet. Click on products to add.</p>
          ) : (
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="flex items-center justify-between border rounded p-2">
                  <div>
                    <div className="font-medium">{it.name}</div>
                    <div className="text-xs opacity-70">${it.price.toFixed(2)} x {it.qty}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => decFromCart(it.id)} className="px-2 py-1 border rounded">-</button>
                    <span>{it.qty}</span>
                    <button onClick={() => addToCart(it.id)} className="px-2 py-1 border rounded">+</button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t pt-2 mt-2">
                <div className="font-semibold">Subtotal</div>
                <div className="font-semibold">${subtotal.toFixed(2)}</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">Discount (amount)</label>
                  <input
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full border rounded px-3 py-2 bg-transparent"
                    placeholder="0.00"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full border rounded px-3 py-2 bg-transparent">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Tax ({taxRate}%)</div>
                <div className="text-sm">${taxAmount.toFixed(2)}</div>
              </div>
              <div className="flex items-center justify-between">
                <div className="font-semibold">Grand Total</div>
                <div className="font-semibold">${grandTotal.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-sm mb-1">Customer Name (optional)</label>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full border rounded px-3 py-2 bg-transparent"
                  placeholder="Enter customer name"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={checkout} className="px-4 py-2 rounded bg-foreground text-background">Checkout</button>
                <button onClick={clear} className="px-4 py-2 rounded border">Clear</button>
              </div>
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-lg font-semibold mb-1">Recent Receipts</h3>
            {recent.length === 0 ? (
              <p className="text-sm opacity-70">No receipts yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {recent.map((s) => (
                  <li key={s.id} className="flex justify-between border rounded p-2">
                    <span>{s.receiptNo || s.id.slice(0, 6).toUpperCase()}</span>
                    <span>{s.customer?.name ? `${s.customer.name} · ` : ""}${new Date(s.at).toLocaleString()}</span>
                    <span className="font-medium">${s.total.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
      )}
    </RequirePermission>
  );
}
