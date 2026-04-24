# Clan Leagues Tracker

Full-stack clan tracker with an Express API backend and a Next.js frontend.

## Stack

**Server (backend + API)**
- Node.js / TypeScript
- Express
- PostgreSQL via Prisma
- Redis + BullMQ
- Jest

**App (frontend)**
- Next.js 14 (App Router)
- Tailwind CSS
- Headless UI / Radix UI

## Quick Start

> Requires [Node.js](https://nodejs.org) and [Docker Desktop](https://www.docker.com/products/docker-desktop/).

1. Install backend dependencies:
   ```bash
   npm install
   ```
2. Install frontend dependencies:
   ```bash
   npm --prefix frontend install
   ```
3. Copy the example env file and fill in your values:
   ```bash
   cp .env.example .env
   ```
4. Start Postgres + Redis via Docker:
   ```bash
   npm run docker:up
   ```
5. Run database migrations:
   ```bash
   npm run prisma:migrate
   ```
6. Start backend + frontend together:
   ```bash
   npm run dev
   ```

## Development URLs

| Service      | URL                    |
|--------------|------------------------|
| Backend API  | http://localhost:3000  |
| Frontend app | http://localhost:3001  |

## Environment Variables

Create a `.env` file in the project root (never commit this file):

```env
PORT=3000
FRONTEND_URL=http://localhost:3001
WOM_BASE_URL=https://api.wiseoldman.net/v2
WOM_API_KEY=your_wom_api_key_here
WOM_USER_AGENT=your_user_agent_here
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clan_leagues_tracker?schema=public
REDIS_URL=redis://127.0.0.1:6379
QUEUE_NAME=clan-sync-queue
```

Create a `frontend/.env.local` file:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

> `WOM_API_KEY` is optional but recommended to avoid rate limiting from the Wise Old Man API.

## Commands

| Command                    | Description                        |
|----------------------------|------------------------------------|
| `npm run dev`              | Start backend + frontend together  |
| `npm run dev:api`          | Backend only (tsx watch)           |
| `npm run dev:web`          | Frontend only                      |
| `npm run worker`           | Start BullMQ worker                |
| `npm run build`            | Build backend                      |
| `npm run build:web`        | Build frontend                     |
| `npm run build:all`        | Build both                         |
| `npm test`                 | Run Jest tests                     |
| `npm run docker:up`        | Start Docker services              |
| `npm run docker:down`      | Stop Docker services               |
| `npm run docker:logs`      | Tail Docker logs                   |
| `npm run prisma:generate`  | Regenerate Prisma client           |
| `npm run prisma:migrate`   | Run pending migrations             |

## API Endpoints

| Method | Path                          | Description                     |
|--------|-------------------------------|---------------------------------|
| GET    | `/health`                     | Basic health check              |
| GET    | `/health/deps`                | Health check with dependencies  |
| GET    | `/players/search?username=`   | Search player by username       |
| GET    | `/groups/members?name=`       | List group members by name      |
| POST   | `/ingest`                     | Enqueue a clan sync job         |

## Vercel Deployment

Deploy as two separate Vercel projects from the same repo.

### Prerequisites

| Service    | Recommended provider                          |
|------------|-----------------------------------------------|
| PostgreSQL | [Vercel Postgres (Neon)](https://vercel.com/docs/storage/vercel-postgres) or [Supabase](https://supabase.com) |
| Redis      | [Upstash Redis](https://upstash.com) (serverless-compatible) |

> The BullMQ worker (`src/worker.ts`) requires a long-running process and cannot run on Vercel. Leave the worker off Vercel or use a separate service (e.g. a free Render worker).

### Project 1 — Frontend

1. Create a new Vercel project, connect your repo.
2. Set **Root Directory** to `frontend/`.
3. Vercel auto-detects **Next.js** — no preset change needed.
4. Add environment variable:

   | Variable                   | Value                          |
   |----------------------------|--------------------------------|
   | `NEXT_PUBLIC_API_BASE_URL` | Your backend Vercel URL (see below) |

### Project 2 — Backend API

1. Create a second Vercel project from the same repo.
2. Leave **Root Directory** as `/` (root).
3. Set **Framework Preset** to **Other**.
4. The `vercel.json` at the root routes all requests to `api/index.ts` (the Express serverless entry point).
5. Add environment variables:

   | Variable          | Value                                        |
   |-------------------|----------------------------------------------|
   | `FRONTEND_URL`    | Your frontend Vercel URL                     |
   | `CORS_ORIGIN`     | Your frontend Vercel URL                     |
   | `WOM_BASE_URL`    | `https://api.wiseoldman.net/v2`              |
   | `WOM_API_KEY`     | Your WOM API key                             |
   | `WOM_USER_AGENT`  | Your user agent string                       |
   | `DATABASE_URL`    | Connection string from your Postgres provider (append `?pgbouncer=true&connect_timeout=10` for Vercel Postgres) |
   | `REDIS_URL`       | `rediss://:password@host:6379` from Upstash  |
   | `QUEUE_NAME`      | `clan-sync-queue`                            |

6. After first deploy, run migrations from your local machine pointing at the cloud DB:
   ```bash
   DATABASE_URL="your_cloud_db_url" npm run prisma:migrate
   ```

## Notes

- Global API rate limit: 20 requests per 60 seconds.
- `POST /ingest` enqueues a BullMQ job when Redis is available.
- If `docker compose up -d` fails with "Docker Desktop is unable to start", open Docker Desktop manually, wait for **Engine running**, then retry `npm run docker:up`.

