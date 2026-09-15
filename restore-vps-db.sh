#!/bin/bash
set -e

BACKUP_FILE="${1:-/tmp/neon_db_backup_complete_with_schema.sql}"
DB_NAME="${2:-orderflow_prod}"

echo "=========================================================="
echo "🚀 OrderFlow Database Restoration Script"
echo "=========================================================="
echo "Backup File: $BACKUP_FILE"
echo "Target Database: $DB_NAME"
echo ""

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file $BACKUP_FILE not found!"
    echo "Please copy the backup file to $BACKUP_FILE first."
    exit 1
fi

echo "1. Creating database if not exists..."
sudo -u postgres createdb "$DB_NAME" 2>/dev/null || true

echo "2. Restoring complete database schema & 23,371 records..."
sudo -u postgres psql -d "$DB_NAME" -f "$BACKUP_FILE"

echo "3. Configuring extensions and admin passwords..."
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
sudo -u postgres psql -d "$DB_NAME" -c "UPDATE users SET password_hash = crypt('admin123', gen_salt('bf', 10)), is_active = true WHERE email = 'admin@orderflow.com';"
sudo -u postgres psql -d "$DB_NAME" -c "UPDATE users SET password_hash = crypt('admin123', gen_salt('bf', 10)), is_active = true WHERE email = 'bhattneel2004@gmail.com';"
sudo -u postgres psql -d "$DB_NAME" -c "UPDATE platform_settings SET maintenance_mode = false, maintenance_message = NULL;"

echo "4. Restarting PM2 backend services..."
pm2 restart all || true

echo ""
echo "=========================================================="
echo "✅ RESTORATION COMPLETE! VERIFICATION RESULTS:"
echo "=========================================================="
sudo -u postgres psql -d "$DB_NAME" -c "
SELECT 
  (SELECT count(*) FROM businesses) AS total_businesses,
  (SELECT count(*) FROM users) AS total_users,
  (SELECT count(*) FROM products) AS total_products,
  (SELECT count(*) FROM orders) AS total_orders,
  (SELECT count(*) FROM invoices) AS total_invoices;
"
echo "=========================================================="
