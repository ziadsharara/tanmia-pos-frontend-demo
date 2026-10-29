# Tanmia POS frontend demo

Browser-only demo of the current Tanmia POS frontend. It shares the production screens and styles while using synthetic transactions and browser storage instead of a backend.

## Included

- Libya, Algeria, and Sharjah fairs with a bundled book catalog.
- Book search, editing and Excel import; invoices with optional notes and note dialogs.
- Library accounts: separate payments, statements, balances, returns, cancellation history, optional day/period filters, and three Excel exports.
- Item/quantity partial returns, optional return notes, return detail dialogs, and date/quantity/refund/note editing with history.
- Coupons for direct sales: individual or bulk collection, partial/full amounts, Cash/Visa receipts and a dedicated report/export.
- Updated report cards, semantic amount colors, RTL tables and mobile layouts.
- General Excel exports exclude library activity; library records are exported from Library Accounts. Report screens retain their combined scopes.

No customer database or backend is contacted. Changes stay in each visitor's browser. Version 5 demo storage is upgraded without resetting existing invoices or notes; new visitors receive sample coupon and partial-return records. Older returns without documented item history remain read-only.

## Local development

```bash
npm ci
npm test
npm run dev
npm run build
npm run preview
```

`src/demo/store.js` adapts the frontend API calls to localStorage. `accounts.js` handles the demo account/return/coupon operations; `reportWorkbook.js` generates Excel files using ExcelJS. These are frontend demo modules, not backend code.

The Node tests cover the shared frontend calculations plus storage upgrades, library accounts, return edits, collection retries, currency separation and workbook exports. Browser smoke testing should cover the report tabs, forms, downloads and mobile layouts before deployment.

## Reset only your demo data

```js
localStorage.removeItem('tanmia.pos.demo.data.v1');
localStorage.removeItem('tanmia.activeBookFairId.v1');
location.reload();
```

## Deployment

Production: https://tanmia-pos-frontend-demo-beta.vercel.app

Repository: https://github.com/ziadsharara/tanmia-pos-frontend-demo

Vercel builds `main` using the Vite preset, `npm run build`, output `dist`. No environment variables or API server are required. Hash navigation needs no rewrites. The committed `vendor` folder supplies SheetJS for imports.

Build and test before pushing to `main`; then verify the GitHub/Vercel deployment status and the live site. Deploy only this demo repository. Do not publish the real frontend configuration, customer SQL, backend artifacts or credentials.

This demo is not a shared database and is not intended for real multi-user sales.
