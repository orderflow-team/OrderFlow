# OBIX360 → Google Sheet sales sync

A Google Sheet that stays up to date with every order on the platform. The sheet
pulls from the API every 10 minutes (so data is at most ~10 min old); the server
never holds Google credentials.

Tabs it maintains:
- **Order Lines** – one row per order line (synced).
- **Store Sales** – orders, items sold, revenue, tax per store (formula).
- **Items Sold** – per store + item totals (formula).

Drafts, cancelled and returned orders are excluded from the two summary tabs
but still appear in Order Lines (see the Status column).

## One-time server setup (VPS)

Add one env var to the API `.env`, then restart the API with `--update-env`:

```
SHEETS_SYNC_KEY=<random string, at least 24 characters>
```

Generate one with `openssl rand -hex 32`. Without it the endpoint returns 404
(feature off). Treat it like a password: it gives read access to all orders.

Check: `curl -H "x-sync-key: <key>" "https://<host>/api/sheets-sync/order-lines?limit=1"`
returns JSON; without the header it returns 401.

## Sheet setup

1. Create a Google Sheet in the admin's own Google account (it will hold every store's sales).
2. **Extensions > Apps Script.** Delete the sample code, paste the whole of [`Code.gs`](Code.gs) from this folder, click **Save**, then reload the sheet. Do **not** use Deploy.
3. A menu **OBIX360 Sync** appears (the first time, Google asks you to authorise the script; it only needs access to this sheet and to call your server).
4. **OBIX360 Sync > 1. Connect**: enter `https://obix360.com` and the `SHEETS_SYNC_KEY` value. It tests the connection before saving.
5. **Sync now.** The first run loads the history; a large history finishes over several runs (each run stops after about 4.5 minutes and carries on next time).
6. **2. Start auto-sync** (refreshes about every 10 minutes).

Menu items: **Sync now**, **Stop auto-sync**, **Full resync** (clears Order Lines and reloads everything), **Status** (server, last sync, auto-sync on/off, row count).

## What the tabs contain

- **Order Lines:** one row per order line. Order-level columns (`Orders`, `Order revenue`, `Order tax`) are filled only on the first line of each order, so summing them never counts an order twice. `Net qty` and `Net line subtotal` subtract returned quantity.
- **Store Sales:** per store: orders, items sold, revenue, tax (a `QUERY` formula; excludes draft, cancelled and returned orders).
- **Items Sold:** per store and item: net quantity and net revenue (same exclusions).

## Limits

- A Google Sheet holds about 10 million cells. Order Lines uses 20 columns, so roughly 500,000 lines. Beyond that, archive old years into another sheet.
- The script's key is stored in the script's private properties, not in any cell. Anyone who can **edit the script** can read it.

## Notes

- Rows are replaced per order, so edits, cancellations and returns are picked up.
- An order that is **deleted** in OBIX360 stays in the sheet until you run
  **Full resync**.
- Don't edit the Order Lines tab by hand; the next sync overwrites changed orders.
- To rotate the key: change `SHEETS_SYNC_KEY`, restart the API with `--update-env`, then run **1. Connect** again.
- If a sync fails, the message says why (wrong key, endpoint off, wrong address). The position only moves forward after the sheet was written successfully, so a failed run loses nothing.
