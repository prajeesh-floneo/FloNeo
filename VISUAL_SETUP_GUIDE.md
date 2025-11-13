# 📊 VISUAL SETUP GUIDE - FloNeo Docker

---

## 🎯 THE COMPLETE FLOW

```
START
  ↓
[1] Open Terminal
  ↓
[2] Go to FloNeo folder
  ↓
[3] Pull latest code (git pull)
  ↓
[4] Start Docker (docker-compose up -d --build)
  ↓
[5] Wait 60 seconds
  ↓
[6] Verify containers running (docker-compose ps)
  ↓
[7] Open browser → http://localhost:3000
  ↓
[8] Login with demo@example.com / Demo123!@#
  ↓
[9] See dashboard
  ↓
SUCCESS! 🎉
```

---

## 📝 DETAILED STEPS WITH COMMANDS

### **STEP 1: Open Terminal**

Windows:
- Press `Win + R`
- Type `cmd` or `powershell`
- Press Enter

### **STEP 2: Navigate to FloNeo**

```bash
cd C:\Users\azhab\Downloads\FloNeo
```

### **STEP 3: Pull Latest Code**

```bash
git pull origin main
```

**Expected output:**
```
Already up to date.
```

### **STEP 4: Start Docker**

```bash
docker-compose up -d --build
```

**What you'll see:**
```
Building backend
Building frontend
Creating floneo-postgres ... done
Creating floneo-backend ... done
Creating floneo-frontend ... done
```

### **STEP 5: Wait 60 Seconds**

Just wait. Database is initializing.

### **STEP 6: Check Status**

```bash
docker-compose ps
```

**Expected output:**
```
NAME              IMAGE                  STATUS
floneo-postgres   postgres:14-alpine     Up (healthy)
floneo-backend    withdb22oct-backend    Up (healthy)
floneo-frontend   withdb22oct-frontend   Up
```

### **STEP 7: Open Browser**

Go to: `http://localhost:3000`

**You should see:**
```
┌─────────────────────────────────┐
│         FloNeo Login            │
├─────────────────────────────────┤
│                                 │
│  Email: [________________]      │
│                                 │
│  Password: [________________]   │
│                                 │
│  [    Login Button    ]         │
│                                 │
└─────────────────────────────────┘
```

### **STEP 8: Enter Credentials**

```
Email: demo@example.com
Password: Demo123!@#
```

Click Login

### **STEP 9: See Dashboard**

```
┌─────────────────────────────────┐
│    FloNeo Dashboard             │
├─────────────────────────────────┤
│                                 │
│  My Applications                │
│  ├─ App 1                       │
│  ├─ App 2                       │
│  └─ Create New                  │
│                                 │
│  Templates                      │
│  ├─ Dashboard Template          │
│  ├─ Form Template               │
│  └─ More...                     │
│                                 │
└─────────────────────────────────┘
```

---

## 🔄 WHAT'S HAPPENING BEHIND THE SCENES

```
Your Computer
├─ Docker Desktop
│  ├─ PostgreSQL Container (Port 5432)
│  │  └─ Database: floneo_db
│  │     ├─ Users table
│  │     ├─ Apps table
│  │     └─ More tables...
│  │
│  ├─ Backend Container (Port 5000)
│  │  └─ Node.js Express Server
│  │     ├─ API endpoints
│  │     ├─ Authentication
│  │     └─ Database connection
│  │
│  └─ Frontend Container (Port 3000)
│     └─ Next.js Application
│        ├─ Login page
│        ├─ Dashboard
│        └─ UI components
│
└─ Your Browser
   └─ http://localhost:3000
      └─ Connects to backend at :5000
         └─ Connects to database at :5432
```

---

## ⏱️ TIMELINE

```
Time    Action                          Status
────────────────────────────────────────────────
0:00    Run docker-compose up           Starting...
0:30    Building images                 In progress...
2:00    Containers created              Running
3:00    Database initializing           Initializing...
4:00    Database ready                  ✅ Ready
4:30    Backend starting                Starting...
5:00    Backend ready                   ✅ Ready
5:30    Frontend starting               Starting...
6:00    Frontend ready                  ✅ Ready
6:30    Open browser                    Loading...
7:00    Login page displays             ✅ Ready
7:30    Enter credentials               Logging in...
8:00    Dashboard displays              ✅ SUCCESS!
```

---

## 🎯 WHAT EACH CONTAINER DOES

### **PostgreSQL Container**
```
┌─────────────────────────────┐
│   PostgreSQL Database       │
├─────────────────────────────┤
│ Port: 5432                  │
│ Database: floneo_db         │
│ User: floneo                │
│ Password: floneo123         │
│                             │
│ Stores:                     │
│ • Users                     │
│ • Applications              │
│ • Workflows                 │
│ • Templates                 │
│ • And more...               │
└─────────────────────────────┘
```

### **Backend Container**
```
┌─────────────────────────────┐
│   Backend API Server        │
├─────────────────────────────┤
│ Port: 5000                  │
│ Framework: Express.js       │
│ Language: Node.js           │
│                             │
│ Provides:                   │
│ • /health endpoint          │
│ • /auth/login endpoint      │
│ • /api/* endpoints          │
│ • Database queries          │
│ • Authentication            │
└─────────────────────────────┘
```

### **Frontend Container**
```
┌─────────────────────────────┐
│   Frontend Application      │
├─────────────────────────────┤
│ Port: 3000                  │
│ Framework: Next.js          │
│ Language: React/TypeScript  │
│                             │
│ Provides:                   │
│ • Login page                │
│ • Dashboard                 │
│ • Applications page         │
│ • Workflow builder          │
│ • User interface            │
└─────────────────────────────┘
```

---

## ✅ SUCCESS INDICATORS

When everything is working, you should see:

```
✅ Terminal shows no errors
✅ docker-compose ps shows all "Up"
✅ Browser loads http://localhost:3000
✅ Login page displays
✅ Can login with demo credentials
✅ Dashboard shows
✅ No red errors in browser console (F12)
```

---

## ❌ COMMON ISSUES & FIXES

### **Issue: "docker-compose: command not found"**
```
Fix: Docker Desktop not installed or not in PATH
Solution: Restart terminal or reinstall Docker
```

### **Issue: "Cannot connect to Docker daemon"**
```
Fix: Docker Desktop not running
Solution: Open Docker Desktop application
```

### **Issue: Containers show "Exited"**
```
Fix: Container crashed
Solution: docker-compose logs (to see error)
         docker-compose restart
```

### **Issue: "Connection refused" on localhost:3000**
```
Fix: Frontend not ready yet
Solution: Wait 30 more seconds
         docker-compose logs frontend
```

### **Issue: Login fails**
```
Fix: Database not seeded
Solution: docker-compose exec backend npx prisma db seed
```

---

## 📞 QUICK HELP

**Check everything is running:**
```bash
docker-compose ps
```

**See what's happening:**
```bash
docker-compose logs -f
```

**Restart everything:**
```bash
docker-compose restart
```

**Start fresh:**
```bash
docker-compose down -v
docker-compose up -d --build
```

---

## 🎉 YOU'RE READY!

Follow the steps above and you'll have FloNeo running in 5-10 minutes!

**Questions?** Check the troubleshooting section or contact the team.

**Happy coding!** 🚀

