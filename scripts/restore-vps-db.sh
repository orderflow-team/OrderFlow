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

echo "3. Configuring extensions..."
sudo -u postgres psql -d "$DB_NAME" -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
sudo -u postgres psql -d "$DB_NAME" -c "UPDATE platform_settings SET maintenance_mode = false, maintenance_message = NULL;"

# Passwords come from the backup. If an account must be recovered, set RESTORE_ADMIN_EMAIL and
# RESTORE_ADMIN_PASSWORD (a NEW strong password you choose) before running this script. Never
# commit or reuse a shared/default password. The password goes in on stdin, not the command line.
if [ -n "${RESTORE_ADMIN_EMAIL:-}" ] && [ -n "${RESTORE_ADMIN_PASSWORD:-}" ]; then
    echo "   Resetting the password for $RESTORE_ADMIN_EMAIL..."
    printf '%s
' "UPDATE users SET password_hash = crypt(:'pw', gen_salt('bf', 10)), is_active = true WHERE email = :'em';"         | sudo -u postgres psql -d "$DB_NAME" -v pw="$RESTORE_ADMIN_PASSWORD" -v em="$RESTORE_ADMIN_EMAIL"
fi

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
