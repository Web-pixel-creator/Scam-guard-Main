# syntax=docker/dockerfile:1

# ── Build stage ─────────────────────────────────────────────────────────────
# Builds the TanStack Start SSR app with the Nitro `node-server` preset, which
# emits a standalone HTTP server at dist/server/index.mjs.
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Install deps against the committed lockfile for reproducible builds.
# This project uses Bun's lockfile (bun.lock); npm resolves it fine.
COPY package.json bun.lock ./
RUN npm install --no-audit --no-fund

# Copy the rest of the source and build.
COPY . .
# node-server is already the default in vite.config.ts; set explicitly for clarity.
ENV NITRO_PRESET=node-server
RUN npm run build

# ── Runtime stage ───────────────────────────────────────────────────────────
# Ships only the built output — no source, no devDependencies.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Nitro's node-server reads PORT/HOST at runtime.
ENV PORT=3000
ENV HOST=0.0.0.0

# The Nitro node-server bundle is self-contained (deps are bundled into
# dist/server). Copy just the build artifacts.
COPY --from=build /app/dist ./dist

EXPOSE 3000
# Run as the built-in non-root node user.
USER node
CMD ["node", "dist/server/index.mjs"]
