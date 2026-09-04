# Orderflow - Complete System Documentation & VPS Deployment Guide

Welcome to the official documentation for **Orderflow** — a multi-tenant POS, Inventory Management, Billing, Restaurant KOT, Pharmacy Schedule H1, and Business Management Platform.

---

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Complete REST API Reference](#2-complete-rest-api-reference)
   - [Authentication & Sessions](#1-authentication--sessions-auth)
   - [Business Workspaces](#2-business-workspaces-apibusinesses)
   - [Products & Catalog](#3-products--catalog-apiproducts)
   - [Orders & Point of Sale](#4-orders--point-of-sale-apiorders)
   - [Customers & Suppliers](#5-customers--suppliers-apicustomers-apisuppliers)
   - [Inventory & Purchase Orders](#6-inventory--purchase-orders-apiinventory)
   - [Billing, Invoices & Payments](#7-billing-invoices--payments-apibilling)
   - [Expenses](#8-expenses-apiexpenses)
   - [AI & Voice Order Parsing](#9-ai--voice-order-parsing-apiai)
   - [Invoice Scanning & OCR](#10-invoice-scanning--ocr-apiinvoice-scans)
   - [Restaurant Management](#11-restaurant-management-apirestaurant)
   - [Staff & Attendance](#12-staff--attendance-apistaff)
   - [Salesman & Field Visits](#13-salesman--field-visits-apisalesman)
   - [Reports & Analytics](#14-reports--analytics-apireports)
   - [Notifications](#15-notifications-apinotifications)
   - [Subscriptions & Referrals](#16-subscriptions--referrals-apisubscriptions)
   - [Business Connections (B2B Sync)](#17-business-connections-b2b-sync-apibusiness-connections)
   - [App Releases & Updates](#18-app-releases--updates-apiapp-apk-releases-apiapp-updates)
   - [Platform Administration](#19-platform-administration-apiplatform-admin)
   - [Developer Tools](#20-developer-tools-apidev)
3. [API Testing Guide (cURL & Postman)](#3-api-testing-guide-curl--postman)
4. [Complete VPS Deployment & Hosting Guide](#4-complete-vps-deployment--hosting-guide)

---

## 1. System Architecture

Orderflow is built as a Turbo monorepo containing:
- **Backend API (`packages/api`):** NestJS framework with TypeORM/Neon Postgres, JWT Auth, Role-Based Access Control (RBAC), and Puppeteer PDF generator.
- **Web App (`apps/web`):** Next.js App Router with React, Vanilla CSS design tokens, and Capacitor WebView support.
- **Database:** PostgreSQL (Managed Neon Postgres or self-hosted PostgreSQL 16).
- **Object Storage:** Neon S3 / AWS S3 compatible storage for store logos, receipts, QR codes, and prescriptions.

---

## 2. Complete REST API Reference

> **Base Server URL:** `http://localhost:4000` (Dev) or `https://yourdomain.com` (Prod)  
> **Tenant Scoping:** Most business routes accept `@Query('businessId')` or require header authentication context.

### 1. Authentication & Sessions (`/auth`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/signup` | Public | Register a new user account |
| `POST` | `/auth/login` | Public | Authenticate user with email and password |
| `POST` | `/auth/refresh` | Public | Refresh expired JWT tokens |
| `POST` | `/auth/otp/request` | Public | Request OTP for mobile/email verification |
| `POST` | `/auth/otp/verify` | Public | Verify OTP code |
| `POST` | `/auth/password/forgot` | Public | Request password reset email |
| `POST` | `/auth/password/reset` | Public | Reset password with token |
| `POST` | `/auth/password/change` | Authenticated | Change current password |
| `POST` | `/auth/table-guest-login` | Public | Guest session login for dining table QR ordering |
| `POST` | `/auth/takeaway-guest-login` | Public | Guest session login for takeaway QR ordering |

### 2. Business Workspaces (`/api/businesses`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/businesses/onboard` | Authenticated | Attach initial business workspace on signup |
| `GET` | `/api/businesses/mine` | Authenticated | List all stores/workspaces owned by user |
| `POST` | `/api/businesses/:id/select` | Authenticated | Switch active business workspace context |
| `POST` | `/api/businesses` | Authenticated | Create a new business workspace |
| `GET` | `/api/businesses/:id` | Authenticated | Get store details |
| `PATCH` | `/api/businesses/:id` | Admin, Manager | Update store details |
| `POST` | `/api/businesses/:id/logo` | Admin, Manager | Upload store logo image (S3/Object Storage) |
| `DELETE` | `/api/businesses/:id/logo` | Admin, Manager | Remove store logo |
| `POST` | `/api/businesses/:id/upi-qr` | Admin, Manager | Upload store UPI QR Code image |
| `DELETE` | `/api/businesses/:id/upi-qr` | Admin, Manager | Remove store UPI QR Code |
| `DELETE` | `/api/businesses/:id` | Admin | Delete business workspace permanently |

### 3. Products & Catalog (`/api/products`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/products/upload` | Admin, Manager | Upload product image to S3 |
| `POST` | `/api/products/with-variants` | Admin, Manager | Quick-add product with packaging/pricing variants |
| `POST` | `/api/products` | Admin, Manager, Salesman | Create new product |
| `GET` | `/api/products` | Authenticated | List products (`search`, `category`, `isDraft`, `limit`, `offset`) |
| `GET` | `/api/products/barcode-lookup` | Authenticated | Cross-tenant barcode lookup for product prefill |
| `GET` | `/api/products/stats` | Authenticated | Get total product count and category breakdown |
| `GET` | `/api/products/:id` | Authenticated | Get product details by ID |
| `PATCH` | `/api/products/:id` | Admin, Manager | Update product details |
| `DELETE` | `/api/products/:id` | Admin, Manager | Delete product |
| `POST` | `/api/products/merge` | Admin, Manager | Merge duplicate products (reassigning history) |

### 4. Orders & Point of Sale (`/api/orders`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/orders/prescription-upload` | Authenticated | Upload prescription photo for pharmacy orders |
| `GET` | `/api/orders/:id/prescription-url` | Authenticated | Get presigned S3 URL for private prescription |
| `POST` | `/api/orders` | Authenticated | Create a new sales order |
| `GET` | `/api/orders` | Authenticated | List orders (`status`, `customerId`, `search`, `limit`, `offset`) |
| `GET` | `/api/orders/customer-prices` | Authenticated | Get historical customer-specific pricing |
| `POST` | `/api/orders/suggest-price` | Authenticated | AI/Historical price suggestion for items |
| `GET` | `/api/orders/:id/receipt` | Authenticated | HTML thermal receipt for order |
| `GET` | `/api/orders/:id` | Authenticated | Get order details |
| `PATCH` | `/api/orders/:id/status` | Authenticated | Update order status |
| `POST` | `/api/orders/:id/return` | Authenticated | Process partial or full order return |
| `POST` | `/api/orders/:id/items` | Authenticated | Append items to existing order |
| `PUT` | `/api/orders/:id/items` | Authenticated | Overwrite items in existing order |
| `DELETE` | `/api/orders/:id` | Authenticated | Delete order |

### 5. Customers & Suppliers (`/api/customers`, `/api/suppliers`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/customers` | Authenticated | Create new customer |
| `GET` | `/api/customers` | Authenticated | List customers (`search`, `limit`, `offset`) |
| `GET` | `/api/customers/stats` | Authenticated | Customer aggregate stats (total balance, total count) |
| `GET` | `/api/customers/:id` | Authenticated | Get customer profile & ledger |
| `PATCH` | `/api/customers/:id` | Authenticated | Update customer details |
| `DELETE` | `/api/customers/:id` | Authenticated | Delete customer |
| `POST` | `/api/suppliers` | Authenticated | Create supplier |
| `GET` | `/api/suppliers` | Authenticated | List suppliers |
| `GET` | `/api/suppliers/:id` | Authenticated | Get supplier profile |
| `PATCH` | `/api/suppliers/:id` | Authenticated | Update supplier |
| `DELETE` | `/api/suppliers/:id` | Authenticated | Delete supplier |

### 6. Inventory & Purchase Orders (`/api/inventory`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/inventory/purchase-orders` | Admin, Manager | Create Purchase Order (PO) |
| `GET` | `/api/inventory/purchase-orders` | Authenticated | List purchase orders |
| `GET` | `/api/inventory/purchase-orders/:id` | Authenticated | Get PO details |
| `PATCH` | `/api/inventory/purchase-orders/:id` | Admin, Manager | Update PO |
| `POST` | `/api/inventory/purchase-orders/:id/receive` | Admin, Manager | Receive PO items into inventory |
| `POST` | `/api/inventory/purchase-orders/:id/confirm` | Admin, Manager | Confirm PO |
| `POST` | `/api/inventory/purchase-orders/:id/mark-paid` | Admin, Manager | Mark PO as paid |
| `POST` | `/api/inventory/purchase-orders/:id/cancel` | Admin, Manager | Cancel PO |
| `POST` | `/api/inventory/adjust` | Admin, Manager | Manual stock adjustment |
| `POST` | `/api/inventory/supplier-returns` | Admin, Manager | Create return to supplier |
| `GET` | `/api/inventory/supplier-returns` | Authenticated | List supplier returns |
| `PATCH` | `/api/inventory/supplier-returns/:id/status` | Admin, Manager | Update return status (`pending`, `credited`) |
| `GET` | `/api/inventory/products/:productId/batches` | Authenticated | Get active batches for product |
| `GET` | `/api/inventory/batches/:batchId/orders` | Authenticated | Batch recall lookup (orders referencing batch) |
| `GET` | `/api/inventory/stock-history` | Authenticated | View stock audit log |
| `GET` | `/api/inventory/low-stock` | Authenticated | List low-stock items below threshold |

### 7. Billing, Invoices & Payments (`/api/billing`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/billing/invoices/public/pdf` | Token Signed | Public PDF invoice download link |
| `POST` | `/api/billing/invoices/from-order/:orderId` | Admin, Manager, Cashier, Accountant | Generate invoice from order |
| `GET` | `/api/billing/invoices` | Authenticated | List invoices |
| `GET` | `/api/billing/invoices/:id` | Authenticated | Get single invoice details |
| `GET` | `/api/billing/invoices/:id/pdf` | Authenticated | Download A4 PDF invoice |
| `GET` | `/api/billing/invoices/:id/receipt` | Authenticated | Thermal receipt (58/80mm) HTML view |
| `GET` | `/api/billing/invoices/:id/share-link` | Authenticated | Generate WhatsApp share token link |
| `POST` | `/api/billing/payments` | Admin, Manager, Cashier, Accountant | Record payment against invoice/order |
| `POST` | `/api/billing/payments/pay-total` | Admin, Manager, Cashier, Accountant | Lump sum payment across outstanding customer orders |
| `POST` | `/api/billing/payments/apply-advance` | Admin, Manager, Cashier, Accountant | Apply customer advance credit to outstanding orders |
| `POST` | `/api/billing/payments/:id/undo` | Admin, Manager, Accountant | Void/undo a payment |
| `GET` | `/api/billing/payments` | Authenticated | List payments |

### 8. Expenses (`/api/expenses`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/expenses` | Authenticated | Create expense record |
| `GET` | `/api/expenses` | Authenticated | List expenses (`from`, `to` date filters) |
| `DELETE` | `/api/expenses/:id` | Authenticated | Delete expense record |

### 9. AI & Voice Order Parsing (`/api/ai`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/ai/parse-voice` | Authenticated (Throttled) | Parse speech-to-text transcript into order items |
| `POST` | `/api/ai/chat-order` | Authenticated (Throttled) | Parse chat message (WhatsApp order) into structured order |

### 10. Invoice Scanning & OCR (`/api/invoice-scans`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/invoice-scans/upload` | Admin, Manager | Upload purchase invoice image/PDF for AI OCR parsing |
| `GET` | `/api/invoice-scans` | Authenticated | List scanned invoices |
| `GET` | `/api/invoice-scans/:id` | Authenticated | Get scanned invoice parsed data |
| `POST` | `/api/invoice-scans/:id/confirm` | Admin, Manager | Confirm parsed scan to auto-create products & PO |

### 11. Restaurant Management (`/api/restaurant`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/restaurant/tables` | Admin, Manager, Waiter | Add dining table |
| `GET` | `/api/restaurant/tables` | Authenticated | List dining tables & status |
| `PATCH` | `/api/restaurant/tables/:id/status` | Admin, Manager, Waiter | Update table status (`available`, `occupied`, `billed`) |
| `POST` | `/api/restaurant/tables/:id/release` | Admin, Manager, Waiter | Clear and release table |
| `DELETE` | `/api/restaurant/tables/:id` | Admin, Manager | Delete dining table |
| `POST` | `/api/restaurant/kot` | Admin, Manager, Waiter | Create Kitchen Order Ticket (KOT) |
| `GET` | `/api/restaurant/kot` | Authenticated | List active KOTs |
| `PATCH` | `/api/restaurant/kot/:id/status` | Admin, Manager, Waiter, Kitchen | Update KOT status (`pending`, `preparing`, `ready`, `served`) |
| `POST` | `/api/restaurant/kitchen-staff` | Admin, Manager | Provision kitchen staff credentials |
| `GET` | `/api/restaurant/kitchen-staff` | Admin, Manager | List kitchen staff accounts |
| `GET` | `/api/restaurant/kitchen-staff/:id/login` | Admin, Manager | Retrieve kitchen staff credentials |
| `PATCH` | `/api/restaurant/kitchen-staff/:id` | Admin, Manager | Update kitchen staff account |

### 12. Staff & Attendance (`/api/staff`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/staff` | Admin, Manager | Create staff member account |
| `GET` | `/api/staff` | Admin, Manager | List staff members |
| `GET` | `/api/staff/:id/credentials` | Admin | View staff plaintext login credentials |
| `PATCH` | `/api/staff/:id` | Admin, Manager | Update staff details |
| `DELETE` | `/api/staff/:id` | Admin, Manager | Remove staff member |
| `POST` | `/api/staff/attendance/clock-in` | Admin, Manager | Clock-in staff attendance |
| `POST` | `/api/staff/attendance/clock-out` | Admin, Manager | Clock-out staff attendance |
| `GET` | `/api/staff/attendance/roster` | Admin, Manager | Get daily staff roster |
| `POST` | `/api/staff/attendance/manual` | Admin, Manager | Manual attendance entry |
| `GET` | `/api/staff/commissions/list` | Admin, Manager | List staff sales commissions |
| `GET` | `/api/staff/commissions/summary` | Admin, Manager | Summary of pending & paid commissions |
| `POST` | `/api/staff/commissions/payout` | Admin, Manager | Process commission payout |

### 13. Salesman & Field Visits (`/api/salesman`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/salesman` | Admin, Manager | Create salesman profile |
| `GET` | `/api/salesman` | Authenticated | List salesmen |
| `GET` | `/api/salesman/:id` | Authenticated | Get salesman profile |
| `POST` | `/api/salesman/:id/create-login` | Admin, Manager | Provision salesman login account |
| `GET` | `/api/salesman/:id/login` | Admin, Manager | View salesman login credentials |
| `PATCH` | `/api/salesman/:id/login` | Admin, Manager | Update salesman login account |
| `DELETE` | `/api/salesman/:id` | Admin, Manager | Delete salesman |
| `POST` | `/api/salesman/visits/check-in` | Admin, Manager, Salesman | Record GPS check-in at customer location |
| `POST` | `/api/salesman/visits/:id/check-out` | Authenticated | Record check-out from customer location |
| `GET` | `/api/salesman/:id/visits` | Authenticated | List field visits by salesman |
| `GET` | `/api/salesman/visits/by-customer/:customerId` | Authenticated | List field visits for specific customer |

### 14. Reports & Analytics (`/api/reports`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/dashboard` | Authenticated | Home dashboard aggregate KPIs |
| `GET` | `/api/reports/sales` | Admin, Manager, Accountant | Sales revenue report |
| `GET` | `/api/reports/outstanding` | Admin, Manager, Accountant | Customer & supplier outstanding balances report |
| `GET` | `/api/reports/profit` | Admin, Manager, Accountant | Net profit & margin report |
| `GET` | `/api/reports/tax` | Admin, Manager, Accountant | Tax report |
| `GET` | `/api/reports/gst-summary` | Admin, Manager, Accountant | GST summary (GSTR-1 / GSTR-3B) |
| `GET` | `/api/reports/schedule-h1-register` | Admin, Manager, Accountant | Pharmacy Schedule H1 drug register |
| `GET` | `/api/reports/analytics` | Admin, Manager, Accountant | Business growth trend analytics |

### 15. Notifications (`/api/notifications`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/notifications` | Authenticated | List notifications (`unreadOnly=true`) |
| `PATCH` | `/api/notifications/:id/read` | Authenticated | Mark notification read |
| `POST` | `/api/notifications/device-token` | Authenticated | Register FCM push notification token |
| `DELETE` | `/api/notifications/device-token` | Authenticated | Unregister FCM token |
| `POST` | `/api/notifications/test-push` | Authenticated | Trigger test push notification |

### 16. Subscriptions & Referrals (`/api/subscriptions`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/subscriptions/plans` | Public | List available subscription plans |
| `GET` | `/api/subscriptions/current` | Authenticated | Get current store subscription status |
| `POST` | `/api/subscriptions/simulate-upgrade` | Authenticated | Simulate plan upgrade / renewal |
| `GET` | `/api/subscriptions/referral-info` | Authenticated | Get store referral code & stats |
| `POST` | `/api/subscriptions/apply-referral` | Authenticated | Apply referral promo code |

### 17. Business Connections (B2B Sync) (`/api/business-connections`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/business-connections/request` | Authenticated | Send B2B connection request to store |
| `GET` | `/api/business-connections` | Authenticated | List active & pending connections |
| `GET` | `/api/business-connections/check-phone` | Authenticated | Check if business exists by phone |
| `POST` | `/api/business-connections/:id/accept` | Authenticated | Accept B2B connection |
| `POST` | `/api/business-connections/:id/resync` | Authenticated | Resync catalog/inventory between stores |
| `POST` | `/api/business-connections/:id/reject` | Authenticated | Reject connection request |
| `DELETE` | `/api/business-connections/:id` | Authenticated | Terminate connection |

### 18. App Releases & Updates (`/api/app-apk-releases`, `/api/app-updates`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/app-apk-releases/latest` | Public | Query latest Android APK release metadata |
| `GET` | `/api/app-apk-releases/download` | Public | 302 Redirect to latest APK download URL |
| `GET` | `/api/app-apk-releases` | Admin, Super Admin | List APK releases |
| `POST` | `/api/app-apk-releases` | Super Admin | Upload new Android APK file |
| `PATCH` | `/api/app-apk-releases/:id` | Super Admin | Toggle release active state |
| `GET` | `/api/app-updates/latest` | Public | Query latest OTA bundle release metadata |
| `GET` | `/api/app-updates` | Admin, Super Admin | List OTA bundle updates |
| `POST` | `/api/app-updates` | Super Admin | Upload OTA web bundle zip file |
| `PATCH` | `/api/app-updates/:id` | Super Admin | Toggle OTA bundle active state |

### 19. Platform Administration (`/api/platform-admin`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/platform-admin/overview` | Super Admin | Global platform stats |
| `GET` | `/api/platform-admin/users` | Super Admin | List all registered users |
| `PATCH` | `/api/platform-admin/users/:id` | Super Admin | Update user details & global role |
| `GET` | `/api/platform-admin/stores` | Super Admin | List all registered stores |
| `PATCH` | `/api/platform-admin/stores/:id` | Super Admin | Update store settings |
| `POST` | `/api/platform-admin/broadcast-push` | Super Admin | Send platform-wide push message |
| `POST` | `/api/platform-admin/impersonate/:businessId` | Super Admin | Impersonate store account |
| `GET` | `/api/platform-admin/health` | Super Admin | System health status |
| `GET` | `/api/platform-admin/announcement` | Public (Authenticated) | Get active system broadcast banner |
| `POST` | `/api/platform-admin/announcement` | Super Admin | Set system broadcast banner |
| `GET` | `/api/platform-admin/maintenance` | Public | Check system maintenance status |
| `POST` | `/api/platform-admin/maintenance` | Super Admin | Toggle maintenance mode |

### 20. Developer Tools (`/api/dev`)
| Method | Endpoint | Access Level | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/dev/seed` | Admin, Super Admin | Seed demo business data |
| `DELETE` | `/api/dev/clear/:module` | Admin, Super Admin | Clear specific module data |
| `DELETE` | `/api/dev/clear-all` | Admin, Super Admin | Clear all business test data |

---

## 3. API Testing Guide (cURL & Postman)

### Step 1: User Signup (`POST /auth/signup`)
```bash
curl -X POST http://localhost:4000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Password123!",
    "full_name": "Test User"
  }'
```

### Step 2: User Login (`POST /auth/login`)
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "Password123!"
  }'
```

### Step 3: Seed Demo Data (`POST /api/dev/seed`)
```bash
curl -X POST "http://localhost:4000/api/dev/seed?businessId=<YOUR_BUSINESS_ID>" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

### Step 4: Add Product (`POST /api/products`)
```bash
curl -X POST http://localhost:4000/api/products \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "businessId": "<YOUR_BUSINESS_ID>",
    "name": "Sample Product A",
    "sellingPrice": 150,
    "costPrice": 100,
    "stock": 50,
    "unit": "pcs",
    "barcode": "8901234567890"
  }'
```

---

## 4. Complete VPS Deployment & Hosting Guide

### Server Requirements
- **OS:** Ubuntu 22.04 LTS or 24.04 LTS
- **RAM:** 2GB minimum (4GB recommended)
- **CPU:** 2 vCPU

### 1. Install Docker & Docker Compose
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw ca-certificates gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### 2. Configure Firewall (UFW)
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Deploy Code & Start Docker Containers
```bash
sudo mkdir -p /var/www
cd /var/www
git clone https://github.com/<YOUR_REPO>/orderflow.git
cd orderflow

# Create .env configuration
cat << 'EOF' > .env
NODE_ENV=production
POSTGRES_USER=orderflow_admin
POSTGRES_PASSWORD=YourSuperPassword123!
POSTGRES_DB=orderflow_prod
DATABASE_URL=postgres://orderflow_admin:YourSuperPassword123!@postgres:5432/orderflow_prod?sslmode=disable
JWT_SECRET=super_secret_jwt_key_32_chars_long_12345
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
EOF

# Build & launch stack
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Setup Nginx & Certbot SSL
```bash
sudo apt install -y nginx certbot python3-certbot-nginx

# Nginx config (/etc/nginx/sites-available/orderflow)
cat << 'EOF' | sudo tee /etc/nginx/sites-available/orderflow
server {
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 150M;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:3001/auth/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/orderflow /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Issue free SSL Certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
