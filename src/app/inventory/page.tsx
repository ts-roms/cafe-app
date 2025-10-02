"use client";
import React, { useEffect, useMemo, useState } from "react";
import { RequirePermission } from "@/components/Guard";
import { useAuth } from "@/context/AuthContext";
import {
  getInventory,
  saveInventory,
  type InventoryItem,
  getWarehouses,
  addWarehouse,
  saveWarehouses,
  type Warehouse,
  getStockLevels,
  getStockFor,
  adjustStock,
  ensureDefaultWarehouse,
  getPurchases,
  addPurchase,
  receivePurchase,
  type PurchaseOrder,
  type PurchaseItem,
  getSerialBatches,
  type SerialBatch,
  applyAdjustment,
  type InventoryAdjustment,
  addAudit,
  getCategories,
  saveCategories,
  addCategory,
  type Category,
} from "@/lib/storage";

export default function InventoryPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"products" | "warehouses" | "purchasing" | "receiving" | "adjust" | "reports" | "categories">("products");

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stock, setStock] = useState(() => getStockLevels());
  const [posReady, setPosReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // purchasing state
  const [supplier, setSupplier] = useState("");
  const [poItems, setPoItems] = useState<PurchaseItem[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);

  // adjustment state
  const [adjItem, setAdjItem] = useState<string>("");
  const [adjWh, setAdjWh] = useState<string>("");
  const [adjQty, setAdjQty] = useState<string>("0");
  const [adjReason, setAdjReason] = useState<string>("");

  useEffect(() => {
    setProducts(getInventory());
    setWarehouses(getWarehouses());
    setCategories(getCategories());
    ensureDefaultWarehouse();
    setPos(getPurchases());
    setPosReady(true);
  }, []);

  const totalByItem = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of stock) m[s.itemId] = (m[s.itemId] || 0) + s.qty;
    return m;
  }, [stock]);

  const addPoRow = () => {
    const itemId = products[0]?.id;
    const whId = warehouses[0]?.id;
    if (!itemId || !whId) return alert("Add a product and warehouse first");
    const unitCost = (products[0] as any).cost || products[0].price;
    setPoItems((cur) => [...cur, { itemId, qty: 1, cost: unitCost, warehouseId: whId }]);
  };

  const saveProducts = () => {
    saveInventory(products);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "inventory:products:save" });
    alert("Products saved");
  };

  const addProduct = () => {
    const name = prompt("Product name", "New Product");
    if (!name) return;
    const id = `prod-${crypto.randomUUID().slice(0, 8)}`;
    const item: InventoryItem = { id, name, price: 0, stock: 0, enabled: true, archived: false };
    setProducts((cur) => [item, ...cur]);
  };

  const addWh = () => {
    const name = prompt("Warehouse name", "Secondary");
    if (!name) return;
    const wh = { id: crypto.randomUUID(), name } as Warehouse;
    addWarehouse(wh);
    setWarehouses((cur) => [wh, ...cur]);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "inventory:warehouse:add", details: name });
  };

  const renameWh = (id: string, name: string) => {
    const next = warehouses.map((w) => (w.id === id ? { ...w, name } : w));
    saveWarehouses(next);
    setWarehouses(next);
  };

  const saveCats = () => {
    saveCategories(categories);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "inventory:categories:save" });
    alert("Categories saved");
  };

  const doAddCategory = () => {
    const name = prompt("Category name", "Beverages");
    if (!name) return;
    const cat: Category = { id: `cat-${crypto.randomUUID().slice(0,8)}`, name };
    addCategory(cat);
    setCategories(cur => [cat, ...cur]);
  };

  const doDeleteCategory = (id: string) => {
    const used = products.some(p => p.categoryId === id);
    if (used) { alert("Cannot delete: category in use by a product"); return; }
    const next = categories.filter(c => c.id !== id);
    saveCategories(next);
    setCategories(next);
  };

  const createPO = () => {
    if (!supplier.trim() || poItems.length === 0) return alert("Enter supplier and at least one item");
    const po: PurchaseOrder = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      supplier: supplier.trim(),
      items: poItems,
      status: "open",
    };
    addPurchase(po);
    setPos((cur) => [po, ...cur]);
    setSupplier("");
    setPoItems([]);
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "inventory:po:create", details: po.supplier });
  };

  const doReceive = (poId: string) => {
    const po = pos.find((x) => x.id === poId);
    if (!po) return;
    // Optional: capture a single batch meta applied across items (simple demo)
    const lot = prompt("Lot (optional)") || undefined;
    const expiry = prompt("Expiry (YYYY-MM-DD, optional)") || undefined;
    const batches: SerialBatch[] = [];
    const now = new Date().toISOString();
    for (const it of po.items) {
      batches.push({ id: crypto.randomUUID(), itemId: it.itemId, warehouseId: it.warehouseId, qty: it.qty, lot, expiry, at: now, poId });
    }
    receivePurchase(poId, batches);
    setPos(getPurchases());
    setStock(getStockLevels());
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "inventory:po:receive", details: po.supplier });
    alert("Received");
  };

  const applyAdj = () => {
    const qty = parseInt(adjQty, 10);
    if (!adjItem || !adjWh || !Number.isFinite(qty) || qty === 0) return alert("Select item, warehouse, and non-zero qty");
    const adj: InventoryAdjustment = { id: crypto.randomUUID(), at: new Date().toISOString(), reason: adjReason || undefined, itemId: adjItem, warehouseId: adjWh, delta: qty };
    applyAdjustment(adj);
    setStock(getStockLevels());
    setAdjQty("0");
    setAdjReason("");
    addAudit({ id: crypto.randomUUID(), at: new Date().toISOString(), user: user ? { id: user.id, name: user.name } : undefined, action: "inventory:adjust", details: `${adj.itemId} ${adj.delta}` });
    alert("Adjustment applied");
  };

  return (
    <RequirePermission permission="inventory:manage">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex gap-2 flex-wrap">
          <Tab label="Products" active={tab === "products"} onClick={() => setTab("products")} />
          <Tab label="Warehouses" active={tab === "warehouses"} onClick={() => setTab("warehouses")} />
          <Tab label="Purchasing" active={tab === "purchasing"} onClick={() => setTab("purchasing")} />
          <Tab label="Receiving" active={tab === "receiving"} onClick={() => setTab("receiving")} />
          <Tab label="Adjustments" active={tab === "adjust"} onClick={() => setTab("adjust")} />
          <Tab label="Reports" active={tab === "reports"} onClick={() => setTab("reports")} />
          <Tab label="Categories" active={tab === "categories"} onClick={() => setTab("categories")} />
        </div>

        {tab === "products" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Products</h2>
              <div className="flex items-center gap-2">
                <label className="text-sm flex items-center gap-1">
                  <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show Archived
                </label>
                <button className="px-3 py-1 border rounded" onClick={addProduct}>Add Product</button>
                <button className="px-3 py-1 border rounded" onClick={saveProducts}>Save</button>
              </div>
            </div>
            {products.length === 0 ? (
              <p className="opacity-70">No products. POS seeds demo items on first use.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border text-sm">
                  <thead className="bg-black/5 dark:bg-white/10">
                    <tr>
                      <th className="text-left p-2 border">ID</th>
                      <th className="text-left p-2 border">Name</th>
                      <th className="text-right p-2 border">Price</th>
                      <th className="text-right p-2 border">Cost</th>
                      <th className="text-left p-2 border">Barcode</th>
                      <th className="text-left p-2 border">Category</th>
                      <th className="text-left p-2 border">Tags</th>
                      <th className="text-left p-2 border">Enabled</th>
                      <th className="text-left p-2 border">Archived</th>
                      <th className="text-right p-2 border">Total Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.filter(p => showArchived || p.archived !== true).map((p, idx) => (
                      <tr key={p.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border whitespace-nowrap">{p.id}</td>
                        <td className="p-2 border"><input value={p.name} onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...x, name: e.target.value }: x))} className="border rounded px-2 py-1 bg-transparent w-full"/></td>
                        <td className="p-2 border text-right"><input value={String(p.price)} onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...x, price: parseFloat(e.target.value)||0 }: x))} className="border rounded px-2 py-1 bg-transparent w-24 text-right" inputMode="decimal"/></td>
                        <td className="p-2 border text-right"><input value={String((p as any).cost || "")} onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...(x as any), cost: parseFloat(e.target.value)||0 }: x))} className="border rounded px-2 py-1 bg-transparent w-24 text-right" inputMode="decimal"/></td>
                        <td className="p-2 border"><input value={p.barcode || ""} onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...x, barcode: e.target.value }: x))} className="border rounded px-2 py-1 bg-transparent w-full"/></td>
                        <td className="p-2 border">
                          <select value={p.categoryId || ""} onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...x, categoryId: e.target.value || undefined }: x))} className="border rounded px-2 py-1 bg-transparent w-full">
                            <option value="">—</option>
                            {categories.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
                          </select>
                        </td>
                        <td className="p-2 border">
                          <input
                            value={(p.tags || []).join(", ")}
                            onChange={e => {
                              const arr = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                              setProducts(cur => cur.map((x,i)=> i===idx? { ...x, tags: arr }: x));
                            }}
                            className="border rounded px-2 py-1 bg-transparent w-full"
                            placeholder="comma,separated,tags"
                          />
                        </td>
                        <td className="p-2 border">
                          <label className="text-sm flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={p.enabled !== false}
                              onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...x, enabled: e.target.checked }: x))}
                            />
                            <span>{p.enabled === false ? "Disabled" : "Enabled"}</span>
                          </label>
                        </td>
                        <td className="p-2 border">
                          <label className="text-sm flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={p.archived === true}
                              onChange={e => setProducts(cur => cur.map((x,i)=> i===idx? { ...x, archived: e.target.checked }: x))}
                            />
                            <span>{p.archived ? "Archived" : "Active"}</span>
                          </label>
                        </td>
                        <td className="p-2 border text-right">{posReady ? (totalByItem[p.id] || 0) : p.stock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === "warehouses" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Warehouses</h2>
              <button className="px-3 py-1 border rounded" onClick={addWh}>Add Warehouse</button>
            </div>
            <ul className="space-y-2">
              {warehouses.map(w => (
                <li key={w.id} className="p-2 border rounded flex items-center gap-2">
                  <input value={w.name} onChange={e => renameWh(w.id, e.target.value)} className="border rounded px-2 py-1 bg-transparent"/>
                  <span className="text-xs opacity-70">{w.id}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "purchasing" && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Create Purchase Order</h2>
            <div className="grid sm:grid-cols-3 gap-2 p-3 border rounded">
              <input value={supplier} onChange={e => setSupplier(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-3" placeholder="Supplier"/>
              <div className="sm:col-span-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-medium">Items</div>
                  <button className="text-xs px-2 py-1 border rounded" onClick={addPoRow}>Add Row</button>
                </div>
                <div className="space-y-2">
                  {poItems.length === 0 ? <div className="text-sm opacity-70">No items yet.</div> : poItems.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2">
                      <select value={row.itemId} onChange={e => setPoItems(cur => cur.map((r,i)=> i===idx? { ...r, itemId: e.target.value }: r))} className="border rounded px-2 py-1 bg-transparent col-span-4">
                        {products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                      </select>
                      <select value={row.warehouseId} onChange={e => setPoItems(cur => cur.map((r,i)=> i===idx? { ...r, warehouseId: e.target.value }: r))} className="border rounded px-2 py-1 bg-transparent col-span-4">
                        {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
                      </select>
                      <input value={String(row.qty)} onChange={e => setPoItems(cur => cur.map((r,i)=> i===idx? { ...r, qty: parseInt(e.target.value)||0 }: r))} className="border rounded px-2 py-1 bg-transparent text-right col-span-2" inputMode="numeric"/>
                      <input value={String(row.cost)} onChange={e => setPoItems(cur => cur.map((r,i)=> i===idx? { ...r, cost: parseFloat(e.target.value)||0 }: r))} className="border rounded px-2 py-1 bg-transparent text-right col-span-2" inputMode="decimal"/>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={createPO} className="px-4 py-2 rounded bg-foreground text-background sm:col-span-3">Create PO</button>
            </div>

            <h3 className="text-lg font-semibold">Open POs</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10"><tr><th className="text-left p-2 border">Date</th><th className="text-left p-2 border">Supplier</th><th className="text-left p-2 border">Items</th><th className="text-left p-2 border">Status</th></tr></thead>
                <tbody>
                  {pos.filter(p=>p.status==="open").map(p => (
                    <tr key={p.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                      <td className="p-2 border whitespace-nowrap">{new Date(p.at).toLocaleString()}</td>
                      <td className="p-2 border">{p.supplier}</td>
                      <td className="p-2 border">{p.items.map((it, i) => {
                        const prod = products.find(x=>x.id===it.itemId);
                        const wh = warehouses.find(w=>w.id===it.warehouseId);
                        return <div key={i}>{prod?.name || it.itemId} × {it.qty} @ ${it.cost.toFixed(2)} → {wh?.name}</div>;
                      })}</td>
                      <td className="p-2 border">
                        <button className="text-xs px-2 py-1 border rounded" onClick={() => doReceive(p.id)}>Receive</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "receiving" && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Receiving</h2>
            <p className="text-sm opacity-70">Receive open POs from the Purchasing tab. Serial/Lot/Expiry can be captured on receive.</p>
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10"><tr><th className="text-left p-2 border">Date</th><th className="text-left p-2 border">Supplier</th><th className="text-left p-2 border">Status</th></tr></thead>
                <tbody>
                  {pos.map(p => (
                    <tr key={p.id} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                      <td className="p-2 border whitespace-nowrap">{new Date(p.at).toLocaleString()}</td>
                      <td className="p-2 border">{p.supplier}</td>
                      <td className="p-2 border">{p.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "adjust" && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Adjustments</h2>
            <div className="grid sm:grid-cols-6 gap-2 p-3 border rounded">
              <select value={adjItem} onChange={e => setAdjItem(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-2">
                <option value="">Select Item</option>
                {products.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
              <select value={adjWh} onChange={e => setAdjWh(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-2">
                <option value="">Select Warehouse</option>
                {warehouses.map(w => (<option key={w.id} value={w.id}>{w.name}</option>))}
              </select>
              <input value={adjQty} onChange={e => setAdjQty(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-1" placeholder="Qty +/-" inputMode="numeric"/>
              <input value={adjReason} onChange={e => setAdjReason(e.target.value)} className="border rounded px-3 py-2 bg-transparent sm:col-span-3" placeholder="Reason (optional)"/>
              <button onClick={applyAdj} className="px-4 py-2 rounded bg-foreground text-background sm:col-span-6">Apply</button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead className="bg-black/5 dark:bg-white/10"><tr><th className="text-left p-2 border">Item</th><th className="text-left p-2 border">Warehouse</th><th className="text-right p-2 border">On Hand</th></tr></thead>
                <tbody>
                  {products.map(p => (
                    warehouses.map(w => (
                      <tr key={`${p.id}-${w.id}`} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                        <td className="p-2 border">{p.name}</td>
                        <td className="p-2 border">{w.name}</td>
                        <td className="p-2 border text-right">{getStockFor(p.id, w.id)}</td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {tab === "categories" && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Categories</h2>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1 border rounded" onClick={doAddCategory}>Add Category</button>
                <button className="px-3 py-1 border rounded" onClick={saveCats}>Save</button>
              </div>
            </div>
            {categories.length === 0 ? (
              <p className="opacity-70">No categories defined.</p>
            ) : (
              <ul className="space-y-2">
                {categories.map((c, idx) => (
                  <li key={c.id} className="p-2 border rounded flex items-center gap-2">
                    <input
                      value={c.name}
                      onChange={e => setCategories(cur => cur.map((x,i)=> i===idx? { ...x, name: e.target.value }: x))}
                      className="border rounded px-2 py-1 bg-transparent flex-1"
                    />
                    <span className="text-xs opacity-70">{c.id}</span>
                    <button className="text-xs px-2 py-1 border rounded"
                      onClick={() => doDeleteCategory(c.id)}
                      title="Delete category"
                    >Delete</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "reports" && <Reports products={products} />}
      </div>
    </RequirePermission>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`px-3 py-1 rounded border ${active ? "bg-foreground text-background" : ""}`}>{label}</button>;
}

function Reports({ products }: { products: InventoryItem[] }) {
  const warehouses = getWarehouses();
  const levels = getStockLevels();
  const serials = getSerialBatches();
  const rows = products.flatMap(p => warehouses.map(w => ({
    product: p,
    warehouse: w,
    qty: levels.find(s => s.itemId === p.id && s.warehouseId === w.id)?.qty || 0,
  })));

  const csv = useMemo(() => {
    const head = ["product","warehouse","qty"].join(",");
    const body = rows.map(r => [safe(r.product.name), safe(r.warehouse.name), r.qty].join(",")).join("\n");
    return head + "\n" + body;
  }, [rows]);

  const today = new Date();
  const soon = serials.filter(b => b.expiry && daysUntil(b.expiry!) <= 30);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stock by Warehouse</h2>
        <a className="px-3 py-1 rounded border text-sm" href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`inventory-${new Date().toISOString().slice(0,10)}.csv`}>Export CSV</a>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full border text-sm">
          <thead className="bg-black/5 dark:bg-white/10"><tr><th className="text-left p-2 border">Product</th><th className="text-left p-2 border">Warehouse</th><th className="text-right p-2 border">Qty</th><th className="text-left p-2 border">Code</th><th className="text-left p-2 border">QR</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="odd:bg-black/0 even:bg-black/5 dark:even:bg-white/5">
                <td className="p-2 border">{r.product.name}</td>
                <td className="p-2 border">{r.warehouse.name}</td>
                <td className="p-2 border text-right">{r.qty}</td>
                <td className="p-2 border">{r.product.barcode || "—"}</td>
                <td className="p-2 border"><MiniQR text={r.product.id} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Expiring Soon (≤ 30 days)</h3>
        {soon.length === 0 ? <p className="text-sm opacity-70">No serial/lot with upcoming expiry.</p> : (
          <ul className="space-y-1 text-sm">
            {soon.map(b => {
              const p = products.find(x=>x.id===b.itemId);
              const w = warehouses.find(x=>x.id===b.warehouseId);
              return <li key={b.id} className="border rounded p-2">{p?.name || b.itemId} · {w?.name || b.warehouseId} · Qty {b.qty} · Exp {b.expiry}</li>;
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr);
  const today = new Date();
  return Math.ceil((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
}

function safe(s: string): string {
  const needs = /[",\n]/.test(s);
  const v = s.replaceAll('"','""');
  return needs ? `"${v}"` : s;
}

function MiniQR({ text }: { text: string }) {
  // Super-minimal QR-like block pattern based on char codes (not a real QR, demo only)
  const size = 8;
  const cells: number[][] = [];
  let seed = 0;
  for (let i=0;i<text.length;i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0;
  for (let y=0;y<size;y++) {
    const row: number[] = [];
    for (let x=0;x<size;x++) {
      const v = (seed ^ (x*73856093) ^ (y*19349663)) & 1;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      row.push(v);
    }
    cells.push(row);
  }
  const box = 4;
  return (
    <svg width={size*box} height={size*box} aria-label="QR">
      {cells.map((row, y) => row.map((v, x) => (
        <rect key={`${x}-${y}`} x={x*box} y={y*box} width={box} height={box} fill={v ? "#000" : "#fff"} />
      )))}
      <rect x={0} y={0} width={size*box} height={size*box} fill="none" stroke="#000" strokeWidth={1} />
    </svg>
  );
}
