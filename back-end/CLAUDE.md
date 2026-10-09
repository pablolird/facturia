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

**Auth flow (Clerk):**
- Clerk owns identity (sign-up, sign-in, Google OAuth, email verification, passwords, bot protection). The API never sees credentials.
- `authenticate` (`src/auth/auth.middleware.ts`) requires `Authorization: Bearer <Clerk session token>` and verifies it via `src/auth/clerk.ts` (`authenticateRequest` with `authorizedParties` = `CORS_ORIGIN`, so the token's `azp` must be our frontend). Only the header is forwarded to Clerk — the `__session` cookie is deliberately ignored, because the Vercel `/api` rewrite makes the API same-origin and cookie auth would be CSRF-able.
- Local `users` rows keep their UUID (all other tables reference it) and link to Clerk via `clerk_user_id`. The first authenticated request provisions the row + demo preset (`provisionUser`, idempotent and race-safe); a pre-Clerk account is linked by **verified** email. Unverified emails get 403 `email_not_verified`; an email owned by another Clerk user gets 409 `account_conflict`.
- `req.user` (`src/types/express.d.ts`): `{ id, clerkUserId, username, email, role }` — loaded from the DB on every request, so role changes apply immediately.
- `src/auth/clerk.ts` is the only module that talks to Clerk; tests replace it with `src/tests/clerkMock.ts`.

## Feature modules

### `src/auth/`
No routes. `auth.middleware.ts` (session check + provisioning), `auth.service.ts` (`provisionUser`, `syncUserEmail`, `deleteUserByClerkId`), `clerk.ts` (Clerk SDK wrapper), `email.ts` (`canonicalEmail` / `trialEmailHash`). Provisioning seeds "Empresa Demo S.A." with sample Paraguay fields so the user has a preset immediately.

### `src/webhooks/`
`POST /webhooks/clerk` — mounted **before** `express.json()` because Svix signatures are verified over the raw body (`verifyWebhook`, `CLERK_WEBHOOK_SIGNING_SECRET`). Handles `user.created` (provision), `user.updated` (sync verified primary email), `user.deleted` (delete local account). All handlers are idempotent; non-retryable cases are acknowledged with 200. Webhooks are optional for correctness (provisioning also happens on first request). Locally: `npx clerk@latest webhooks listen`.

### `src/presets/`
CRUD for company presets. Paraguay-specific fields: `business_name`, `ruc`, `timbrado`, `address`, `city`, `phone`, `email`. All fields optional except `name`.

### `src/templates/`
Save / list / PATCH (name or html_content) / delete generated HTML templates per user.

### `src/conversations/`
Conversations with `title`, `preset_id`, `template_html`. Each conversation owns its messages (in `src/messages/` — stored in the `messages` table). `template_html` is updated in-place when the AI returns a new template.

### `src/ai/`
`POST /ai/chat` — the core AI endpoint.
- Enforces paywall before calling DeepSeek via `claimFreeTrial` (`src/users/users.service.ts`): in one transaction, increments `ai_prompts_used` (only while `< 1`) **and** inserts the SHA-256 of the canonical email into `trial_claims`. Both must succeed or it rolls back and returns 402 `{ error: 'trial_exhausted' }`. `trial_claims` has no FK, so deleting the account and signing up again, or using a Gmail dot / `+tag` variant of the same inbox, doesn't grant another trial. Admin users bypass this check.
- Gets or creates a conversation, persists user message, calls DeepSeek, persists assistant message, updates `template_html` on the conversation.
- Two system prompts: generation (returns full `templateHtml`) and edit mode (when a template exists, the model returns `{ find, replace }` patches that `applyEdits` applies server-side, with one automatic retry on a failed match). `pnpm bench:edits` benchmarks this against the old full-regeneration prompt (`src/bench/`).
- `deepseek-reasoner` (R1) doesn't support `response_format: json_object` — only `deepseek-chat` gets that flag. R1 output is cleaned via a markdown fence extractor before JSON.parse.

### `src/users/`
- `PATCH /users/me` — update display name (local only)
- `DELETE /users/me` — deletes the Clerk user first, then the local account (cascades to all user data). If Clerk fails, local data is kept.
- `GET /me` (in `app.ts`) — `{ user: { id, email, name, role } }`; the frontend's first call after sign-in, which provisions the account
- Passwords, email changes and linked Google accounts are managed in Clerk's `<UserProfile>`

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
| `009_clerk_auth.sql` | `clerk_user_id`, nullable `password_hash`, non-unique `username`, `trial_claims` (backfilled from used trials). Additive only: the unused `refresh_tokens` table and `password_hash` column are left for a later cleanup migration |

## Docker

Multi-stage `Dockerfile` (builder → runner). SQL migration files are not emitted by `tsc`, so the Dockerfile manually copies `src/db/migrations/` into `dist/db/migrations/`. pnpm is installed via `npm install -g pnpm` (not corepack) to avoid semver range rejection. Three compose files: `docker-compose.yml` (base), `.qa.yml` (exposes ports, no restart), `.prod.yml` (restart: always, DB port hidden).

## Required env vars

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | Clerk Backend API key (`npx clerk@latest env pull --file .env`) |
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (same command) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Signing secret of the Clerk webhook endpoint |
| `CLERK_JWT_KEY` | Optional PEM public key for networkless token verification |
| `CORS_ORIGIN` | Allowed frontend origin(s), comma-separated (default: `http://localhost:3001`); also the `authorizedParties` for Clerk tokens |
| `PORT` | Server port (default: `3000`) |
| `DEEPSEEK_API_KEY` | DeepSeek API key for AI features |
| `TRUST_PROXY_HOPS` | Reverse proxies in front of the app (`0` locally, `3` on Render) |

Copy `.env.example` → `.env` for local dev. Docker environments use `.env.qa` / `.env.prod`.

## Testing

62 Vitest tests in `src/tests/`. Tests use a real PostgreSQL DB (separate from dev). `globalSetup.ts` runs migrations before the suite. `setup.ts` mocks `auth/clerk.js` with `clerkMock.ts`: tokens are `test-token:<clerkUserId>`, identities default to a verified `<id>@example.com` (override with `setClerkIdentity`). `helpers.ts` `registerAndLogin` signs in through that mock and provisions the user. Webhook tests sign payloads for real with the test `CLERK_WEBHOOK_SIGNING_SECRET` from `vitest.config.ts`. DeepSeek API is mocked in `ai.test.ts`. Run with `DATABASE_URL=<test-db-url> pnpm test`.
