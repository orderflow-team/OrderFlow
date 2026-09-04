# Complete Production VPS Hosting & Infrastructure Guide for Orderflow

This is the comprehensive, end-to-end deployment guide for hosting **Orderflow** (NestJS API + Next.js Web App + PostgreSQL Database + Object Storage) on any Linux Virtual Private Server (VPS) such as **DigitalOcean, Hetzner, AWS EC2, Linode, Vultr, or Hostinger**.

---

## 📋 Table of Contents
1. [Server Hardware & Provider Requirements](#1-server-hardware--provider-requirements)
2. [Domain & DNS Configuration](#2-domain--dns-configuration)
3. [Initial Server Setup & Security Hardening](#3-initial-server-setup--security-hardening)
4. [Docker & Docker Compose Runtime Installation](#4-docker--docker-compose-runtime-installation)
5. [Codebase Checkout & Environment Configuration](#5-codebase-checkout--environment-configuration)
6. [Launching Multi-Container Production Stack](#6-launching-multi-container-production-stack)
7. [Nginx Reverse Proxy Configuration](#7-nginx-reverse-proxy-configuration)
8. [Free SSL Certificate Setup (Let's Encrypt / Certbot)](#8-free-ssl-certificate-setup-lets-encrypt--certbot)
9. [Automated PostgreSQL Backups & Disaster Recovery](#9-automated-postgresql-backups--disaster-recovery)
10. [Zero-Downtime Deployment & Maintenance Script](#10-zero-downtime-deployment--maintenance-script)
11. [Troubleshooting & Useful Commands](#11-troubleshooting--useful-commands)

---

## 1. Server Hardware & Provider Requirements

### Recommended VPS Specifications

| Environment Tier | vCPU | RAM | NVMe / SSD | Recommended OS |
| :--- | :--- | :--- | :--- | :--- |
| **Minimum Starter** | 1 vCPU | 2 GB | 25 GB | Ubuntu 22.04 LTS |
| **Standard Production** | 2 vCPU | 4 GB | 50 GB | Ubuntu 24.04 LTS |
| **High Traffic Enterprise** | 4 vCPU | 8 GB | 100 GB | Ubuntu 24.04 LTS |

> ⚠️ **Note:** NestJS PDF generation uses Puppeteer (headless Chromium), which requires at least **2GB RAM** (or a 2GB swap file enabled) during peak PDF render requests.

---

## 2. Domain & DNS Configuration

Before configuring Nginx, point your domain DNS records to your VPS IP address in your domain registrar (Cloudflare, Namecheap, GoDaddy, etc.):

| Type | Name / Host | Target / Value | TTL |
| :--- | :--- | :--- | :--- |
| `A` | `@` | `<YOUR_VPS_PUBLIC_IP>` | Auto / 300s |
| `A` | `www` | `<YOUR_VPS_PUBLIC_IP>` | Auto / 300s |
| `A` | `api` (optional) | `<YOUR_VPS_PUBLIC_IP>` | Auto / 300s |

---

## 3. Initial Server Setup & Security Hardening

Log into your fresh VPS as root:
```bash
ssh root@<YOUR_VPS_PUBLIC_IP>
```

### 1. Update Package Repositories
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw htop fail2ban ca-certificates gnupg software-properties-common
```

### 2. Configure Swap Space (Crucial for 2GB VPS)
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 3. Configure UFW Firewall
Restrict all inbound traffic except SSH (22), HTTP (80), and HTTPS (443):
```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 4. Docker & Docker Compose Runtime Installation

Install the official Docker Engine and Docker Compose V2 plugin:

```bash
# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Set up official Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### Configure Docker Log Rotation
Prevent container logs from filling up server disk space:
```bash
sudo nano /etc/docker/daemon.json
```
Paste:
```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```
Restart Docker service:
```bash
sudo systemctl restart docker
```

---

## 5. Codebase Checkout & Environment Configuration

### 1. Checkout repository to `/var/www/orderflow`
```bash
sudo mkdir -p /var/www
cd /var/www
git clone https://github.com/<YOUR_GITHUB_ORGANIZATION>/orderflow.git
cd orderflow
```

### 2. Create Production Environment File (`.env`)
```bash
nano .env
```

Paste the following variables (update passwords, domain names, and keys):

```env
# Node Environment
NODE_ENV=production

# Database Credentials
POSTGRES_USER=orderflow_admin
POSTGRES_PASSWORD=SuperSecurePassword123!_ChangeMe
POSTGRES_DB=orderflow_prod

# Internal Docker Database Connection URL
DATABASE_URL=postgres://orderflow_admin:SuperSecurePassword123!_ChangeMe@postgres:5432/orderflow_prod?sslmode=disable

# JWT Secret (Generate random 32+ character string)
JWT_SECRET=e7f9a8b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9

# Public Domain URLs
FRONTEND_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://yourdomain.com/api
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com,https://localhost,http://localhost,capacitor://localhost

# Neon S3 / AWS S3 Object Storage Credentials (for logos, receipts, QR codes)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_ENDPOINT_URL_S3=https://your-s3-endpoint.storage.com
AWS_REGION=us-east-2
```

---

## 6. Launching Multi-Container Production Stack

The repository includes `docker-compose.prod.yml` which defines 3 production containers:
1. `orderflow-postgres-prod`: PostgreSQL 16 Alpine
2. `orderflow-api-prod`: NestJS Backend API (Port 3001)
3. `orderflow-web-prod`: Next.js Web Frontend (Port 3000)

### 1. Build and Start Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Verify Container Status
```bash
docker compose -f docker-compose.prod.yml ps
```
You should see `healthy` status for database and `running` for API and Web.

### 3. Run Database Migrations
```bash
docker exec -it orderflow-api-prod npm --prefix packages/api run db:migrate
```

---

## 7. Web Server Reverse Proxy Configuration

You can use **Apache2** (or Nginx) to route incoming HTTP/HTTPS traffic to the internal Docker containers.

### Option A: Apache2 Reverse Proxy (Recommended)

1. Install Apache2 and enable required proxy, header, and SSL modules:
```bash
sudo apt update && sudo apt install -y apache2
sudo a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite
```

2. Create site configuration file:
```bash
sudo nano /etc/apache2/sites-available/orderflow.conf
```

3. Paste the following VirtualHost configuration (replace `yourdomain.com` with your domain):
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com

    # 150MB maximum request size limit for APKs, images, PDF scans
    LimitRequestBody 157286400

    # Security Headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set Referrer-Policy "no-referrer-when-downgrade"

    # Enable Proxy engine and preserve host header
    ProxyRequests Off
    ProxyPreserveHost On

    # 1. NestJS Backend API Proxy (/api/ and /auth/) -> Container Port 3001
    ProxyPass /api/ http://127.0.0.1:3001/api/
    ProxyPassReverse /api/ http://127.0.0.1:3001/api/

    ProxyPass /auth/ http://127.0.0.1:3001/auth/
    ProxyPassReverse /auth/ http://127.0.0.1:3001/auth/

    # 2. Next.js Web Frontend Proxy (Root /) -> Container Port 3000
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

4. Enable site & restart Apache2:
```bash
sudo a2ensite orderflow.conf
sudo a2dissite 000-default.conf
sudo apache2ctl configtest
sudo systemctl restart apache2
```

---

### Option B: Nginx Reverse Proxy (Alternative)

```bash
sudo apt install -y nginx
sudo nano /etc/nginx/sites-available/orderflow
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    client_max_body_size 150M;

    location /api/ {
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:3001/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/orderflow /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. Free SSL Certificate Setup (Let's Encrypt / Certbot)

### For Apache2:
```bash
sudo apt install -y certbot python3-certbot-apache
sudo certbot --apache -d yourdomain.com -d www.yourdomain.com
```

### For Nginx:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Select automatic HTTP -> HTTPS redirection when prompted.

### Verify SSL Auto-Renewal
Certbot automatically installs a systemd timer for renewal. Verify with:
```bash
sudo certbot renew --dry-run
```

---

## 9. Automated PostgreSQL Backups & Disaster Recovery

### 1. Create Automated Backup Script
```bash
sudo mkdir -p /var/backups/orderflow
sudo nano /usr/local/bin/backup-orderflow-db.sh
```

Paste script:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/orderflow"
DATE=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/orderflow_db_$DATE.sql.gz"

mkdir -p $BACKUP_DIR

# Dump database from postgres container
docker exec orderflow-postgres-prod pg_dump -U orderflow_admin orderflow_prod | gzip > $FILE

# Keep only backups created in the last 14 days
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +14 -delete

echo "Database backup completed: $FILE"
```

### 2. Make Script Executable & Add Cron Job
```bash
sudo chmod +x /usr/local/bin/backup-orderflow-db.sh

# Run script every night at 2:00 AM
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/backup-orderflow-db.sh >> /var/log/orderflow-backup.log 2>&1") | crontab -
```

### 3. How to Restore Database from Backup
```bash
gunzip -c /var/backups/orderflow/orderflow_db_YYYYMMDD_HHMMSS.sql.gz | docker exec -i orderflow-postgres-prod psql -U orderflow_admin -d orderflow_prod
```

---

## 10. Zero-Downtime Deployment & Maintenance Script

Create a single-command deployment script to pull code, rebuild Docker images, and apply updates:

```bash
nano /var/www/orderflow/deploy.sh
```

Paste script:
```bash
#!/bin/bash
set -e

echo "🚀 Step 1: Pulling latest changes from Git..."
cd /var/www/orderflow
git pull origin main

echo "📦 Step 2: Rebuilding & restarting Docker containers..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "🗄️ Step 3: Running database migrations..."
docker exec orderflow-api-prod npm --prefix packages/api run db:migrate || true

echo "🧹 Step 4: Cleaning up dangling Docker build images..."
docker image prune -f

echo "✅ Orderflow successfully deployed & active!"
```

Make script executable:
```bash
chmod +x /var/www/orderflow/deploy.sh
```

Run deployment anytime:
```bash
/var/www/orderflow/deploy.sh
```

---

## 11. Troubleshooting & Useful Commands

### 🔍 View Application Logs
```bash
# View all containers live logs
docker compose -f docker-compose.prod.yml logs -f

# View NestJS Backend API logs only
docker logs -f orderflow-api-prod

# View Next.js Frontend logs only
docker logs -f orderflow-web-prod

# View Nginx access & error logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 📊 Server Resource Monitoring
```bash
# Check CPU & RAM consumption by container
docker stats

# System overall resources
htop
df -h
```

### 🔄 Restart Specific Service
```bash
# Restart Backend API
docker compose -f docker-compose.prod.yml restart api

# Restart Nginx
sudo systemctl restart nginx
```
