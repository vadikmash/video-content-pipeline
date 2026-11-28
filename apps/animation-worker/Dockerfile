# syntax=docker/dockerfile:1.7
# Disposable worker that compiles and renders one authored sequence per run.
# Build with `pnpm animation-worker:build` (adds the trusted motion toolkit as a named context).
FROM node:22.21.1-bookworm-slim

# Chromium runtime libraries for Remotion's headless shell, plus a fixed font set.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    libnss3 libdbus-1-3 libatk1.0-0 libgbm1 libasound2 libxrandr2 libxkbcommon0 libxfixes3 \
    libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 \
    fonts-inter fonts-dejavu-core ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY image/package.json image/package-lock.json ./
RUN npm ci --no-audit --no-fund \
 && node -e "require('@remotion/renderer').ensureBrowser().then(() => console.log('browser ready'))"

COPY src/ ./src/
RUN npx esbuild src/worker.ts --bundle --platform=node --format=esm --target=node22 --packages=external --outfile=dist/worker.mjs \
 && rm -rf src
COPY wrapper/ ./wrapper/
COPY --from=motion / ./motion/

# The job directory is a tmpfs mount at run time; the image itself is read-only.
RUN mkdir -p /app/job && chown 10001:10001 /app/job
USER 10001:10001
ENV HOME=/tmp NODE_ENV=production NODE_OPTIONS=--max-old-space-size=1536
ENTRYPOINT ["node", "/app/dist/worker.mjs"]
