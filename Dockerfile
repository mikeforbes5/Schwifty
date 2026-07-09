# Schwifty marketplace server — no build step; runs TS via tsx.
FROM node:22-slim

WORKDIR /app

# Install with layer caching: manifests first, then source.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/server/package.json packages/server/
COPY packages/forge/package.json packages/forge/
COPY packages/mcp/package.json packages/mcp/
COPY packages/dashboard/package.json packages/dashboard/
RUN npm ci

COPY . .

# Persistent volume mounts at /data (Railway: add a Volume with this path).
ENV DATABASE_PATH=/data/schwifty.db
EXPOSE 4021

# Seed is idempotent — restocks nothing on subsequent boots.
CMD ["sh", "-c", "npx tsx packages/forge/src/seed-cli.ts && exec npx tsx packages/server/src/index.ts"]
