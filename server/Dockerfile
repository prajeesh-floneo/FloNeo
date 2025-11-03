FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with better caching
# Note: --no-cache is invalid for npm ci and causes build failures
# Using --prefer-offline for better Docker layer caching
RUN npm ci --omit=dev --prefer-offline --no-audit

# Copy source code
COPY . .

# Copy startup script
COPY start.sh /app/start.sh
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
