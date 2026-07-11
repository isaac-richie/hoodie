# ─── Build stage ──────────────────────────────────────────────
# Pinned Node major to match the engines field; slim base to keep the image small.
FROM node:20-slim AS build
WORKDIR /app

# Install all deps (incl. dev) for the TypeScript build.
COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Prune to production-only dependencies for the runtime image.
RUN npm prune --omit=dev

# ─── Runtime stage ────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Run as the built-in non-root user.
USER node

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./

EXPOSE 3001

# Container-native healthcheck hits the deep readiness probe (DB + Redis).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
