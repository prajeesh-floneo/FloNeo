FROM node:20-bullseye-slim

# Install system dependencies (Debian/apt)
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    build-essential \
    curl \
    postgresql-client \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with better caching
# Note: --no-cache is invalid for npm ci and causes build failures
# Using --prefer-offline for better Docker layer caching
## Use `npm install` instead of `npm ci` in the Docker build.
## Reason: `npm ci` requires package.json and package-lock.json to be perfectly
## in sync. On CI or local environments the lockfile sometimes drifts and
## causes `npm ci` to fail during the image build (see build logs). `npm install`
## will tolerate small mismatches and still produce a working node_modules for
## production. We keep the same flags to avoid dev deps and auditing during build.
RUN npm install --omit=dev --prefer-offline --no-audit

# Copy source code
COPY . .

# Ensure start.sh has execute permissions
RUN chmod +x /app/start.sh

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory
RUN mkdir -p uploads/thumbnails

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD curl -f http://localhost:5000/health || exit 1

# Start the application with migrations
CMD ["/bin/sh", "/app/start.sh"]
