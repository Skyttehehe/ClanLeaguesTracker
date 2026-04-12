#!/bin/sh
echo "[startup] Container started"
echo "[startup] PORT=${PORT}"
echo "[startup] NODE_ENV=${NODE_ENV}"
echo "[startup] DATABASE_URL set: $([ -n \"$DATABASE_URL\" ] && echo yes || echo NO)"
echo "[startup] REDIS_URL set: $([ -n \"$REDIS_URL\" ] && echo yes || echo NO)"

echo "[startup] Running prisma migrate deploy..."
npx prisma migrate deploy
MIGRATE_EXIT=$?
echo "[startup] prisma migrate deploy exited with code ${MIGRATE_EXIT}"

echo "[startup] Starting node dist/server.js..."
exec node dist/server.js
