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

# Step C: Ensure pgcrypto extension is active & set Super Admin password to admin123
sudo -u postgres psql -d orderflow_prod -c "CREATE EXTENSION IF NOT EXISTS pgcrypto; UPDATE users SET password_hash = crypt('admin123', gen_salt('bf', 10)), is_active = true WHERE email = 'admin@orderflow.com';"

# Step D: Ensure Owner Admin account is active & reset password to admin123
sudo -u postgres psql -d orderflow_prod -c "UPDATE users SET password_hash = crypt('admin123', gen_salt('bf', 10)), is_active = true WHERE email = 'bhattneel2004@gmail.com';"

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

```bash
curl -X POST https://obix360.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@orderflow.com","password":"admin123"}'
```
Expected output: `{"access_token":"...","user":{...}}` with HTTP 200/201.
