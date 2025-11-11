# 🚀 Local Setup Guide (Without Docker)

This guide will help you run the FloNeo project locally without Docker.

## 📋 Prerequisites

1. **Node.js** (v18 or higher)
2. **PostgreSQL** (v14 or higher)
3. **npm** or **yarn**

---

## 📦 Step 1: Install PostgreSQL

### Windows:

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Install with default settings
3. Remember the password you set for the `postgres` user
4. PostgreSQL will run on `localhost:5432` by default

### macOS:

```bash
brew install postgresql@14
brew services start postgresql@14
```

### Linux (Ubuntu/Debian):

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## 🗄️ Step 2: Create Local Database

### Option A: Using psql (Command Line)

1. Open PostgreSQL command line:

   ```bash
   # Windows (in Command Prompt or PowerShell)
   psql -U postgres

   # macOS/Linux
   sudo -u postgres psql
   ```

2. Create database and user:
   ```sql
   CREATE DATABASE floneo;
   CREATE USER floneo_user WITH PASSWORD 'your_password_here';
   GRANT ALL PRIVILEGES ON DATABASE floneo TO floneo_user;
   \q
   ```

### Option B: Using pgAdmin (GUI)

1. Open pgAdmin
2. Connect to your PostgreSQL server
3. Right-click on "Databases" → "Create" → "Database"
4. Name: `floneo`
5. Save

---

## ⚙️ Step 3: Configure Environment Variables

### Backend (.env file)

Create `server/.env` file with the following content:

```env
# Database Configuration (Local PostgreSQL)
DATABASE_URL="postgresql://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/floneo?schema=public"
# OR if you created a separate user:
# DATABASE_URL="postgresql://floneo_user:YOUR_PASSWORD@localhost:5432/floneo?schema=public"

# JWT Configuration
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Application Configuration
NODE_ENV="development"
PORT="5000"
FRONTEND_URL="http://localhost:3000"

# Email Configuration (Optional - for email features)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@domain.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="FloNeo Platform <noreply@yourdomain.com>"
EMAIL_VERIFICATION_DISABLED="true"

# Other Configuration
BCRYPT_SALT_ROUNDS="12"
```

**Important:** Replace `YOUR_POSTGRES_PASSWORD` with your actual PostgreSQL password!

### Frontend (.env.local file)

Create `client/.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

---

## 📥 Step 4: Install Dependencies

### Backend

```bash
cd server
npm install
```

### Frontend

```bash
cd client
npm install
```

---

## 🗃️ Step 5: Setup Database Schema

### Generate Prisma Client

```bash
cd server
npm run prisma:generate
```

### Create Database Tables

You have two options:

#### Option A: Using db push (Quick - No migration history)

```bash
cd server
npm run db:push
```

#### Option B: Using migrations (Recommended - For production)

```bash
cd server
npx prisma migrate dev --name init
```

### Seed Database (Optional)

```bash
cd server
npm run db:seed
```

---

## 🚀 Step 6: Run the Application

### Terminal 1: Start Backend Server

```bash
cd server
npm run dev
```

The backend will run on: `http://localhost:5000`

### Terminal 2: Start Frontend Server

```bash
cd client
npm run dev
```

The frontend will run on: `http://localhost:3000`

---

## ✅ Step 7: Verify Everything Works

1. **Backend Health Check:**

   ```bash
   curl http://localhost:5000/health
   ```

   Should return: `{"status":"ok"}`

2. **Frontend:**
   Open browser: `http://localhost:3000`

3. **Prisma Studio (Database Viewer):**
   ```bash
   cd server
   npm run prisma:studio
   ```
   Opens at: `http://localhost:5555`

---

## 🔧 Troubleshooting

### Database Connection Issues

**Error: "Connection refused" or "Authentication failed"**

1. Check PostgreSQL is running:

   ```bash
   # Windows
   services.msc  # Look for PostgreSQL service

   # macOS
   brew services list

   # Linux
   sudo systemctl status postgresql
   ```

2. Verify DATABASE_URL in `server/.env`:

   - Check username and password are correct
   - Check database name exists
   - Check port is 5432

3. Test connection manually:
   ```bash
   psql -U postgres -d floneo
   ```

### Port Already in Use

**Error: "Port 5000 already in use"**

1. Change PORT in `server/.env`:

   ```env
   PORT="5001"
   ```

2. Update `client/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5001
   NEXT_PUBLIC_SOCKET_URL=http://localhost:5001
   ```

### Prisma Client Not Generated

**Error: "Cannot find module '@prisma/client'"**

```bash
cd server
npm run prisma:generate
```

### Missing Environment Variables

**Error: "Missing required environment variable"**

Make sure `server/.env` has:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`

---

## 📝 Quick Reference Commands

```bash
# Backend
cd server
npm install              # Install dependencies
npm run dev             # Start development server
npm run prisma:studio   # Open Prisma Studio
npm run db:push         # Sync database schema
npm run db:seed         # Seed database

# Frontend
cd client
npm install             # Install dependencies
npm run dev             # Start development server
npm run build           # Build for production
```

---

## 🎯 Next Steps

1. **Create an account** through the frontend
2. **Explore Prisma Studio** to view your database
3. **Check the API** at `http://localhost:5000`

---

## 💡 Tips

- Use `npm run dev` for auto-reload during development
- Prisma Studio is great for viewing and editing database records
- Keep your `.env` files secure and never commit them to git
- Use different database names for development and production

---

## 🔄 Switching Between Docker and Local

If you want to switch back to Docker later:

1. **Stop local servers** (Ctrl+C)
2. **Start Docker:**
   ```bash
   docker-compose up -d
   ```
3. **Update `.env`** to use Docker database URL:
   ```env
   DATABASE_URL="postgresql://floneo:floneo123@localhost:5432/floneo_db?schema=public"
   ```

---

That's it! You should now have FloNeo running locally. 🎉
