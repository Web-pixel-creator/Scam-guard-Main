# syntax=docker/dockerfile:1

# ── Build stage (Bun — matches CI and bun.lock) ────────────────────────────
FROM oven/bun:1 AS build
WORKDIR /app

# Install deps from the committed bun.lock (reproducible, frozen).
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source and build with the Nitro node-server preset.
COPY . .

# VITE_* vars are baked into the client bundle at build time by Vite.
# Railway passes service variables as build-time env automatically; for other
# platforms (manual docker build) pass them via --build-arg.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG SUPABASE_URL
ARG SUPABASE_PUBLISHABLE_KEY

ENV NITRO_PRESET=node-server
RUN bun run build

# ── Runtime stage (Node — Nitro node-server is a plain Node bundle) ────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# The Nitro node-server bundle is self-contained (deps are bundled into
# dist/server). Copy just the build artifacts — no source, no devDeps.
COPY --from=build /app/dist ./dist

EXPOSE 3000
USER node
CMD ["node", "dist/server/index.mjs"]
