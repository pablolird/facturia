# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev            # start with hot-reload (reads .env)
pnpm build          # compile TypeScript → dist/
pnpm type-check     # tsc --noEmit, no emit
pnpm lint           # eslint
pnpm lint:fix       # eslint --fix
pnpm format         # prettier --write
pnpm format:check   # prettier --check

# Tests (requires a separate postgres on port 5433)
DATABASE_URL=postgres://... pnpm test

# Docker
pnpm docker:qa:up      # build + start QA stack (foreground)
pnpm docker:qa:down
pnpm docker:qa:logs
pnpm docker:prod:up    # build + start prod stack (detached)
pnpm docker:prod:down
pnpm docker:prod:logs
```

## Architecture

**Runtime:** Node 22, TypeScript (ESM, `moduleResolution: nodenext`). All relative imports must use `.js` extensions even in `.ts` source files. Top-level `await` is used in `src/index.ts`.

**Entry point:** `src/index.ts` — registers CORS, JSON body parser, mounts routers, runs migrations at startup, then starts listening.

**Layer convention (same for every module):**
- `*.router.ts` — mounts routes, no logic
- `*.controller.ts` — parses/validates request with Zod, calls service, maps errors to HTTP status codes
- `*.service.ts` — all business logic and DB queries
- `*.types.ts` — shared interfaces

Follow this split when adding new feature modules.

**Database:** `pg.Pool` singleton in `src/db/db.ts`, connected via `DATABASE_URL`. Migrations run automatically at startup via `src/db/migrate.ts`, which applies `.sql` files from `src/db/migrations/` in filename order and tracks them in a `schema_migrations` table. New migrations go in that folder as `NNN_description.sql`.

**Auth flow:**
- Access tokens (15 min, `JWT_ACCESS_SECRET`) — sent as `Authorization: Bearer <token>`
- Refresh tokens (7 days, `JWT_REFRESH_SECRET`) — stored in the DB by `jti` UUID; rotated on every use (single-use)
- `req.user` is typed via `src/types/express.d.ts`: `{ id, username, email, role }`
- `role` is `'admin' | 'user'` — included in the JWT access payload and on `req.user`

## Feature modules

### `src/auth/`
Register (creates a demo preset for the new user), login, refresh, logout. On register, `createPreset` is called to seed "Empresa Demo S.A." with sample Paraguay fields so the user has a preset immediately.

### `src/presets/`
CRUD for company presets. Paraguay-specific fields: `business_name`, `ruc`, `timbrado`, `address`, `city`, `phone`, `email`. All fields optional except `name`.

### `src/templates/`
Save / list / PATCH (name or html_content) / delete generated HTML templates per user.

### `src/conversations/`
Conversations with `title`, `preset_id`, `template_html`. Each conversation owns its messages (in `src/messages/` — stored in the `messages` table). `template_html` is updated in-place when the AI returns a new template.

### `src/ai/`
`POST /ai/chat` — the core AI endpoint.
- Enforces paywall before calling DeepSeek: atomic `UPDATE users SET ai_prompts_used = ai_prompts_used + 1 WHERE id = $1 AND ai_prompts_used < 1 RETURNING id`. Returns 402 `{ error: 'trial_exhausted' }` if the row count is 0. Admin users bypass this check.
- Gets or creates a conversation, persists user message, calls DeepSeek, persists assistant message, updates `template_html` on the conversation.
- System prompt has two dynamic blocks: preset injection (company details) and edit-mode (passes current `template_html` with strict minimal-patch instructions when a template already exists).
- `deepseek-reasoner` (R1) doesn't support `response_format: json_object` — only `deepseek-chat` gets that flag. R1 output is cleaned via a markdown fence extractor before JSON.parse.

### `src/users/`
- `PATCH /users/me` — update display name
- `POST /users/me/change-password` — verify current password, hash and store new one
- `DELETE /users/me` — delete account (cascades to all user data)

## Database migrations

| File | Description |
|---|---|
| `001_create_users.sql` | users table |
| `002_add_username.sql` | adds username column |
| `003_create_presets.sql` | presets table |
| `004_create_templates.sql` | templates table |
| `005_create_conversations.sql` | conversations table |
| `006_create_messages.sql` | messages table |
| `007_add_user_role_and_prompt_count.sql` | role + ai_prompts_used on users |
| `008_add_logo_to_presets.sql` | logo_data column (base64 data URL) on presets |

## Docker

Multi-stage `Dockerfile` (builder → runner). SQL migration files are not emitted by `tsc`, so the Dockerfile manually copies `src/db/migrations/` into `dist/db/migrations/`. pnpm is installed via `npm install -g pnpm` (not corepack) to avoid semver range rejection. Three compose files: `docker-compose.yml` (base), `.qa.yml` (exposes ports, no restart), `.prod.yml` (restart: always, DB port hidden).

## Required env vars

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Signs access tokens |
| `JWT_REFRESH_SECRET` | Signs refresh tokens |
| `CORS_ORIGIN` | Allowed frontend origin (default: `http://localhost:3001`) |
| `PORT` | Server port (default: `3000`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI features |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key, verifies the login CAPTCHA |

Copy `.env.example` → `.env` for local dev. Docker environments use `.env.qa` / `.env.prod`.

## Testing

43 Vitest integration tests in `src/tests/`. Tests use a real PostgreSQL DB (separate from dev). `globalSetup.ts` runs migrations before the suite. `helpers.ts` provides test user creation and token extraction. DeepSeek API is mocked in `ai.test.ts`. Run with `DATABASE_URL=<test-db-url> pnpm test`.
