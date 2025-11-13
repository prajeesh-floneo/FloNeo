FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat \
    curl \
    postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with better caching
RUN npm install --only=production --no-cache --prefer-offline

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
