FROM node:22-slim

# Install system libraries required by canvas@3.2.3 prebuilt binary
# (canvas ships its own .so files but still needs a few base libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    pkg-config \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy all source files (patches/ must be present before pnpm install)
COPY . .

# Install dependencies — canvas is in onlyBuiltDependencies so its
# postinstall (prebuild-install) will run and download the prebuilt binary
# with all bundled .so files (libcairo, libpango, libjpeg, etc.)
RUN npm install -g corepack@latest && corepack pnpm install

# Build frontend + server
RUN corepack pnpm run build

ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
