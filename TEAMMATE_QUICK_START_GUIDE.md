# 🚀 TEAMMATE QUICK START GUIDE - FloNeo Docker Setup

**For:** Your teammate at `C:\Users\azhab\Downloads\FloNeo`  
**Time Required:** 10 minutes  
**Difficulty:** Easy  

---

## 📋 BEFORE YOU START

Make sure you have:
- ✅ Docker Desktop installed and running
- ✅ Git installed
- ✅ The FloNeo repository cloned
- ✅ Terminal/Command Prompt open

---

## ✅ STEP 1: PULL LATEST CODE (1 minute)

**What to do:**
```bash
cd C:\Users\azhab\Downloads\FloNeo
git pull origin main
```

**What you should see:**
```
Already up to date.
```
or
```
Updating abc123..def456
Fast-forward
 ...
```

**✅ Success:** No errors shown  
**❌ Problem:** If you see errors, contact the team

---

## ✅ STEP 2: CLEAN DOCKER (2 minutes)

**What to do:**
```bash
docker-compose down -v
```

**What you should see:**
```
Removing floneo-backend ...
Removing floneo-frontend ...
Removing floneo-postgres ...
Removing network floneo-network ...
Removing volume postgres_data ...
```

**✅ Success:** All services removed  
**❌ Problem:** If you see "command not found", Docker Desktop is not running

---

## ✅ STEP 3: START DOCKER DESKTOP

**What to do:**
1. Open Docker Desktop application
2. Wait for it to fully start (you'll see the Docker icon in taskbar)
3. Wait 30 seconds for it to be ready

**How to verify:**
```bash
docker ps
```

**What you should see:**
```
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

**✅ Success:** Command runs without errors  
**❌ Problem:** If you see "Cannot connect to Docker daemon", Docker Desktop is not running

---

## ✅ STEP 4: BUILD AND START CONTAINERS (5 minutes)

**What to do:**
```bash
docker-compose up -d --build
```

**What you should see:**
```
Building backend
Building frontend
Creating floneo-postgres ...
Creating floneo-backend ...
Creating floneo-frontend ...
```

**Wait for it to complete** - This takes about 5 minutes

**✅ Success:** All services created  
**❌ Problem:** If you see errors, check troubleshooting section

---

## ✅ STEP 5: WAIT FOR DATABASE (2 minutes)

**What to do:**
```bash
# Wait 60 seconds for database to initialize
timeout 60
```

Or just wait 1 minute manually.

**Why:** PostgreSQL needs time to start and initialize

**✅ Success:** 60 seconds passed  
**❌ Problem:** If you see errors, wait longer

---

## ✅ STEP 6: VERIFY CONTAINERS ARE RUNNING (1 minute)

**What to do:**
```bash
docker-compose ps
```

**What you should see:**
```
NAME              STATUS
floneo-postgres   Up (healthy)
floneo-backend    Up (healthy)
floneo-frontend   Up
```

**✅ Success:** All 3 containers show "Up"  
**❌ Problem:** If any show "Exited", see troubleshooting

---

## ✅ STEP 7: TEST BACKEND (1 minute)

**What to do:**
```bash
curl http://localhost:5000/health
```

**What you should see:**
```json
{"status":"ok","timestamp":"2025-11-03T12:50:00.000Z"}
```

**✅ Success:** JSON response with "status":"ok"  
**❌ Problem:** If you see "Connection refused", backend is not ready

---

## ✅ STEP 8: OPEN FRONTEND IN BROWSER (1 minute)

**What to do:**
1. Open your web browser (Chrome, Firefox, Edge, etc.)
2. Go to: `http://localhost:3000`
3. Wait for page to load

**What you should see:**
- FloNeo logo
- Login form
- Email and password fields
- "Login" button

**✅ Success:** Login page displays  
**❌ Problem:** If page doesn't load, see troubleshooting

---

## ✅ STEP 9: LOGIN WITH DEMO ACCOUNT (1 minute)

**What to do:**
1. In the email field, type: `demo@example.com`
2. In the password field, type: `Demo123!@#`
3. Click the "Login" button
4. Wait for page to load

**What you should see:**
- Page redirects to dashboard
- You see "My Applications" section
- You see templates
- No error messages

**✅ Success:** Dashboard loads  
**❌ Problem:** If login fails, see troubleshooting

---

## ✅ STEP 10: VERIFY DASHBOARD (1 minute)

**What to do:**
1. Look at the dashboard
2. Open browser DevTools (Press F12)
3. Go to "Console" tab
4. Look for any red error messages

**What you should see:**
- Dashboard with applications section
- Templates visible
- Console tab shows no red errors
- Only normal logs

**✅ Success:** Dashboard fully functional  
**❌ Problem:** If you see red errors, see troubleshooting

---

## 🎉 YOU'RE DONE!

**Congratulations!** Your FloNeo Docker environment is running successfully!

You can now:
- ✅ Create new applications
- ✅ Build workflows
- ✅ Test features
- ✅ Start developing

---

## ❌ TROUBLESHOOTING

### **Problem: "docker-compose: command not found"**
**Solution:**
1. Make sure Docker Desktop is installed
2. Restart your terminal
3. Try again

### **Problem: "Cannot connect to Docker daemon"**
**Solution:**
1. Open Docker Desktop application
2. Wait 30 seconds for it to start
3. Try again

### **Problem: Containers show "Exited"**
**Solution:**
```bash
# Check what went wrong
docker-compose logs

# Restart containers
docker-compose restart

# If still failing, rebuild
docker-compose down -v
docker-compose up -d --build
```

### **Problem: Backend not responding (Connection refused)**
**Solution:**
```bash
# Wait a bit longer
sleep 30

# Check backend logs
docker-compose logs backend

# Restart backend
docker-compose restart backend
```

### **Problem: Frontend page doesn't load**
**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Refresh page (Ctrl+R)
3. Try different browser
4. Check frontend logs: `docker-compose logs frontend`

### **Problem: Login fails**
**Solution:**
```bash
# Seed database with demo user
docker-compose exec backend npx prisma db seed

# Check backend logs
docker-compose logs backend

# Try login again
```

### **Problem: See errors in browser console**
**Solution:**
1. Check backend logs: `docker-compose logs backend`
2. Check frontend logs: `docker-compose logs frontend`
3. Restart all services: `docker-compose restart`

---

## 📞 QUICK COMMANDS REFERENCE

```bash
# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop everything
docker-compose down

# Start everything
docker-compose up -d

# Rebuild everything
docker-compose down -v
docker-compose up -d --build

# Check backend health
curl http://localhost:5000/health

# Access database
docker-compose exec postgres psql -U floneo -d floneo_db
```

---

## ✅ FINAL CHECKLIST

Before you start developing, verify:

- [ ] All 3 containers running (`docker-compose ps`)
- [ ] Backend responding (`curl http://localhost:5000/health`)
- [ ] Frontend loads (`http://localhost:3000`)
- [ ] Can login with demo@example.com / Demo123!@#
- [ ] Dashboard displays
- [ ] No console errors (F12 → Console)

---

## 🎯 NEXT STEPS

Once everything is working:

1. **Explore the Dashboard**
   - Click on applications
   - View templates
   - Understand the UI

2. **Create Your First App**
   - Click "Create Application"
   - Give it a name
   - Start building

3. **Build Workflows**
   - Add workflow blocks
   - Connect them
   - Test functionality

4. **Start Developing**
   - Use the platform
   - Test features
   - Report any issues

---

## 📞 NEED HELP?

If you get stuck:

1. **Check this guide** - Most issues are covered
2. **Check the logs** - `docker-compose logs -f`
3. **Try troubleshooting** - See section above
4. **Contact the team** - With error messages and logs

---

**Happy coding!** 🚀

Your FloNeo Docker environment is ready to use!

