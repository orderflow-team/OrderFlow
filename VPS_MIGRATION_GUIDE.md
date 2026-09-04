# 🚀 Unified VPS Migration Guide (Replacing Vercel & Render using Apache2)

You can migrate **BOTH Vercel (Next.js Web Dashboard) AND Render (NestJS API + Postgres DB)** onto a single **$6 – $10/mo VPS running Apache2**!

---

## 🏗️ Unified Architecture Overview

```
                          ┌─────────────────────────────────────────┐
                          │               YOUR VPS                  │
                          │        (e.g., 2 GB – 4 GB RAM)          │
                          │                                         │
 ┌──────────────────┐     │  ┌───────────────────────────────────┐  │
 │  Browser / Mobile│ ──> │  │        Apache2 (SSL Certbot)      │  │
 └──────────────────┘     │  └─────────────────┬─────────────────┘  │
                          │                    │                    │
                          │         ┌──────────┴──────────┐         │
                          │         ▼                     ▼         │
                          │   ┌────────────┐        ┌────────────┐  │
                          │   │  Next.js   │        │ NestJS API │  │
                          │   │  Web App   │        │  Backend   │  │
                          │   │ (Port 3000)│        │ (Port 3001)│  │
                          │   └────────────┘        └─────┬──────┘  │
                          │    Replaces Vercel            │         │
                          │                         ┌─────▼──────┐  │
                          │                         │ Postgres 16│  │
                          │                         │ Database   │  │
                          │                         └────────────┘  │
                          │                        Replaces Render  │
                          └─────────────────────────────────────────┘
```

---

## 💰 Cost & Performance Comparison

| Metric | Vercel + Render Cloud | Single VPS + Apache2 (DigitalOcean / Hetzner / Hostinger) |
| :--- | :--- | :--- |
| **Monthly Cost** | $20 – $50/mo | **$6 – $10/mo Total** |
| **Cold Starts** | 5-15 sec delays on idle | **⚡ 0 Cold Starts (Runs 24/7 at 100% speed)** |
| **Database Limits** | Neon row/connection caps | **Unlimited database storage & connections** |
| **SSL & Custom Domain** | Multiple dashboard setups | **1-Click automated Certbot Apache SSL** |

---

## ⚡ Step-by-Step Deployment Instructions

### 1. SSH into your VPS
```bash
ssh root@YOUR_SERVER_IP
```

### 2. Install Docker & Apache2
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Apache2 and Certbot Apache module
apt-get update
apt-get install -y git apache2 certbot python3-certbot-apache

# Enable Apache reverse proxy and header modules
a2enmod proxy proxy_http proxy_wstunnel headers ssl rewrite
```

### 3. Clone Repository & Start Multi-Container Stack
```bash
cd /opt
git clone https://github.com/orderflow-team/OrderFlow.git orderflow
cd orderflow

# Start Production Containers (PostgreSQL, NestJS API, Next.js Web)
docker compose -f docker-compose.prod.yml up -d --build
```

### 4. Configure Apache2 VirtualHost Reverse Proxy
Create configuration `/etc/apache2/sites-available/orderflow.conf`:

```bash
cat << 'EOF' > /etc/apache2/sites-available/orderflow.conf
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com

    # Request body limit for file/APK/scan uploads (150MB)
    LimitRequestBody 157286400

    # Security Headers
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set Referrer-Policy "no-referrer-when-downgrade"

    ProxyRequests Off
    ProxyPreserveHost On

    # 1. NestJS API Backend (Replaces Render) -> Port 3001
    ProxyPass /api/ http://127.0.0.1:3001/api/
    ProxyPassReverse /api/ http://127.0.0.1:3001/api/

    ProxyPass /auth/ http://127.0.0.1:3001/auth/
    ProxyPassReverse /auth/ http://127.0.0.1:3001/auth/

    # 2. Next.js Web App (Replaces Vercel) -> Port 3000
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
EOF
```

### 5. Enable Apache Site & Issue SSL Certificate
```bash
a2ensite orderflow.conf
a2dissite 000-default.conf
apache2ctl configtest
systemctl restart apache2

# Issue SSL Certificate with automatic HTTPS redirect
certbot --apache -d your-domain.com -d www.your-domain.com
```

---

🎉 **Both Vercel and Render are now fully replaced by a single, high-speed VPS running Apache2 for $6/mo!**
