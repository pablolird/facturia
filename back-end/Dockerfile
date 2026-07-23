FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

# ── Build stage: compile TypeScript ──────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Runner stage: production image ────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/dist ./dist
# SQL migrations are not compiled by tsc — copy them alongside dist
COPY src/db/migrations ./dist/db/migrations

# node:22-alpine ships an unprivileged "node" user (uid 1000) — run as that instead of root
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]
