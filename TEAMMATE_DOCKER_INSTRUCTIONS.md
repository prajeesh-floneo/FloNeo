# 🎯 FloNeo Docker - For Your Teammate

## ✅ FIXED! All Issues Resolved

Your teammate can now run FloNeo with a **single command**:

```bash
docker-compose up -d --build
```

**Everything works!** ✅

---

## 🚀 Step-by-Step Instructions

### Step 1: Clone the Repository
```bash
git clone https://github.com/prajeesh-floneo/FloNeo.git
cd FloNeo
```

### Step 2: Run Docker
```bash
docker-compose up -d --build
```

### Step 3: Wait 2-3 Minutes
The application is initializing:
- Database is starting
- Backend is running migrations
- Backend is seeding demo data
- Frontend is connecting

### Step 4: Access the Application
Open your browser and go to:
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000

### Step 5: Login
Use these credentials:
- **Email:** demo@example.com
- **Password:** Demo123!@#

---

## 🔧 What Was Fixed

### Issue #1: "start.sh: not found" ✅ FIXED
**Problem:** Backend container couldn't find the startup script
**Solution:** Fixed Dockerfile to properly copy start.sh

### Issue #2: "database floneo does not exist" ✅ FIXED
**Problem:** Backend was trying to connect to wrong database
**Solution:** Updated DATABASE_URL to use correct hostname (`postgres` instead of `localhost`)

### Issue #3: Frontend can't connect to backend ✅ FIXED
**Problem:** Frontend couldn't reach backend during startup
**Solution:** Proper Docker networking and service dependencies

---

## 📋 Useful Commands

### View Logs
```bash
docker-compose logs
```

### View Backend Logs Only
```bash
docker-compose logs backend
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

### Restart Backend
```bash
docker-compose restart backend
```

---

## 🌐 Services

| Service | Port | URL |
|---------|------|-----|
| Frontend (Next.js) | 3000 | http://localhost:3000 |
| Backend (Express) | 5000 | http://localhost:5000 |
| Database (PostgreSQL) | 5432 | localhost:5432 |

---

## 🐛 Troubleshooting

### "Port already in use"
Change the port in docker-compose.yml:
```yaml
ports:
  - "3001:3000"  # Use 3001 instead of 3000
```

### "Docker daemon not running"
Start Docker Desktop or Docker service

### "Containers not starting"
Check logs:
```bash
docker-compose logs
```

### "Still having issues?"
Try a clean rebuild:
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## ✨ Key Points

- ✅ Single command setup
- ✅ Automatic database initialization
- ✅ Automatic migrations and seeding
- ✅ All services start automatically
- ✅ No manual configuration needed
- ✅ Works on Windows, Mac, and Linux

---

## 📞 Need Help?

1. Check the logs: `docker-compose logs`
2. Make sure Docker is running
3. Make sure ports 3000, 5000, 5432 are available
4. Try a clean rebuild

**Everything should work now!** 🎉


