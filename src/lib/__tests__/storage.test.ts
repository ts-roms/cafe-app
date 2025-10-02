import {
  getInventory,
  saveInventory,
  findInventoryByBarcode,
  adjustInventoryForSale,
  getStockLevels,
  ensureDefaultWarehouse,
  totalStockByItem,
  addJournal,
  getJournal,
  postSaleToJournal,
  type Sale,
  type SaleItem,
} from '@/lib/storage';

function makeSale(items: SaleItem[], opts?: Partial<Sale>): Sale {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    cashier: { id: 'u1', name: 'Tester' },
    items,
    total: items.reduce((s, it) => s + it.price * it.qty, 0),
    ...opts,
  };
}

describe('storage helpers', () => {
  beforeEach(() => {
    // Clear app storages used in tests
    const keys = [
      'cafe_inventory',
      'cafe_sales',
      'cafe_accounts',
      'cafe_journal',
      'cafe_fx_rates',
      'cafe_stock_levels',
      'cafe_warehouses',
    ];
    for (const k of keys) try { localStorage.removeItem(k); } catch {}
  });

  it('seeds inventory on first load', () => {
    const inv = getInventory();
    expect(inv.length).toBeGreaterThan(0);
  });

  it('stock levels seed from inventory into Default warehouse when empty', () => {
    const inv = getInventory();
    const levels = getStockLevels();
    expect(levels.length).toBeGreaterThan(0);
    // Each item with initial stock should contribute to totalStockByItem
    const any = inv[0];
    const total = totalStockByItem(any.id);
    expect(total).toBeGreaterThanOrEqual(any.stock);
  });

  it('barcode lookup ignores disabled and archived items', () => {
    const inv = getInventory();
    const item = { ...inv[0], barcode: 'TEST-BC' };
    saveInventory([item, ...inv.slice(1)]);
    // Enabled by default
    expect(findInventoryByBarcode('TEST-BC')?.id).toBe(item.id);
    // Disabled
    saveInventory([{ ...item, enabled: false }, ...inv.slice(1)]);
    expect(findInventoryByBarcode('TEST-BC')).toBeUndefined();
    // Archived
    saveInventory([{ ...item, enabled: true, archived: true }, ...inv.slice(1)]);
    expect(findInventoryByBarcode('TEST-BC')).toBeUndefined();
  });

  it('adjustInventoryForSale decrements stock', () => {
    const inv = getInventory();
    const prod = inv[0];
    const before = prod.stock;
    const updated = adjustInventoryForSale([{ id: prod.id, name: prod.name, price: prod.price, qty: 2 }]);
    const after = updated.find(p => p.id === prod.id)!.stock;
    expect(after).toBe(Math.max(0, (before || 0) - 2));
  });

  it('postSaleToJournal creates a balanced journal entry', () => {
    const inv = getInventory();
    const prod = inv[0];
    const sale = makeSale([{ id: prod.id, name: prod.name, price: prod.price, qty: 1 }]);
    const beforeLen = getJournal().length;
    postSaleToJournal(sale);
    const journal = getJournal();
    expect(journal.length).toBe(beforeLen + 1);
    const entry = journal[0];
    const totalDebits = entry.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = entry.lines.reduce((s, l) => s + l.credit, 0);
    expect(Number(totalDebits.toFixed(2))).toBe(Number(totalCredits.toFixed(2)));
  });
});
