# Fix PostgreSQL Collation Version Mismatch

This error occurs when PostgreSQL was upgraded but the template database wasn't refreshed.

## Solution

### Option 1: Refresh Template Database (Recommended)

1. **Connect to PostgreSQL as superuser:**
   ```bash
   psql -U postgres
   ```
   
   If that doesn't work, try:
   ```bash
   # Windows
   psql -U postgres -d postgres
   
   # Or if you have a specific user
   psql -U your_username -d postgres
   ```

2. **Run the refresh command:**
   ```sql
   ALTER DATABASE template1 REFRESH COLLATION VERSION;
   ```

3. **Exit:**
   ```sql
   \q
   ```

4. **Try db:push again:**
   ```bash
   npm run db:push
   ```

### Option 2: Create a New Database (Alternative)

If Option 1 doesn't work, create a fresh database:

1. **Connect to PostgreSQL:**
   ```bash
   psql -U postgres
   ```

2. **Drop and recreate the database:**
   ```sql
   -- Drop existing database (WARNING: This deletes all data!)
   DROP DATABASE IF EXISTS floneo_db;
   
   -- Create new database
   CREATE DATABASE floneo_db;
   
   -- Exit
   \q
   ```

3. **Try db:push again:**
   ```bash
   npm run db:push
   ```

### Option 3: Use a Different Database Name

If you want to avoid the template database issue:

1. **Update your `.env` file:**
   ```env
   DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/floneo?schema=public"
   ```
   (Use `floneo` instead of `floneo_db`)

2. **Create the new database:**
   ```bash
   psql -U postgres
   ```
   ```sql
   CREATE DATABASE floneo;
   \q
   ```

3. **Try db:push again:**
   ```bash
   npm run db:push
   ```

## Important Notes

- **Option 1** is the safest and recommended approach
- **Option 2** will delete all data in the database
- **Option 3** is good if you want a fresh start with a different database name

## If You Still Get Errors

If none of the above work, you may need to:
1. Reinstall PostgreSQL
2. Or use Docker for the database (while keeping the rest local)

