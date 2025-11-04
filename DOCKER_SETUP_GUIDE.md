# 🐳 FloNeo Docker Setup Guide

## ✅ Quick Start

```bash
# Clone the repository
git clone https://github.com/prajeesh-floneo/FloNeo.git
cd FloNeo

# Run with a single command
docker-compose up -d --build
```

**That's it!** The application will be ready in 2-3 minutes.

---

## 🌐 Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **Database:** localhost:5432

### Login Credentials
- **Email:** demo@example.com
- **Password:** Demo123!@#

---

## 🔧 What Gets Set Up Automatically

When you run `docker-compose up -d --build`, the following happens:

1. ✅ **PostgreSQL Database** starts on port 5432
   - Database name: `floneo_db`
   - User: `floneo`
   - Password: `floneo123`

2. ✅ **Backend API** (Express.js) starts on port 5000
   - Waits for database to be ready
   - Runs database migrations (2/2)
   - Seeds demo data (demo user + templates)
   - Starts Express server

3. ✅ **Frontend** (Next.js 14) starts on port 3000
   - Connects to backend API
   - Ready to use

---

## 📋 Common Commands

### Start the Application
```bash
docker-compose up -d --build
```

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres
```

### Stop Everything
```bash
docker-compose down
```

### Clean Everything (Fresh Start)
```bash
docker-compose down -v
docker-compose up -d --build
```

### Restart a Service
```bash
docker-compose restart backend
```

---

## 🐛 Troubleshooting

### Issue: "start.sh: not found"
**Solution:** This is fixed in the latest version. Make sure you have the latest code:
```bash
git pull origin main
docker-compose down -v
docker-compose up -d --build
```

### Issue: "database floneo does not exist"
**Solution:** This is fixed in the latest version. The database name is `floneo_db` and the connection uses the Docker service name `postgres`.

### Issue: Frontend can't connect to backend
**Solution:** Wait 2-3 minutes for the backend to fully initialize. Check logs:
```bash
docker-compose logs backend
```

### Issue: Port already in use
**Solution:** Change the port in docker-compose.yml:
```yaml
ports:
  - "3001:3000"  # Change 3001 to any available port
```

---

## 📁 Project Structure

```
FloNeo/
├── server/              # Express.js Backend
│   ├── Dockerfile       # Backend Docker image
│   ├── start.sh         # Startup script (migrations, seeding)
│   ├── .env             # Environment variables (local)
│   ├── .env.example     # Environment template
│   ├── package.json
│   ├── prisma/          # Database schema & migrations
│   └── routes/          # API routes
├── client/              # Next.js 14 Frontend
│   ├── Dockerfile       # Frontend Docker image
│   ├── package.json
│   └── app/             # Next.js app directory
├── docker-compose.yml   # Docker orchestration
└── README.md
```

---

## 🔐 Environment Variables

### For Docker (Automatic)
The docker-compose.yml sets all required environment variables:
- `DATABASE_URL`: `postgresql://floneo:floneo123@postgres:5432/floneo_db?schema=public`
- `JWT_SECRET`: `floneo-docker-jwt-secret-key`
- `NODE_ENV`: `production`

### For Local Development
Edit `server/.env`:
```
DATABASE_URL="postgresql://floneo:floneo123@localhost:5432/floneo_db?schema=public"
JWT_SECRET="your-secret-key"
NODE_ENV="development"
```

---

## 📊 Database

### Migrations
Automatically run on startup via `start.sh`:
```bash
npx prisma migrate deploy
```

### Seeding
Automatically run on startup via `start.sh`:
```bash
npx prisma db seed
```

### Schema
Located at: `server/prisma/schema.prisma`

---

## 🚀 Performance Tips

1. **First run takes longer** - Docker builds images and initializes database
2. **Subsequent runs are faster** - Docker uses cached layers
3. **Use `docker-compose up -d`** - Runs in background
4. **Check logs if something fails** - `docker-compose logs`

---

## 📞 Support

If you encounter issues:

1. Check the logs: `docker-compose logs`
2. Make sure Docker is running
3. Make sure ports 3000, 5000, 5432 are available
4. Try a clean rebuild: `docker-compose down -v && docker-compose up -d --build`

---

## ✨ Recent Fixes

- ✅ Fixed `start.sh: not found` error
- ✅ Fixed database connection issues
- ✅ Fixed Docker networking for backend-database communication
- ✅ Added proper health checks
- ✅ Automatic migrations and seeding

**All issues resolved!** Your teammate can now run the app with a single command. 🎉


