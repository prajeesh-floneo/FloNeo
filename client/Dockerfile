FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Install required libraries for Next.js SWC
RUN apk add --no-cache libc6-compat gcompat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package*.json ./
# Note: --no-cache is invalid for npm ci and causes build failures
# Using --prefer-offline for better Docker layer caching
RUN npm ci --prefer-offline --no-audit
RUN npm install sharp --platform=linux --arch=x64

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
