# BP Monitor PWA

A clean, mobile-first **Progressive Web App** for recording blood-pressure readings,
viewing history and trends, and reading values from a photo of a BP monitor via OCR.

Built on the **full TanStack stack** with role-based auth, PostgreSQL, and Docker.

> ⚕️ Informational only — not a medical device and not medical advice.

---

## Tech stack

| Area        | Choice |
|-------------|--------|
| Framework   | TanStack **Start** (SSR) + **Router** + **Query** + **Form** + **Table** |
| Language    | TypeScript |
| UI          | Tailwind CSS v4 + **shadcn/ui** (new-york) + Recharts |
| Auth        | **better-auth** (email/password + admin plugin), cookie sessions |
| Database    | PostgreSQL + **Prisma** ORM (driver adapter) |
| Validation  | **Zod** |
| OCR         | tesseract.js (server-side, swappable) |
| Images      | External **S3**-compatible storage (optional) |
| Deploy      | Docker Compose on the external `dokploy-network` |

---

## Features

- **Auth & RBAC** — email/password login, `admin` / `user` roles, server-enforced on every route.
- **User management** (admin) — create, edit, enable/disable, delete users. Normal users can only ever see their own data.
- **BP records** — add/edit/delete readings (systolic, diastolic, pulse, notes, recordedAt). `recordedAt` defaults to now and is editable; `createdAt`/`updatedAt` are automatic.
- **OCR** — photograph the monitor, **crop to the digits**, and values are extracted server-side and shown for **confirmation/editing before saving**. Uses **Claude vision** when `ANTHROPIC_API_KEY` is set (accurate on 7-segment LCDs), with an offline Tesseract fallback. The original image is optionally stored in S3.
- **Notes quick-tags** — tap chips (left/right arm, after meal, after exercise, gastric, …) to annotate a reading; free text still works. Edit the list in [src/lib/note-tags.ts](src/lib/note-tags.ts).
- **Draft auto-save** — the add form and OCR scan auto-save to the browser (localStorage), so navigating away or refreshing restores your in-progress reading ("Draft restored" banner). Cleared on save or discard. The OCR image is uploaded to S3 **only on save** — abandoned scans never orphan an object.
- **Dashboard** — latest reading, averages, count, status indicator. Admins also get totals + recent readings across all users.
- **Graphs & history** — systolic/diastolic line chart (optional pulse), filter by 7/30/90 days or a custom range, sortable TanStack Table. Admins can filter by user.
- **PWA** — installable, responsive, app manifest, service worker with an offline shell.

---

## Project structure

```
prisma/
  schema.prisma          # better-auth tables + BloodPressureRecord, AuditLog
  migrations/            # initial migration (applied via `prisma migrate deploy`)
  seed.ts                # idempotent admin seed (from ADMIN_* env)
src/
  lib/                   # auth, roles, zod schemas, bp categories, s3, ocr, query options
  server/                # server functions (records, users, dashboard, ocr, session) + guards
  components/            # app shell, bp form/chart/table, user form, ui (shadcn)
  routes/                # file-based routes (see UI pages below)
public/                  # manifest.webmanifest, sw.js, offline.html, icons/
Dockerfile, docker-compose.yml, docker-entrypoint.sh
```

### Routes
`/login` · `/dashboard` · `/records` · `/records/new` · `/records/:id` · `/ocr`
`/admin/users` · `/admin/users/new` · `/admin/users/:id` · `/admin/readings`

Authenticated pages live under the `_authed` layout (redirects to `/login`).
Admin pages additionally require the `admin` role.

---

## Local development

**Prerequisites:** Node 20.19+/22.12+/24+, pnpm 9+, and a PostgreSQL database.

The included `docker-compose.yml` can run the full local stack: the app,
PostgreSQL, MinIO for S3-compatible OCR image storage, and optional Ollama.

```bash
# 1. Install
pnpm install

# 2. Configure env
cp .env.example .env
#    set AUTH_SECRET (pnpm dlx @better-auth/cli secret),
#    ADMIN_EMAIL, ADMIN_PASSWORD, and any optional OCR provider keys.

# 3. Run the full local Docker stack
docker compose up -d --build

# App:          http://localhost:3000
# MinIO S3 API: http://localhost:9000
# MinIO console http://localhost:9001
```

For faster host-based development with HMR, run only the third-party services
and start the app on your machine:

```bash
cp .env.example .env.local
docker compose up -d postgres minio minio-init

pnpm db:generate

# First time only
pnpm db:deploy           # applies existing migrations (no CREATEDB needed)
pnpm db:seed

pnpm dev                 # http://localhost:3000
```

To try local Ollama vision OCR, start the optional profile and set
`OCR_PROVIDER=ollama`:

```bash
docker compose --profile ollama up -d --build
```

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you configured. New users are
created from **Admin → Users** (public sign-up is disabled by design).

### Useful scripts
| Script | Purpose |
|--------|---------|
| `pnpm dev` | Dev server |
| `pnpm build` / `pnpm start` | Production build / run |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:deploy` | **Apply** existing migrations (no `CREATEDB` needed) — use this on shared/restricted DBs |
| `pnpm db:migrate` | **Author** a new dev migration — needs a shadow DB (`CREATEDB`); run against a local Postgres |
| `pnpm db:push` | Sync schema without migration history |
| `pnpm db:seed` | Seed/ensure the admin user |
| `pnpm db:studio` | Prisma Studio |

---

## Environment variables

| Variable | Required | Notes |
|----------|:--------:|-------|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `APP_URL` | yes | Public base URL (better-auth `baseURL` + trusted origin) |
| `AUTH_SECRET` | yes | Session signing secret — `pnpm dlx @better-auth/cli secret` |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | yes | Seeded admin account |
| `ADMIN_NAME` | no | Defaults to `Administrator` |
| `S3_ENDPOINT` / `S3_REGION` / `S3_BUCKET` | no | External S3 for OCR images. If unset, OCR still works but images aren’t stored. |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | no | S3 credentials |
| `S3_FORCE_PATH_STYLE` | no | `true` for MinIO/RustFS-style endpoints |
| `S3_PUBLIC_URL` | no | Public base URL for serving stored images (bucket appended automatically) |
| `OCR_PROVIDER` | no | `anthropic` \| `ollama` \| `tesseract` (default: `anthropic` if key set, else `ollama` if configured, else `tesseract`) |
| `ANTHROPIC_API_KEY` | no | Enables **Claude vision OCR** — far better on 7-segment LCDs. Auto-used when set. |
| `ANTHROPIC_OCR_MODEL` | no | Model for Claude OCR (default `claude-opus-4-8`; `claude-haiku-4-5` is cheaper) |
| `OLLAMA_HOST` | no | Ollama endpoint — `https://ollama.com` (Cloud) or `http://localhost:11434` (local) |
| `OLLAMA_API_KEY` | no | API key for Ollama Cloud (not needed for local) |
| `OLLAMA_OCR_MODEL` | no | Vision model on your Ollama account/install (e.g. `qwen2.5vl`, `llama3.2-vision`) |
| `OCR_LANG` | no | Tesseract model (default `ssd` — seven-segment); falls back to `eng` |
| `OCR_TESSDATA_PATH` | no | Dir holding the model file (default `tessdata/`) |

---

## Deployment (Docker + Dokploy)

Use **`docker-compose.dokploy.yml`** for production. It runs **only the app**
(point `DATABASE_URL` at your existing/external PostgreSQL), joins the external
`dokploy-network`, and **publishes no host ports** — Dokploy/Traefik handles ingress.
On every boot the entrypoint runs `prisma migrate deploy` then the **idempotent**
admin seed against `DATABASE_URL` before starting the server.

```bash
# The dokploy-network must already exist (Dokploy creates it; otherwise):
docker network create dokploy-network

# Provide an .env with at least:
#   DATABASE_URL (your external Postgres), APP_URL (public https URL),
#   AUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD   (+ S3_* for OCR image storage)
cp .env.example .env

docker compose -f docker-compose.dokploy.yml up -d --build
```

- **app** — the BP Monitor server on port `3000`, reachable by Traefik over `dokploy-network`. No exposed/published ports, no bundled database.
- If your Postgres also runs on `dokploy-network`, use its service name as the host in `DATABASE_URL` (e.g. `postgresql://user:pass@my-postgres:5432/bpmonitor`).

Routing/TLS is handled by Dokploy/Traefik. Either configure the domain in the
Dokploy UI, or uncomment the example Traefik `labels` in `docker-compose.dokploy.yml`
and set your host.

> `docker-compose.yml` (no suffix) is for local/self-contained runs. It includes
> the app, PostgreSQL, MinIO, and optional Ollama. Use `docker-compose.dokploy.yml`
> for Dokploy production deployments.

---

## Notes & design decisions

- **Auth tables are owned by better-auth.** The spec’s `passwordHash` is stored on
  the related `Account.password` row (better-auth’s credential model). The spec’s
  `isActive` flag maps to better-auth’s `banned` field (`isActive === !banned`) so
  that disabling a user instantly revokes their sessions — enforced server-side.
- **Authorization is server-side.** Every server function calls `requireUser()` or
  `requireAdmin()`; route guards are convenience only. Normal users can never read
  or mutate another user’s records.
- **OCR has three engines, chosen by `OCR_PROVIDER` (auto-detected by env).**
  - **Claude vision** ([src/lib/ocr-ai.ts](src/lib/ocr-ai.ts)) — set `ANTHROPIC_API_KEY`.
    Reads the cropped photo directly and returns structured values; most accurate.
  - **Ollama vision** ([src/lib/ocr-ollama.ts](src/lib/ocr-ollama.ts)) — Ollama Cloud
    (`OLLAMA_HOST=https://ollama.com` + `OLLAMA_API_KEY`) or local Ollama
    (`OLLAMA_HOST=http://localhost:11434`), with a vision model in `OLLAMA_OCR_MODEL`.
    Local Ollama keeps images fully on-prem.
  - **Offline Tesseract fallback** ([src/lib/ocr.ts](src/lib/ocr.ts)) — crop → Otsu
    binarisation (`jimp`) → seven-segment `ssd` model (shipped in `tessdata/`, `eng`
    fallback) → heuristic parse. Used when nothing else is configured, or if an AI
    call fails.
  - Both AI providers share the `OcrEngine`/`OcrOutcome` shape, so adding another is
    a small module + one branch in [src/server/ocr.ts](src/server/ocr.ts). Values are
    always shown for confirmation before saving, regardless of engine.
- **kysely is pinned** (`pnpm-workspace.yaml` override) so better-auth’s unused
  bundled SQLite dialects compile cleanly with the rolldown-based build.
