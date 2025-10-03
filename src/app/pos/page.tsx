"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import { hasPermission } from "@/lib/rbac";
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
  saveInventory,
  findInventoryByBarcode,
  postSaleToJournal,
  getCategories,
  type Category,
  getPromos,
  type Promo,
  getHeldOrders,
  addHeldOrder,
  removeHeldOrder,
  type HeldOrder,
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
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [hasOpenTimeLog, setHasOpenTimeLog] = useState<boolean | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [scan, setScan] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [promos, setPromos] = useState<Promo[]>([]);
  const [promoInput, setPromoInput] = useState<string>("");
  const [appliedPromoId, setAppliedPromoId] = useState<string>("");
  const [held, setHeld] = useState<HeldOrder[]>([]);

  const loadInventory = async () => {
    try {
      const res = await fetch("/api/inventory");
      if (!res.ok) throw new Error("bad");
      const data = await res.json();
      setInventory(Array.isArray(data) ? data : getInventory());
    } catch {
      // Fallback to local storage helpers if Mirage is not running
      setInventory(getInventory());
    }
  };

  useEffect(() => {
    loadInventory();
    setCategories(getCategories());
    setRecent(getSales().slice(0, 5));
    const s = getSettings();
    setTaxRate(typeof s.taxRate === "number" ? s.taxRate : 0);
    setPromos(getPromos());
    setHeld(getHeldOrders());
  }, []);

  // Auto-refresh inventory and categories from Inventory module when window gains focus (e.g., after editing products)
  useEffect(() => {
    const onFocus = () => {
      loadInventory();
      setCategories(getCategories());
    };
    if (typeof window !== "undefined") {
      window.addEventListener("focus", onFocus);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", onFocus);
      }
    };
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

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    if (typeof window !== "undefined") {
      window.addEventListener("online", goOnline);
      window.addEventListener("offline", goOffline);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", goOnline);
        window.removeEventListener("offline", goOffline);
      }
    };
  }, []);

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
  const appliedPromo = useMemo(() => promos.find(p => p.id === appliedPromoId), [promos, appliedPromoId]);
  const promoDiscountAmt = useMemo(() => {
    const p = appliedPromo;
    if (!p) return 0;
    // validate active, expiry, and min subtotal
    const now = Date.now();
    if (!p.active) return 0;
    if (p.expiresAt && new Date(p.expiresAt).getTime() < now) return 0;
    const baseBeforeTax = Math.max(0, subtotal - discountAmt);
    // Use subtotal for minSubtotal qualification since requirement mentions subtotal basis
    if ((p.minSubtotal || 0) > subtotal) return 0;
    let val = 0;
    if (p.type === "percent") {
      // Apply percent off the subtotal, then cap by remaining base (after manual discount)
      val = (subtotal * (p.value || 0)) / 100;
    } else {
      val = p.value || 0;
    }
    val = Math.min(val, baseBeforeTax);
    return parseFloat(val.toFixed(2));
  }, [appliedPromo, subtotal, discountAmt]);
  const taxAmount = useMemo(() => {
    const base = Math.max(0, subtotal - discountAmt - promoDiscountAmt);
    return parseFloat(((base * (taxRate || 0)) / 100).toFixed(2));
  }, [subtotal, discountAmt, promoDiscountAmt, taxRate]);
  const grandTotal = useMemo(() => parseFloat((Math.max(0, subtotal - discountAmt - promoDiscountAmt) + taxAmount).toFixed(2)), [subtotal, discountAmt, promoDiscountAmt, taxAmount]);
  const changeDue = useMemo(() => {
    if (paymentMethod !== "cash") return 0;
    const amt = parseFloat(paymentAmount);
    if (!isFinite(amt)) return 0;
    return parseFloat(Math.max(0, amt - grandTotal).toFixed(2));
  }, [paymentMethod, paymentAmount, grandTotal]);

  const canManageInv = user ? hasPermission(user.role, "inventory:manage") : false;

  const onScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scan.trim();
    if (!code) return;
    const found = findInventoryByBarcode(code);
    if (!found) {
      alert("No item found for this barcode.");
      setScan("");
      return;
    }
    addToCart(found.id);
    setScan("");
  };

  const restockItem = (id: string) => {
    if (!canManageInv) return;
    const prod = inventory.find((p) => p.id === id);
    if (!prod) return;
    const input = prompt(`Add stock for ${prod.name}`, "10");
    if (!input) return;
    const qty = parseInt(input, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Enter a positive whole number");
      return;
    }
    const updated = inventory.map((p) => (p.id === id ? { ...p, stock: p.stock + qty } : p));
    saveInventory(updated);
    setInventory(updated);
    if (user) {
      addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "inventory:restock", details: `${prod.name} +${qty}` });
    }
  };

  const printReceipt = (sale: Sale) => {
    const w = window.open("", "print", "width=380,height=600");
    if (!w) return;
    const dateStr = new Date(sale.at).toLocaleString();
    const itemsHtml = sale.items
      .map((it) => `<div>${it.name} x ${it.qty} @ $${it.price.toFixed(2)}</div>`)
      .join("");
    const html = `<!doctype html><html><head><title>${sale.receiptNo || "Receipt"}</title>
      <style>body{font-family:Arial, sans-serif; padding:12px;} h1{font-size:16px;margin:0 0 8px;} .muted{opacity:.7;font-size:12px} .total{font-weight:600;margin-top:8px}</style>
      </head><body>
      <h1>${sale.receiptNo || "Receipt"}</h1>
      <div class="muted">${dateStr}</div>
      <div class="muted">Cashier: ${sale.cashier.name}</div>
      <hr/>
      ${itemsHtml}
      <div class="muted">Subtotal: $${(sale.items.reduce((s, it) => s + it.price * it.qty, 0)).toFixed(2)}</div>
      <div class="muted">Discount: $${(sale.discountAmount || 0).toFixed(2)}</div>
      ${sale.promoCode ? `<div class="muted">Promo (${sale.promoCode}): -$${(sale.promoDiscount || 0).toFixed(2)}</div>` : ""}
      <div class="muted">Tax: $${(sale.taxAmount || 0).toFixed(2)}</div>
      <div class="total">Total: $${sale.total.toFixed(2)}</div>
      <div class="muted">Payment: ${sale.paymentMethod || "—"}</div>
      ${sale.paymentMethod !== 'cash' && sale.paymentRef ? `<div class="muted">Reference: ${sale.paymentRef}</div>` : ""}
      ${sale.cashTendered != null ? `<div class="muted">Tendered: $${(sale.cashTendered || 0).toFixed(2)}</div>` : ""}
      ${sale.change != null ? `<div class="muted">Change: $${(sale.change || 0).toFixed(2)}</div>` : ""}
      </body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
    setTimeout(() => w.close(), 500);
  };

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

    // Validate payment details
    let cashTenderedNum: number | undefined = undefined;
    let changeNum: number | undefined = undefined;
    if (paymentMethod === "cash") {
      const amt = parseFloat(paymentAmount || "");
      if (!isFinite(amt) || amt < grandTotal) {
        alert(`Enter a valid payment amount >= total ($${grandTotal.toFixed(2)})`);
        return;
      }
      cashTenderedNum = parseFloat(amt.toFixed(2));
      changeNum = parseFloat((amt - grandTotal).toFixed(2));
    } else {
      if (!paymentRef.trim()) {
        alert("Enter a reference # for this payment");
        return;
      }
    }

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
      discountAmount: parseFloat(((discountAmt + promoDiscountAmt)).toFixed(2)),
      promoCode: appliedPromo?.code,
      promoDiscount: promoDiscountAmt,
      paymentMethod,
      cashTendered: cashTenderedNum,
      change: changeNum,
      paymentRef: paymentMethod === "cash" ? undefined : paymentRef.trim(),
      total: grandTotal,
      receiptNo,
      customer: saleCustomer,
    };

    addSale(sale);
    try { postSaleToJournal(sale); } catch {}
    addAudit({ id: crypto.randomUUID(), at: now.toISOString(), user: { id: user.id, name: user.name }, action: "sale:checkout", details: `${receiptNo} ${saleCustomer?.name ? `for ${saleCustomer.name} ` : ""}- ${paymentMethod} - ${grandTotal.toFixed(2)}` });
    const updatedInv = adjustInventoryForSale(items);
    setInventory(updatedInv);
    setRecent((cur) => [sale, ...cur].slice(0, 5));
    clear();
    setAppliedPromoId("");
    setPromoInput("");
    setPaymentAmount("");
    setPaymentRef("");
    alert(`Sale recorded. Receipt: ${receiptNo}`);
  };
  console.info({ appliedPromo })
  return (
    <RequirePermission permission="pos:use">
      {user && (user.role === "cashier" || user.role === "staff") && hasOpenTimeLog === false ? (
        <div className="p-4 border rounded">
          <h2 className="text-xl font-semibold mb-2">Time In Required</h2>
          <p className="mb-3">You need to clock in before using the POS.</p>
          <Link href="/time" className="underline">Go to Time page to Time In</Link>
        </div>
      ) : (
      <div className="space-y-3">
        {!isOnline && (
          <div className="p-2 rounded border bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">Offline mode: data is stored locally and POS remains usable.</div>
        )}
        <div className="grid md:grid-cols-2 gap-6">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-2xl font-semibold">Catalog</h1>
            <button
              className="text-sm px-2 py-1 border rounded"
              onClick={() => loadInventory()}
              title="Reload products from Inventory"
            >Refresh from Inventory (API)</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(() => {
              const nameByCat = (id?: string) => categories.find(c => c.id === id)?.name || "zzzz"; // Uncategorized last
              const visibleProducts = [...inventory]
                .filter(p => p.enabled !== false && p.archived !== true)
                .sort((a, b) => {
                  const ca = nameByCat(a.categoryId);
                  const cb = nameByCat(b.categoryId);
                  const catCmp = ca.localeCompare(cb);
                  if (catCmp !== 0) return catCmp;
                  return a.name.localeCompare(b.name);
                });
              return visibleProducts.map((p) => {
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
                    <div className="text-xs opacity-70 flex items-center gap-2">Stock: {p.stock} {p.stock <= 5 && p.stock > 0 ? <span className="text-orange-600">(Low)</span> : null}</div>
                  </button>
                );
              });
            })()}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cart</h2>
          <form onSubmit={onScanSubmit} className="flex gap-2 items-center">
            <input
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              className="flex-1 border rounded px-3 py-2 bg-transparent"
              placeholder="Scan barcode and press Enter"
              inputMode="numeric"
            />
            <button className="px-3 py-2 rounded border">Add</button>
          </form>
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
              <div className="grid sm:grid-cols-3 gap-2">
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
                  <label className="block text-sm mb-1">Promo Code</label>
                  <div className="flex gap-2">
                    <input
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value)}
                      className="flex-1 border rounded px-3 py-2 bg-transparent"
                      placeholder="Enter code"
                    />
                    {appliedPromo ? (
                      <button type="button" className="px-3 py-2 rounded border" onClick={() => { setAppliedPromoId(""); setPromoInput(""); }}>Remove</button>
                    ) : (
                      <button type="button" className="px-3 py-2 rounded border" onClick={() => {
                        const p = (promos || []).find(x => x.code.toLowerCase() === (promoInput||"").trim().toLowerCase());
                        if (!p) { alert("Promo not found"); return; }
                        // Validate promo before applying
                        const now = Date.now();
                        if (!p.active) { alert("Promo is not active"); return; }
                        if (p.expiresAt && new Date(p.expiresAt).getTime() < now) { alert("Promo has expired"); return; }
                        const min = p.minSubtotal || 0;
                        // Use subtotal basis for qualification
                        if (min > subtotal) { alert(`Promo requires minimum subtotal of $${min.toFixed(2)}`); return; }
                        setAppliedPromoId(p.id);
                        alert(`Applied promo ${p.code}`);
                      }}>Apply</button>
                    )}
                  </div>
                  {appliedPromo ? <div className="text-xs opacity-70 mt-1">Applied: {appliedPromo.code} {appliedPromo.type === 'percent' ? `(${appliedPromo.value}% off)` : `(-$${appliedPromo.value})`}</div> : null}
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-sm mb-1">Payment Method</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as any)} className="w-full border rounded px-3 py-2 bg-transparent">
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {paymentMethod === "cash" ? (
                  <>
                    <div>
                      <label className="block text-sm mb-1">Payment Amount</label>
                      <input
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full border rounded px-3 py-2 bg-transparent text-right"
                        placeholder={grandTotal.toFixed(2)}
                        inputMode="decimal"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1">Change</label>
                      <input
                        value={changeDue.toFixed(2)}
                        readOnly
                        className="w-full border rounded px-3 py-2 bg-transparent text-right opacity-80"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-sm mb-1">Reference #</label>
                    <input
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      className="w-full border rounded px-3 py-2 bg-transparent"
                      placeholder="Auth code / reference"
                    />
                  </div>
                )}
              </div>
              {discountAmt > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm opacity-80">Discount</div>
                  <div className="text-sm">-${discountAmt.toFixed(2)}</div>
                </div>
              )}
              {promoDiscountAmt > 0 && (
                <div className="flex items-center justify-between">
                  <div className="text-sm opacity-80">Promo {appliedPromo?.code ? `(${appliedPromo.code})` : ""}</div>
                  <div className="text-sm">-${promoDiscountAmt.toFixed(2)}</div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="text-sm opacity-80">Subtotal after discounts</div>
                <div className="text-sm">${Math.max(0, subtotal - discountAmt - promoDiscountAmt).toFixed(2)}</div>
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
                <button onClick={() => {
                  if (!user) return;
                  if (items.length === 0) { alert("Cart is empty"); return; }
                  const note = prompt("Hold note (optional)") || undefined;
                  const h: HeldOrder = { id: crypto.randomUUID(), at: new Date().toISOString(), cashier: { id: user.id, name: user.name }, items, note };
                  addHeldOrder(h);
                  setHeld(cur => [h, ...cur]);
                  clear();
                  addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: { id: user.id, name: user.name }, action: "pos:hold", details: h.note || "" });
                  alert("Cart held");
                }} className="px-4 py-2 rounded border">Hold</button>
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
                  <li key={s.id} className="flex items-center justify-between gap-2 border rounded p-2">
                    <span className="whitespace-nowrap">{s.receiptNo || s.id.slice(0, 6).toUpperCase()}</span>
                    <span className="flex-1 text-right sm:text-left">{s.customer?.name ? `${s.customer.name} · ` : ""}{new Date(s.at).toLocaleString()}</span>
                    <span className="font-medium whitespace-nowrap">${s.total.toFixed(2)}</span>
                    <button onClick={() => printReceipt(s)} className="text-xs px-2 py-1 border rounded">Print</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="pt-2">
            <h3 className="text-lg font-semibold mb-1">Held Orders</h3>
            {(() => {
              const mine = user ? held.filter(h => h.cashier.id === user.id) : [];
              return mine.length === 0 ? (
                <p className="text-sm opacity-70">No held orders.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {mine.map(h => (
                    <li key={h.id} className="flex items-center justify-between gap-2 border rounded p-2">
                      <span className="whitespace-nowrap">{new Date(h.at).toLocaleString()}</span>
                      <span className="flex-1 text-right sm:text-left">{h.note || "(no note)"}</span>
                      <div className="flex items-center gap-2">
                        <button className="text-xs px-2 py-1 border rounded" onClick={() => {
                          // restore quantities (clamped by current stock)
                          const next: Record<string, number> = {};
                          for (const it of h.items) {
                            const prod = inventory.find(p => p.id === it.id);
                            const max = prod ? prod.stock : it.qty;
                            next[it.id] = Math.min(it.qty, Math.max(0, max));
                          }
                          setCart(next);
                          removeHeldOrder(h.id);
                          setHeld(cur => cur.filter(x => x.id !== h.id));
                        }}>Restore</button>
                        <button className="text-xs px-2 py-1 border rounded" onClick={() => {
                          if (!confirm("Delete held order?")) return;
                          removeHeldOrder(h.id);
                          setHeld(cur => cur.filter(x => x.id !== h.id));
                        }}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </section>
      </div>
      </div>
      )}
    </RequirePermission>
  );
}
