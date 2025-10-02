# Cafe App (Demo)

A minimal Next.js app that demonstrates:
- POS (Point of Sale)
- Accounting (sales ledger, invoicing, expenses, and simple financial reports)
- Time In/Out tracking
- Role-Based Access Control (RBAC) with roles: admin, cashier, staff

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
  - Inventory: stock-aware catalog that prevents overselling. Seeded with sample items.
  - Sales: add items to cart and checkout. Sales recorded with date, cashier, items, and total.
  - Receipts: each sale gets a receipt number and appears in a Recent Receipts list.
  - Customer data: optionally capture customer name at checkout and store it.
- Accounting: tabs for
  - Ledger: view sales and grand total.
  - Invoices: add simple invoices (customer, amount, status) and list them.
  - Expenses: add expenses (category, note, amount) and list them.
  - Reports: summary cards for Sales Total, Paid Invoices, Expenses, and Net Income.
  Admin and Cashier have access; Staff does not.
- Time: clock in/out, view your personal logs, attendance summary, and simple shift scheduling (admin can add shifts).

## RBAC

Defined in src/lib/rbac.ts
- admin: all permissions
- cashier: pos:use, time:record
- staff: time:record

Pages are protected with a client-side Guard component that checks permissions.

## Notes

- This is a demo: refreshing or clearing site data clears localStorage.
- In production, replace localStorage with a database and real authentication.
