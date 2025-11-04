#!/bin/sh
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo ${YELLOW}[FloNeo] Waiting for database server to be ready...${NC}

# Wait for database to be ready using pg_isready
for i in $(seq 1 30); do
  if pg_isready -h postgres -U floneo > /dev/null 2>&1; then
    echo ${GREEN}[FloNeo] Database is ready!${NC}
    break
  fi
  echo ${YELLOW}[FloNeo] Attempt $i/30: Waiting for database...${NC}
  sleep 2
done

# Run migrations
echo ${YELLOW}[FloNeo] Running database migrations...${NC}
if npx prisma migrate deploy; then
  echo ${GREEN}[FloNeo] Migrations completed successfully!${NC}
else
  echo ${YELLOW}[FloNeo] Migrations completed with warnings (continuing...)...${NC}
fi

# Seed the database with test data
echo ${YELLOW}[FloNeo] Seeding database with test data...${NC}
if npx prisma db seed; then
  echo ${GREEN}[FloNeo] Database seeding completed successfully!${NC}
else
  echo ${YELLOW}[FloNeo] Database seeding completed with warnings (continuing...)...${NC}
fi

# Generate Prisma client
echo ${YELLOW}[FloNeo] Generating Prisma client...${NC}
npx prisma generate

# Start the application
echo ${GREEN}[FloNeo] Starting FloNeo application...${NC}
npm start