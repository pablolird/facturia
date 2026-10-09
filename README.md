<div align="center">

# Facturia

### AI-powered invoice template generator for Paraguay's SIFEN system

*Describe the invoice you want. Get print-ready HTML in seconds.*

**[Live site](https://facturia-rose.vercel.app)** · Selected as one of the top 5 projects in the ITTI Gen AI Developer course

[![CI](https://github.com/pablolird/facturia/actions/workflows/ci.yml/badge.svg)](https://github.com/pablolird/facturia/actions/workflows/ci.yml)
![Node.js](https://img.shields.io/badge/Node.js_22-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL_17-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind_v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

https://github.com/user-attachments/assets/dc8e4066-6ac6-4547-a43e-d50d3cf2720b

</div>

---

## What is Facturia?

Facturia is a chat-based SaaS tool that turns a plain-language description into a fully structured, print-ready Paraguayan invoice template — no accounting knowledge required.

You describe what you need ("professional invoice for a consulting service, dark header, my logo in the top right"), Facturia generates it, and you can keep refining it through conversation. Every template respects Paraguay's mandatory SIFEN/SET invoice requirements out of the box: Condición de Venta, three-column IVA breakdown (Exentas / Gravado 5% / Gravado 10%), and the correct totals block.

---

## Features

**AI Invoice Generation**
- Natural-language chat interface — describe any template, get live HTML
- Two AI models: **DeepSeek V3** (fast) and **DeepSeek R1 Reasoner** (deeper reasoning)
- Edit mode: follow-up messages return small find/replace patches applied server-side, not full regenerations ([how it works](#how-edit-mode-works))
- Company logo auto-injected into every template

**Paraguay SIFEN Compliance**
- Mandatory Condición de Venta (Contado / Crédito) field
- Three-column IVA breakdown enforced on every template
- Correct totals block: Exentas, IVA 5%, IVA 10%, Total General
- Company presets with RUC and timbrado validation

**Company Presets**
- Save your razón social, RUC, timbrado, address, and logo once
- Preset is injected automatically into every generation
- Full CRUD — create, edit, delete presets from the sidebar

**Template Library**
- Save, rename, download, and preview any generated template
- Responsive card grid with live scaled previews
- Download as self-contained HTML ready to print or share

**Multi-language UI**
- Full translations in English, Spanish, and Portuguese
- Instant language switch, persisted across sessions

**Polished UX**
- Realistic invoice skeleton animation while AI generates
- Split-pane layout: chat left, live preview right
- Mobile-responsive with Chat / Preview tab switcher
- Light, Dark, and System themes

**Production-ready Auth**
- [Clerk](https://clerk.com) sign-in with email + password or **Google**, mandatory email verification, bot protection and breached-password checks
- Sign-ups from disposable email domains and `+tag` aliases are blocked
- The API accepts only Clerk session tokens sent as bearer headers and minted for our own origin (`azp`); session cookies are ignored, so the same-origin `/api` rewrite can't be abused for CSRF
- Free-trial abuse resistant: one generation per **mailbox**, not per account. Gmail dot / `googlemail.com` / `+tag` variants collapse to one canonical address, and the claim survives account deletion, all enforced in one race-safe transaction
- Admin role bypasses the paywall; roles are read from the database on every request; `helmet` security headers

---

## Demo

<img width="1512" height="864" alt="image" src="https://github.com/user-attachments/assets/647d4c89-d849-4316-a58a-c026f36db38f" />

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · Vite 8 · TypeScript · TailwindCSS v4 · shadcn/ui · TanStack Query v5 |
| Backend | Node.js 22 · Express 5 · TypeScript (ESM) |
| Database | PostgreSQL 17 via `pg.Pool` · auto-run SQL migrations |
| AI | DeepSeek API (`deepseek-chat` · `deepseek-reasoner`) via OpenAI-compatible SDK |
| Auth | Clerk (email + password, Google OAuth) · bearer session tokens verified with `@clerk/backend` · Svix-signed webhooks |
| Validation | Zod v4 (frontend + backend) · react-hook-form |
| Testing | Vitest · supertest · 47 integration tests against a real DB |
| CI/CD | GitHub Actions · Docker multi-stage builds · 3 Compose environments |

---

## Architecture

```mermaid
flowchart LR
    U[Browser<br/>React 19 SPA] -- "Clerk session token<br/>(Bearer header)" --> API
    U -- "sign-in · Google · verification" --> CK[(Clerk)]
    CK -- "signed webhooks" --> API
    subgraph API[Express 5 API]
        AUTH[auth<br/>token check · provisioning · trial claims]
        AI[ai<br/>prompt builder · patch applier]
        CRUD[presets · templates<br/>conversations · users]
    end
    AI -- "OpenAI-compatible SDK" --> DS[(DeepSeek<br/>V3 / R1)]
    API --> PG[(PostgreSQL<br/>9 auto-run migrations)]
```

A chat request goes through: auth middleware (Clerk token verified, local account loaded or provisioned) → atomic paywall check (per-account counter + per-mailbox `trial_claims` row in one transaction) → system prompt built from the selected company preset and Paraguay's mandatory invoice rules → DeepSeek → JSON parsed (with a fallback extractor for R1, which ignores JSON mode) → logo placeholder swapped for the stored base64 image → conversation and messages persisted.

### How edit mode works

The first message generates a full HTML template. Follow-up messages ("make the header blue") used to ask the model to re-emit the whole document with one change applied. That was slow, let the model drift and rewrite parts nobody asked about, and broke outright once a company logo was embedded: the base64 image alone can exceed the model's 8K-token output limit, so responses were truncated.

Edit mode now asks the model for a list of `{ find, replace }` patches instead ([`ai.service.ts`](back-end/src/ai/ai.service.ts)). The backend applies them with exact string replacement, falling back to a whitespace-tolerant match that must be unique. If a patch doesn't match, the error is fed back to the model for one automatic retry. The logo never passes through the model's output.

#### Benchmark: full regeneration vs. patches

[`src/bench/benchmark-edits.ts`](back-end/src/bench/benchmark-edits.ts) generates one base template, then applies the same 10 edit requests with both approaches: the previous full-regeneration prompt (recovered verbatim from git history) and the current `chat()` code path. It repeats this with no logo and with two small embedded logos. Token counts come from the API's own usage field.

Run on 2026-09-27 against `deepseek-chat`, `max_tokens` 8192 for both approaches ([raw results](back-end/bench-results/)):

| Scenario | Approach | Edits applied | Output tokens (10 edits) | Median latency |
|---|---|---|---|---|
| No logo | Full regeneration | 10/10 | 35,712 | 9.1 s |
| | **Patches** | **10/10** | **2,058** | **1.3 s** |
| ~5 KB base64 logo | Full regeneration | 9/10 | 71,149 | 30.4 s |
| | **Patches** | **10/10** | **1,863** | **1.4 s** |
| ~9 KB base64 logo | Full regeneration | 0/10 (all truncated at the output limit) | 81,920 | 43.2 s |
| | **Patches** | **9/10** | **2,059** | **1.4 s** |

Overall, patches applied 29/30 edits vs. 19/30, using about 32× fewer output tokens. The one patch miss was the model replying with a message instead of an edit, not a failed match; none of the 30 patch runs needed the automatic retry. This is a single run with 10 requests per cell, so treat the numbers as indicative. Reproduce it with `cd back-end && pnpm bench:edits` (needs `DEEPSEEK_API_KEY`, costs a few cents).

---

## Getting started

### Prerequisites

- Node.js 22+
- pnpm 11+
- Docker (for Postgres)
- A [DeepSeek API key](https://platform.deepseek.com)

### Setup

```bash
# 1. Clone
git clone https://github.com/pablolird/facturia.git
cd facturia

# 2. Copy and fill in environment variables
cp back-end/.env.example back-end/.env
cp front-end/.env.example front-end/.env
# Edit back-end/.env — set DATABASE_URL and DEEPSEEK_API_KEY
# Clerk keys: link the repo to your Clerk app, then pull its keys into both env files
npx clerk@latest link
npx clerk@latest env pull --file back-end/.env
npx clerk@latest env pull --file front-end/.env   # then delete CLERK_SECRET_KEY from front-end/.env

# 3. Start everything
./dev.sh
```

`dev.sh` spins up a Postgres container, waits for it to be healthy, then starts the backend on `:3000` and the frontend on `:3001`.

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `CLERK_SECRET_KEY` / `CLERK_PUBLISHABLE_KEY` | Clerk keys for the backend (`clerk env pull`) |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Signing secret of the Clerk webhook pointing at `<api>/webhooks/clerk` |
| `DEEPSEEK_API_KEY` | From [platform.deepseek.com](https://platform.deepseek.com) |
| `CORS_ORIGIN` | Frontend origin (default: `http://localhost:3001`); Clerk tokens must be minted for it |
| `VITE_API_BASE_URL` | Backend URL for the frontend (set in `front-end/.env`) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key for the frontend (`front-end/.env`) |

---

## Project structure

```
facturia/
├── back-end/
│   └── src/
│       ├── auth/           Clerk token check, account provisioning, email canonicalization
│       ├── webhooks/       Signed Clerk webhooks (user created / updated / deleted)
│       ├── presets/        Company presets (RUC, timbrado, logo)
│       ├── templates/      Saved invoice templates
│       ├── conversations/  AI chat history + messages
│       ├── ai/             DeepSeek integration, system prompts, patch applier
│       ├── bench/          Edit-mode benchmark (legacy vs. patch)
│       ├── users/          Profile, account deletion, free-trial claim
│       └── db/             pg pool + SQL migrations (auto-applied on startup)
└── front-end/
    └── src/
        ├── routes/         Home (chat), Login, Templates, Profile, Settings
        ├── components/     BrandName, PresetSheet, TemplateGenerating, ChatMessage…
        ├── context/        AuthContext, LanguageContext
        └── lib/            api.ts (authenticated fetch), translations.ts
```

---

## Running tests

The backend test suite hits a real Postgres instance. 62 tests cover auth (Clerk mocked at the SDK boundary), signed webhooks, presets, templates, conversations, AI chat (DeepSeek mocked), and the free-trial paywall. That includes a test that fires 10 concurrent requests and asserts exactly one gets through, and tests that Gmail-alias and delete-and-re-register attempts don't get a second trial. CI runs type-check, lint and the full suite on every push.

```bash
# Start a throwaway test DB
docker run -d --name test_db \
  -e POSTGRES_DB=test_db -e POSTGRES_USER=test_user -e POSTGRES_PASSWORD=test_password \
  -p 5433:5432 postgres:17-alpine

# Run tests
cd back-end
DATABASE_URL=postgresql://test_user:test_password@localhost:5433/test_db pnpm test

# Tear down
docker stop test_db && docker rm test_db
```

---

## Deployment

The live demo runs on free tiers:

| Piece | Where | Notes |
|---|---|---|
| Frontend | Vercel | Static Vite build; `vercel.json` rewrites `/api/*` to the backend |
| Backend | Render (Docker, `back-end/Dockerfile`) | Auto-deploys from `master`; migrations run on startup |
| Database | Neon Postgres | `DATABASE_URL` with `sslmode=verify-full` |

The `/api` rewrite makes the API same-origin with the frontend. Because of that, the backend authenticates only the `Authorization` header and never Clerk's `__session` cookie, which the browser would otherwise attach automatically. Behind that chain the backend sets `TRUST_PROXY_HOPS=3` (Cloudflare + Render's load balancer + local proxy).

Render's free tier sleeps after 15 minutes idle, so a small external pinger hits `/health` every 10 minutes to keep the demo responsive.

### Self-hosting with Docker Compose

Docker Compose files are included for QA and production environments:

```bash
cd back-end

# QA — ports exposed, no restart policy
pnpm docker:qa:up

# Production — DB port hidden, restart: always
pnpm docker:prod:up
```

Populate `back-end/.env.qa` or `back-end/.env.prod` before running.

---

## License

[MIT](LICENSE) © 2026 Pablo Lird
