# ============================================
# Buzz by SolCex — elizaOS Plugin
# Docker build for testing and deployment
# ============================================

FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install

# Copy source
COPY tsconfig.json tsup.config.ts ./
COPY src/ ./src/

# Build
RUN bun run build

# ============================================
# Production stage — minimal image
# ============================================
FROM oven/bun:1-alpine AS production

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY README.md LICENSE ./
COPY images/ ./images/ 2>/dev/null || true

# Metadata
LABEL org.opencontainers.image.title="Buzz by SolCex — elizaOS Plugin"
LABEL org.opencontainers.image.description="Autonomous BD agent plugin for token discovery and scoring"
LABEL org.opencontainers.image.version="0.1.0"
LABEL org.opencontainers.image.vendor="SolCex Exchange"
LABEL org.opencontainers.image.source="https://github.com/buzzbysolcex/plugin-buzz-solcex"

# Healthcheck — verify the build output exists
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s \
  CMD test -f /app/dist/index.js || exit 1

# Default: run a quick validation
CMD ["bun", "run", "--eval", "import p from './dist/index.js'; console.log('✅ Plugin loaded:', p.name, '—', p.description); console.log('Actions:', p.actions?.length || 0); console.log('Providers:', p.providers?.length || 0);"]
