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
RUN mkdir -p dist/ops \
  && bun build scripts/polling-resource-soak.ts --target=node --outfile=dist/ops/polling-resource-soak.mjs \
  && bun build scripts/qr-worker-resource-soak.ts --target=node --outfile=dist/ops/qr-worker-resource-soak.mjs

# ── Runtime stage (Node — Nitro node-server is a plain Node bundle) ────────
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# The application starts with Node directly. npm/Corepack and their transitive
# packages are unnecessary in production, so remove them from the runtime image
# instead of carrying an avoidable package-manager attack surface.
RUN rm -rf \
    /usr/local/lib/node_modules/npm \
    /usr/local/lib/node_modules/corepack \
    /opt/yarn-v1.22.22 \
  && rm -f \
    /usr/local/bin/npm \
    /usr/local/bin/npx \
    /usr/local/bin/corepack \
    /usr/local/bin/yarn \
    /usr/local/bin/yarnpkg \
    /usr/local/bin/pnpm \
    /usr/local/bin/pnpx

# The Nitro node-server bundle is self-contained (deps are bundled into
# dist/server). Copy just the build artifacts — no source, no devDeps.
COPY --from=build /app/dist ./dist

# The QR worker is created from an isolated eval source and resolves only these
# three decoders at runtime. Copy the minimal modules explicitly so production
# QR decoding cannot silently fail after the main server bundle is relocated.
COPY --from=build /app/node_modules/jsqr ./node_modules/jsqr
COPY --from=build /app/node_modules/jpeg-js ./node_modules/jpeg-js
COPY --from=build /app/node_modules/pngjs ./node_modules/pngjs

EXPOSE 3000
USER node
CMD ["node", "dist/server/index.mjs"]
