# Orderflow - DevOps & Deployment Handover Guide
> **Note for the System Administrator / Deployer:**  
> This document contains all technical instructions, environment variables, Nginx configurations, and operational steps required to deploy **Orderflow** on a VPS or cloud server.

---

## 🎯 Architecture Summary

| Component | Technology | Default Port | Internal Docker URL |
| :--- | :--- | :--- | :--- |
| **Frontend Web App** | Next.js (Node 22) | `3000` | `http://127.0.0.1:3000` |
| **Backend API** | NestJS (Node 22) | `3001` | `http://127.0.0.1:3001` |
| **Database** | PostgreSQL 16 Alpine | `5432` | `postgres:5432` |
| **Object Storage** | S3 Compatible (Neon / AWS) | `443` | External S3 Endpoint |

---

## 📋 Deployment Execution Checklist

### Phase 1: Server Requirements & Security
- [ ] VPS running **Ubuntu 22.04 LTS or 24.04 LTS**
- [ ] **2 CPU Cores & 4GB RAM** (Minimum 2GB RAM + 2GB Swap space enabled for Puppeteer PDF rendering)
- [ ] Docker & Docker Compose V2 installed
- [ ] UFW Firewall enabled with ports **22 (SSH), 80 (HTTP), 443 (HTTPS)** open
- [ ] Domain DNS `A` records pointing `@` and `www` to VPS IP address

### Phase 2: Codebase & Environment Variables Setup
1. Clone the repository into `/var/www/orderflow`:
   ```bash
   sudo mkdir -p /var/www
   cd /var/www
   git clone <REPOSITORY_URL> orderflow
   cd orderflow
   ```

2. Create the production environment configuration file `.env`:
   ```bash
   cp .env.example .env 2>/dev/null || nano .env
   ```

3. Fill in the following mandatory production values in `.env`:
   ```env
   NODE_ENV=production
   PORT=3001
   
   # Database Credentials
   POSTGRES_USER=orderflow_admin
   POSTGRES_PASSWORD=SetAStrongPasswordHere!123
   POSTGRES_DB=orderflow_prod
   DATABASE_URL=postgres://orderflow_admin:SetAStrongPasswordHere!123@postgres:5432/orderflow_prod?sslmode=disable

   # Security & Auth Secrets
   JWT_SECRET=SetRandom32CharacterLongSecretKeyString!

   # Domain URLs
   FRONTEND_URL=https://yourdomain.com
   NEXT_PUBLIC_API_URL=https://yourdomain.com/api
   ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://localhost,http://localhost,capacitor://localhost

   # S3 Storage Credentials (for logos, receipts, QR codes, prescriptions)
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   AWS_ENDPOINT_URL_S3=https://your-s3-endpoint.storage.com
   AWS_REGION=us-east-2
   ```

---

### Phase 3: Launch Containers & Database Migration

1. Build and start the stack:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

2. Verify all 3 containers are running:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

3. Run database migrations:
   ```bash
   docker exec -it orderflow-api-prod npm --prefix packages/api run db:migrate
   ```

---

### Phase 4: Apache2 Reverse Proxy Setup

1. Install Apache2 and enable required reverse proxy, SSL, and header modules:
   ```bash
   sudo apt update && sudo apt install -y apache2
   sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite
   ```

2. Create site config `/etc/apache2/sites-available/orderflow.conf`:
   ```apache
   <VirtualHost *:80>
       ServerName yourdomain.com
       ServerAlias www.yourdomain.com

       # 150MB upload limit (for APKs, images, PDF scans)
       LimitRequestBody 157286400

       # Security Headers
       Header always set X-Content-Type-Options "nosniff"
       Header always set X-Frame-Options "DENY"
       Header always set Referrer-Policy "no-referrer-when-downgrade"

       # Enable Proxy engine and preserve original host header
       ProxyRequests Off
       ProxyPreserveHost On

       # NestJS API Proxy (/api/ and /auth/) -> Container Port 3001
       ProxyPass /api/ http://127.0.0.1:3001/api/
       ProxyPassReverse /api/ http://127.0.0.1:3001/api/

       ProxyPass /auth/ http://127.0.0.1:3001/auth/
       ProxyPassReverse /auth/ http://127.0.0.1:3001/auth/

       # Next.js Frontend Proxy (Root /) -> Container Port 3000
       ProxyPass / http://127.0.0.1:3000/
       ProxyPassReverse / http://127.0.0.1:3000/
   </VirtualHost>
   ```

3. Enable Apache configuration & restart service:
   ```bash
   sudo a2ensite orderflow.conf
   sudo a2dissite 000-default.conf
   sudo apache2ctl configtest
   sudo systemctl restart apache2
   ```

---

### Phase 5: SSL Certificate & Final Verification

1. Issue Let's Encrypt SSL (Certbot Apache Plugin):
   ```bash
   sudo apt install -y certbot python3-certbot-apache
   sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
   ```

2. Test Deployment Endpoints:
   - **Frontend App:** Visit `https://yourdomain.com` in browser
   - **Backend API Health:** `curl https://yourdomain.com/api/platform-admin/health`
   - **Authentication:** Test user signup/login on landing page

---

## 🛠️ Operational Commands for System Administrator

### View Logs
```bash
# Backend NestJS Logs
docker logs -f orderflow-api-prod

# Frontend Next.js Logs
docker logs -f orderflow-web-prod

# Database Logs
docker logs -f orderflow-postgres-prod
```

### Update Application (New Release Deployment)
```bash
cd /var/www/orderflow
./deploy.sh
```

### Backup Database
```bash
docker exec orderflow-postgres-prod pg_dump -U orderflow_admin orderflow_prod | gzip > backup_$(date +%Y%m%d).sql.gz
```
