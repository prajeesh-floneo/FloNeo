#!/bin/sh

# Wait for database server to be ready
echo "Waiting for database server to be ready..."
for i in $(seq 1 30); do
  if pg_isready -h postgres -p 5432 2>/dev/null | grep -q "accepting"; then
    echo "Database server is ready!"
    break
  fi
  echo "Attempt $i: Database server not ready yet, waiting..."
  sleep 2
done

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy || {
  echo "Migration failed, but continuing..."
}

# Seed the database with test data
echo "Seeding database with test data..."
npx prisma db seed || {
  echo "Seeding failed, but continuing..."
}

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Start the application
echo "Starting FloNeo application..."
npm start

