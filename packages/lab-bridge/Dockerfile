# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.0.0 --activate

# Copy workspace manifests first for better layer caching
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/lab-bridge/package.json ./packages/lab-bridge/

# IMPORTANT: @roomy/sdk is currently a file: reference to a local path outside
# this repo. Before building this image, replace the dependency in
# packages/lab-bridge/package.json with a published package or git+https ref:
#
#   "@roomy/sdk": "git+https://github.com/muni-town/roomy.git#workspace=packages/sdk"
#
# Until then, this stage will fail if the file: path is not resolvable.
RUN pnpm install --frozen-lockfile

COPY packages/lab-bridge ./packages/lab-bridge
RUN pnpm --filter lab-bridge build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/packages/lab-bridge/dist ./dist
# Copy hoisted node_modules and any package-local ones
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/lab-bridge/node_modules ./packages/lab-bridge/node_modules 2>/dev/null || true

CMD ["node", "dist/index.js"]
