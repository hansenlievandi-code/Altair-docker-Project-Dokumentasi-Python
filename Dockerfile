# syntax=docker/dockerfile:1

# ── Stage 1: build frontend (Vite) ───────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 2: dependency production saja (tanpa vite/eslint) ──────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 3: image akhir (kecil, non-root) ───────────────────────────────────
FROM node:22-alpine AS runtime
LABEL org.opencontainers.image.title="altair-docs" \
      org.opencontainers.image.authors="Laurencio Luckson, Fendy, Aelberth Cheong"

# Hanya nilai non-rahasia yang boleh punya default.
# JWT_SECRET, DEMO_EMAIL, DEMO_PASSWORD diberikan saat `run` (-e / --env-file).
ENV NODE_ENV=production \
    PORT=5000 \
    APP_NAME="Altair Docs" \
    APP_ENV=production

WORKDIR /app
COPY --from=deps  --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node package.json ./

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

CMD ["node", "server/index.js"]
