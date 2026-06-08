import { defineConfig } from 'prisma/config'

// NOTE: we read DATABASE_URL from process.env with a placeholder fallback
// (instead of prisma's throwing `env()` helper) so `prisma generate` works at
// build time — it never connects to the DB. The real URL is used at runtime
// for `migrate deploy`, `db push`, studio, etc.
export default defineConfig({
  schema: './prisma/schema.prisma',
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://placeholder:placeholder@localhost:5432/placeholder',
  },
})
