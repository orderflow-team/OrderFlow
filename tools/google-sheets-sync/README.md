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

1. Create a Google Sheet (admin's own account – it holds all stores' sales).
2. Extensions → Apps Script → paste the sync script (the `Code.gs` shared in chat; not stored in the repo yet) → Save → reload the sheet. Do not use Deploy.
3. Menu **OBIX360 Sync → 1. Connect**: enter `https://obix360.com` and the key.
4. **Sync now** (first run loads history; large histories finish over a few runs).
5. **2. Start auto-sync**.

## Notes

- Rows are replaced per order, so edits, cancellations and returns are picked up.
- An order that is **deleted** in OBIX360 stays in the sheet until you run
  **Full resync**.
- Don't edit the Order Lines tab by hand; the next sync overwrites changed orders.
- To rotate the key: change `SHEETS_SYNC_KEY`, restart the API, run Connect again.
