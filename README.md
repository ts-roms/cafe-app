# Cafe App (Demo)

A minimal Next.js app that demonstrates:
- POS (Point of Sale)
- Accounting (sales ledger, invoicing, expenses, and simple financial reports) with CSV export
- Time In/Out tracking with audit logs and shift scheduling
- Role-Based Access Control (RBAC) with roles: admin, manager, cashier, staff
- Admin: Settings (currency, tax rate) and Audit Logs viewer

All data is stored locally in your browser (localStorage) for simplicity. No backend required.

## Getting Started

1. Install dependencies (if not already):
   - npm install
2. Run the dev server:
   - npm run dev
3. Open http://localhost:3000

## Features

- Login (mock): pick a role and optional display name. Stored in localStorage.
- POS:
  - Access rule: Cashiers must time in before using POS.
  - Inventory: stock-aware catalog that prevents overselling. Seeded with sample items.
  - Sales: add items to cart and checkout. Sales recorded with date, cashier, items, and total.
  - Receipts: each sale gets a receipt number and appears in a Recent Receipts list.
  - Customer data: optionally capture customer name at checkout and store it.
  - Taxes & Discounts: configurable tax rate from Admin; per-order discount input; totals show subtotal, tax, grand total.
  - Payment methods: record cash/card/other for each sale.
  - Barcode scanning: scan with a keyboard-wedge barcode scanner or type a code and press Enter. Seed barcodes: 0001–0005 for demo items.
  - Inventory tracking: stock-aware catalog with low-stock indicator and manager/Admin restock action from POS.
  - Offline mode: works offline using localStorage; an offline banner appears when the network is down.
  - Hardware integration: basic support for scanners (as keyboard input) and receipt printing via the browser Print dialog.
- Accounting: tabs for
  - Ledger: view sales and grand total.
  - Invoices: add simple invoices (customer, amount, status) and list them.
  - Expenses: add expenses (category, note, amount) and list them.
  - Reports: summary cards for Sales Total, Paid Invoices, Expenses, and Net Income.
  Admin and Cashier have access; Staff does not.
- Time: clock in/out, view your personal logs, attendance summary, and simple shift scheduling (admin can add shifts). Admin and Manager can view time in/out logs for Staff and Cashiers.

## RBAC

Defined in src/lib/rbac.ts
- admin: all permissions
- cashier: pos:use, time:record
- staff: time:record

Pages are protected with a client-side Guard component that checks permissions.

## Notes

- This is a demo: refreshing or clearing site data clears localStorage.
- In production, replace localStorage with a database and real authentication.
