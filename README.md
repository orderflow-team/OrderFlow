# OrderFlow - Multi-Industry Order Management SaaS

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start Docker
docker-compose up -d

# 3. Terminal 1: Start backend
cd packages/api
npm run start:dev

# 4. Terminal 2: Start frontend
cd apps/web
npm run dev

# 5. Open browser
# http://localhost:3000/login
```

## Tech Stack
- Frontend: Next.js 14 + TypeScript + Tailwind + Shadcn/UI
- Backend: NestJS + Node.js
- Database: PostgreSQL 15
- Cache: Redis 7
- AI: Google Gemini API

## Project Structure

## Week 1 Complete ✅
- Auth module with JWT
- NLP parser (Hinglish voice orders)
- Login page
- Dashboard skeleton
- All tests passing
