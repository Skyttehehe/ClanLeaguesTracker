#!/bin/sh
set -e

echo "[startup] Container started"
echo "[startup] PORT=${PORT}"
echo "[startup] NODE_ENV=${NODE_ENV}"
echo "[startup] DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "[startup] REDIS_URL set: $([ -n "$REDIS_URL" ] && echo yes || echo NO)"

# Verify compiled server exists
if [ ! -f "/app/dist/server.js" ]; then
  echo "[startup] FATAL: /app/dist/server.js not found — TypeScript build may have failed"
  exit 1
fi
echo "[startup] dist/server.js found OK"

# Verify prisma client exists
if [ ! -d "/app/node_modules/.prisma/client" ]; then
  echo "[startup] WARNING: .prisma/client not found — running prisma generate now"
  npx prisma generate
fi

# Strip sslmode from DATABASE_URL for Railway internal connections
if echo "$DATABASE_URL" | grep -q "railway.internal"; then
  echo "[startup] Detected internal Railway postgres — disabling SSL"
  DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/?sslmode=[^&]*//; s/&sslmode=[^&]*//; s/?$//')
  DATABASE_URL="${DATABASE_URL}?sslmode=disable"
  export DATABASE_URL
fi

DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@\([^/]*\)/.*|\1|')
echo "[startup] DB host: ${DB_HOST}"

echo "[startup] Running prisma migrate deploy..."
set +e
npx prisma migrate deploy
MIGRATE_EXIT=$?
set -e
echo "[startup] prisma migrate deploy exited with code ${MIGRATE_EXIT}"

echo "[startup] Starting node dist/server.js..."
exec node dist/server.js
