#!/bin/sh
set -e

# Call the bundled binaries directly. Going through `pnpm exec` triggers
# pnpm's verify-deps-before-run check, which fires a synchronous `pnpm install`
# at boot — that reinstall runs without pnpm-workspace.yaml (not copied into the
# runner image) and dies on ERR_PNPM_IGNORED_BUILDS. node_modules is already
# baked into the image, so no install is needed here.
echo "▶ Applying database migrations…"
./node_modules/.bin/prisma migrate deploy

echo "▶ Seeding admin user (idempotent)…"
./node_modules/.bin/tsx prisma/seed.ts || echo "⚠ Seed step skipped/failed (continuing)."

echo "▶ Starting BP Monitor on port ${PORT:-3000}…"
exec node .output/server/index.mjs
