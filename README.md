# Tanmia POS frontend demo

This is a separate, browser-only copy of the Tanmia POS frontend. It uses the same screens, navigation, tables, receipt, and styles as `tanmia-pos-frontend`. No backend URL or API server is required.

## Demo data and operations

- Starts with the Libya, Algeria, and Sharjah fairs. Each fair has a static snapshot of 643 books from the local catalog. The demo adds 30 synthetic invoices per fair and sample libraries. Invoice numbers use UUID format, as in the current backend.
- Search, add, edit, delete, and Excel import books; create direct, credit, and gift invoices; record library payments; refund and delete invoices; view reports; and export `.xlsx` reports.
- Sales reduce stock. Refunds and invoice deletion restore stock. Reports reflect changes immediately.
- Changes are saved in the visitor's `localStorage`. Each browser has its own copy, so visitors do not see one another's changes. Clearing site data resets the demo.
- Book catalog data is a static snapshot of the local development backend. Invoices and libraries are generated demonstration records, not real sales.

## Run locally

```bash
npm ci
npm run dev
```

To check the production build, run `npm run build` and `npm run preview`.

## Reset the seed data

In the browser's developer console, run:

```js
localStorage.removeItem('tanmia.pos.demo.data.v1');
localStorage.removeItem('tanmia.activeBookFairId.v1');
location.reload();
```

## Deploy to Vercel

Import [ziadsharara/tanmia-pos-frontend-demo](https://github.com/ziadsharara/tanmia-pos-frontend-demo) into Vercel. Use the Vite framework preset, `npm run build` as the build command, and `dist` as the output directory. No environment variables are needed. The app uses hash-based navigation, so no rewrite rule is required. The committed `vendor` folder provides the SheetJS package used for Excel import.

The deployed site is a demo only: browser storage is not shared or backed up centrally, and it cannot process real sales for multiple people.
