> **Note:** Restore procedure for the production Postgres database. The helper script is at `scripts/restore-vps-db.sh`. A PDF copy of an earlier version is `database-restore.pdf`.

# 🚀 OrderFlow Database Restoration & VPS Handover Guide

This guide provides the exact step-by-step commands for the DevOps / VPS team to restore the complete production database (**23,371 records, 48 tables, full schema & data**) on the VPS.

---

## 📦 1. Upload Database Backup to VPS

From the local machine (PowerShell / Terminal), copy the complete backup file to the VPS `/tmp` directory:

```bash
scp neon_db_backup_complete_with_schema.sql root@<YOUR_VPS_IP>:/tmp/neon_db_backup_complete_with_schema.sql
```

---

## 🗄️ 2. Database Restoration Commands (Run on VPS)

SSH into your VPS as `root` and execute the following commands:

```bash
# Step A: Ensure target database exists
sudo -u postgres createdb orderflow_prod 2>/dev/null || true

# Step B: Restore the complete database schema, types, indexes, and data
sudo -u postgres psql -d orderflow_prod -f /tmp/neon_db_backup_complete_with_schema.sql

# Step C: Enable pgcrypto (needed only if you must reset an account password)
sudo -u postgres psql -d orderflow_prod -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"

# Step D (only if an account is locked out): reset ONE account to a NEW strong password you choose.
# Do not reuse a shared or default password. scripts/restore-vps-db.sh does this for you when
# RESTORE_ADMIN_EMAIL and RESTORE_ADMIN_PASSWORD are exported (the password is sent on stdin).

# Step E: Ensure Maintenance mode is turned OFF
sudo -u postgres psql -d orderflow_prod -c "UPDATE platform_settings SET maintenance_mode = false, maintenance_message = NULL;"
```

---

## 🔄 3. Restart Application Services

After the database is restored, restart the backend APIs:

```bash
cd /var/www/orderflow

# Restart PM2 processes
pm2 restart all
```

---

## ✅ 4. Verification & Health Check

Run these queries on the VPS to verify all production data was restored successfully:

```bash
# Check key table row counts
sudo -u postgres psql -d orderflow_prod -c "
SELECT 
  (SELECT count(*) FROM businesses) AS total_businesses,
  (SELECT count(*) FROM users) AS total_users,
  (SELECT count(*) FROM products) AS total_products,
  (SELECT count(*) FROM orders) AS total_orders,
  (SELECT count(*) FROM invoices) AS total_invoices,
  (SELECT count(*) FROM customers) AS total_customers;
"
```

### 🎯 Expected Count Results:
* **`total_businesses`**: ~17
* **`total_users`**: ~15
* **`total_products`**: ~2,284
* **`total_orders`**: ~489
* **`total_invoices`**: ~237
* **`total_customers`**: ~80

---

## 🌐 5. Test Live Login Endpoint

Sign in through the web app with an account you know the password for, or check that the API answers:

```bash
curl -s https://obix360.com/api/health
```
Expected output: `{"status":"ok",...}` with HTTP 200.
