#!/bin/sh
echo "[startup] Container started"
echo "[startup] PORT=${PORT}"
echo "[startup] NODE_ENV=${NODE_ENV}"
echo "[startup] DATABASE_URL set: $([ -n "$DATABASE_URL" ] && echo yes || echo NO)"
echo "[startup] REDIS_URL set: $([ -n "$REDIS_URL" ] && echo yes || echo NO)"

# Strip sslmode from DATABASE_URL for Railway internal connections
# (railway.internal private network does not need SSL)
if echo "$DATABASE_URL" | grep -q "railway.internal"; then
  echo "[startup] Detected internal Railway postgres — disabling SSL"
  DATABASE_URL=$(echo "$DATABASE_URL" | sed 's/?sslmode=[^&]*//; s/&sslmode=[^&]*//; s/?$//')
  DATABASE_URL="${DATABASE_URL}?sslmode=disable"
  export DATABASE_URL
fi

# Print host only (not credentials) for diagnostics
DB_HOST=$(echo "$DATABASE_URL" | sed 's|.*@\([^/]*\)/.*|\1|')
echo "[startup] DB host: ${DB_HOST}"

echo "[startup] Running prisma migrate deploy..."
npx prisma migrate deploy
MIGRATE_EXIT=$?
echo "[startup] prisma migrate deploy exited with code ${MIGRATE_EXIT}"

echo "[startup] Starting node dist/server.js..."
exec node dist/server.js
