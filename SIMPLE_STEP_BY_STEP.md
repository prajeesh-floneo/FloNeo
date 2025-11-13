# 🎯 SIMPLE STEP-BY-STEP - FloNeo Docker (5 MINUTES)

**Just follow these 5 simple steps!**

---

## STEP 1️⃣: OPEN TERMINAL

Open Command Prompt or PowerShell and go to your FloNeo folder:

```bash
cd C:\Users\azhab\Downloads\FloNeo
```

---

## STEP 2️⃣: PULL LATEST CODE

Get the latest fixes:

```bash
git pull origin main
```

**Expected:** Shows "Already up to date" or updates files

---

## STEP 3️⃣: START DOCKER

Run this command:

```bash
docker-compose up -d --build
```

**What happens:**
- Downloads images
- Builds containers
- Starts all services
- Takes about 5 minutes

**Wait until you see:**
```
Creating floneo-postgres ...
Creating floneo-backend ...
Creating floneo-frontend ...
```

---

## STEP 4️⃣: WAIT 60 SECONDS

Just wait 1 minute for database to initialize.

You can check progress:
```bash
docker-compose ps
```

**Look for:**
```
floneo-postgres   Up (healthy)
floneo-backend    Up (healthy)
floneo-frontend   Up
```

---

## STEP 5️⃣: OPEN BROWSER

Open your web browser and go to:

```
http://localhost:3000
```

**You should see:**
- FloNeo login page
- Email field
- Password field
- Login button

---

## STEP 6️⃣: LOGIN

Enter these credentials:

```
Email: demo@example.com
Password: Demo123!@#
```

Click "Login"

**You should see:**
- Dashboard page
- My Applications section
- Templates

---

## ✅ DONE!

Your FloNeo is now running! 🎉

You can now:
- Create applications
- Build workflows
- Test features
- Start developing

---

## ❌ SOMETHING WENT WRONG?

### **Containers not starting?**
```bash
docker-compose logs
```

### **Backend not responding?**
```bash
docker-compose restart backend
```

### **Frontend not loading?**
- Clear browser cache (Ctrl+Shift+Delete)
- Refresh page (Ctrl+R)

### **Login fails?**
```bash
docker-compose exec backend npx prisma db seed
```

### **Still stuck?**
```bash
# Nuclear option - restart everything
docker-compose down -v
docker-compose up -d --build
# Wait 60 seconds
# Try again
```

---

## 📞 QUICK REFERENCE

| What | Command |
|------|---------|
| Check status | `docker-compose ps` |
| View logs | `docker-compose logs -f` |
| Restart | `docker-compose restart` |
| Stop | `docker-compose down` |
| Start | `docker-compose up -d` |
| Rebuild | `docker-compose down -v && docker-compose up -d --build` |

---

**That's it! Enjoy FloNeo!** 🚀

