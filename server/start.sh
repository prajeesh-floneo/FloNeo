#!/bin/sh
set -e

echo "Waiting for database server to be ready..."
for i in $(seq 1 30); do
  if pg_isready -h postgres -p 5432 2>/dev/null | grep -q "accepting"; then
    echo "✅ Database server is ready!"
    break
  fi
  echo "⏳ Attempt $i: Database server not ready yet, waiting..."
  sleep 2
done

# Apply migrations or fallback to push schema
if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
  echo "🧱 Running database migrations..."
  npx prisma migrate deploy || echo "⚠ Migration failed, continuing..."
else
  echo "⚙ No migrations found, pushing schema to DB..."
  npx prisma db push || echo "⚠ Schema push failed, continuing..."
fi

# Seed the database
echo "🌱 Seeding database..."
npx prisma db seed || echo "⚠ Seeding failed, continuing..."

# Generate Prisma client
echo "⚡ Generating Prisma client..."
npx prisma generate

# Start the app
echo "🚀 Starting FloNeo application..."
npm start