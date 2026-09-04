# 🛒 Orderflow - Multi-Tenant Business Management & POS SaaS Platform

Orderflow is a complete, enterprise-grade, multi-tenant SaaS platform built for **Retail, Wholesale, Restaurants, Pharmacies, and B2B Networks**. It provides Point of Sale (POS), real-time inventory management, automated billing, AI voice order parsing, AI purchase invoice scanning (OCR), staff attendance tracking, field salesman visit management, and B2B catalog synchronization.

---

## 🌟 Key Features & Industry Modules

### 🏢 Core POS & Inventory
- **Fast POS Counter:** Camera barcode scanning, quick-add variants, custom item pricing, and receipt generation.
- **Inventory & Batch Tracking:** Batch expiry alerts, low-stock warnings, manual stock adjustments, and supplier returns.
- **Thermal & A4 Invoicing:** Print narrow thermal receipts (58mm/80mm) or download standard A4 PDF invoices. WhatsApp share link integration.

### 🍽️ Restaurant & Dining Management
- **Table Management:** Visual dining table layout, status tracking (`available`, `occupied`, `billed`), and instant table release.
- **Kitchen Order Tickets (KOT):** Real-time KOT creation, kitchen display system (KDS), and status pipeline (`pending` ➔ `preparing` ➔ `ready` ➔ `served`).
- **Kitchen Staff Accounts:** Provision isolated kitchen login credentials.

### 💊 Pharmacy & Schedule H1 Register
- **Schedule H1 Drug Log:** Automated drug register compliance reports tracking patient info, doctor name, and prescription image uploads.
- **Prescription Uploads:** Secure S3 object storage for prescription photos with short-lived presigned URLs.

### 👔 Salesman & Field Visit Tracking
- **GPS Field Check-ins:** Geolocation-validated check-in and check-out at customer store locations.
- **Salesman Logins:** Provision login access for field agents to place orders on behalf of store owners on counter.

### 🤖 AI-Powered Automation (Google Gemini)
- **Voice Order Parser:** Parse Hinglish/multilingual voice transcripts directly into cart items.
- **WhatsApp Chat Order Parser:** Extract order items automatically from incoming WhatsApp chat messages.
- **Invoice OCR Scanner:** Scan multi-page PDF or image purchase invoices to auto-create products and Purchase Orders (PO).

### 🔗 B2B Store Network & Sync
- **Store-to-Store Connections:** Connect buyer and seller stores to automatically sync catalogs and purchase orders in real time.

---

## 🏗️ Architecture & Monorepo Structure

Orderflow is structured as a Turbo monorepo:

```
orderflow/
├── apps/
│   ├── web/               # Next.js 14 App Router client (React + Vanilla CSS tokens)
│   └── mailer/            # Transactional email service
├── packages/
│   ├── api/               # NestJS REST API Server (TypeORM + PostgreSQL)
│   ├── database/          # Shared TypeORM entities & migrations
│   ├── types/             # Shared TypeScript DTOs & interfaces
│   └── ui/                # Shared UI component library
├── Dockerfile             # Production Docker build for NestJS API (Puppeteer support)
├── docker-compose.yml     # Local Development Stack
├── docker-compose.prod.yml # Production Multi-Container Stack (API + Web + Postgres)
├── ORDERFLOW_DOCUMENTATION.md # Comprehensive System Documentation
├── VPS_HOSTING_GUIDE.md   # Production VPS Hosting Guide (Nginx / Apache2)
└── DEVOPS_HANDOVER.md     # Deployment Handover Checklist for System Administrators
```

---

## 🚀 Local Quick Start

### Prerequisites
- **Node.js:** v18.x or v22.x
- **npm:** v10.x+
- **Docker & Docker Compose** (optional for local DB)

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/orderflow.git
cd orderflow
npm install
```

### 2. Configure Environment Variables
Create `.env.local` in `packages/api/.env.local`:
```env
PORT=4000
DATABASE_URL="postgresql://user:password@localhost:5432/orderflow_dev"
JWT_SECRET="your_super_secret_jwt_key_here"
```

### 3. Start Database & Servers

#### Option A: Run Full Stack (Web + API) via Turbo
```bash
npm run dev
```

#### Option B: Run API Backend Locally
```bash
# Build API package
npm run build --workspace=api

# Start NestJS API in dev watch mode
npm run start:dev --workspace=api
```
The API server will run at: `http://localhost:4000`

#### Option C: Run Web Frontend
```bash
cd apps/web
npm run dev
```
The Web App will run at: `http://localhost:3000`

---

## 🧪 Seeding & Testing

### Seed Mock Test Data
Populate demo products, customers, orders, and staff accounts for testing:
```bash
curl -X POST "http://localhost:4000/api/dev/seed?businessId=<YOUR_BUSINESS_ID>" \
  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"
```

### Run Unit Tests
```bash
npm run test
```

---

## 🌐 Production VPS Deployment

Orderflow includes preconfigured deployment guides for production VPS hosting on Ubuntu (DigitalOcean, Hetzner, AWS EC2, Linode, Hostinger):

- 📖 **[VPS Hosting Guide (`VPS_HOSTING_GUIDE.md`)](file:///c:/Users/neel0/Projects/orderflow/VPS_HOSTING_GUIDE.md):** Complete step-by-step setup covering Docker Compose, Nginx/Apache2 reverse proxy, Certbot SSL, and backup cron jobs.
- 📋 **[DevOps Handover Checklist (`DEVOPS_HANDOVER.md`)](file:///c:/Users/neel0/Projects/orderflow/DEVOPS_HANDOVER.md):** Ready-to-share deployment package for system administrators.

### One-Command Docker Production Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 📖 Complete Documentation Files
- **[`ORDERFLOW_DOCUMENTATION.md`](file:///c:/Users/neel0/Projects/orderflow/ORDERFLOW_DOCUMENTATION.md):** Full 20-module REST API reference and testing toolkit.
- **[`VPS_HOSTING_GUIDE.md`](file:///c:/Users/neel0/Projects/orderflow/VPS_HOSTING_GUIDE.md):** Production VPS infrastructure and SSL deployment guide.
- **[`DEVOPS_HANDOVER.md`](file:///c:/Users/neel0/Projects/orderflow/DEVOPS_HANDOVER.md):** Apache2 / Nginx deployer handover checklist.

---

## 📄 License
This project is proprietary software. All rights reserved.
