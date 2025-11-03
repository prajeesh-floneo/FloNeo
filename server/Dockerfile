FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with better caching
# Use npm ci when a lockfile exists, otherwise fall back to npm install
RUN sh -c '\
  if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
    npm ci --only=production --no-cache --prefer-offline; \
  else \
    npm install --only=production --no-cache --prefer-offline; \
  fi'

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
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with migrations
CMD ["/app/start.sh"]
