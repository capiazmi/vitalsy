#!/bin/sh
set -e

echo "▶ Applying database migrations…"
pnpm exec prisma migrate deploy

echo "▶ Seeding admin user (idempotent)…"
pnpm exec tsx prisma/seed.ts || echo "⚠ Seed step skipped/failed (continuing)."

echo "▶ Starting BP Monitor on port ${PORT:-3000}…"
exec node .output/server/index.mjs
