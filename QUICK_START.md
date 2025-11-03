# ⚡ FloNeo - Quick Start (5 Minutes)

**TL;DR** - Get FloNeo running in 5 minutes!

## 🚀 Choose Your Setup Path

- **🐳 Docker (Recommended for Teams)** - Everything in containers, no local setup needed
- **💻 Manual Setup** - Direct installation on your machine

Both paths take ~5 minutes. Pick one below!

## Prerequisites Check

### Option A: Local Setup (Manual)

```bash
node --version    # Should be v18+
npm --version     # Should be v9+
psql --version    # Should be v14+
git --version     # Should be v2+
```

### Option B: Docker Setup (Recommended for Teams)

```bash
docker --version  # Should be v20+
docker-compose --version  # Should be v2+
```

**Don't have Docker?** → [Install Docker Desktop](https://www.docker.com/products/docker-desktop)

### Docker Installation Guide

**Windows/Mac:**

1. Download [Docker Desktop](https://www.docker.com/products/docker-desktop)
2. Run installer and follow prompts
3. Restart your computer
4. Verify: `docker --version`

**Linux (Ubuntu/Debian):**

```bash
sudo apt-get update
sudo apt-get install docker.io docker-compose
sudo usermod -aG docker $USER
# Log out and log back in
```

**Verify Installation:**

```bash
docker --version
docker-compose --version
docker run hello-world  # Should print "Hello from Docker!"
```

## 1️⃣ Clone & Navigate

```bash
git clone https://github.com/prajeesh-floneo/FloNeo.git
cd FloNeo
```

---

## 🐳 DOCKER SETUP (Recommended - 2 minutes)

### Start Everything with Docker

```bash
# From project root
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

✅ **Services running:**

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:3000`
- PostgreSQL: `localhost:5432`

### Verify Docker Setup

```bash
# Check running containers
docker-compose ps

# View backend logs
docker-compose logs backend

# View frontend logs
docker-compose logs frontend

# View database logs
docker-compose logs db
```

### Access Services

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api/health
- **Database:** psql -h localhost -U floneo_user -d floneo_db

### Stop & Clean Up

```bash
# Stop all services
docker-compose down

# Remove volumes (WARNING: deletes database)
docker-compose down -v

# Rebuild images
docker-compose build --no-cache
```

---

## 2️⃣ Backend Setup (2 minutes - Manual Only)

```bash
cd server
npm install

# Create .env file
cp .env.example .env

# Edit .env - set DATABASE_URL to your PostgreSQL connection
# Example: postgresql://postgres:password@localhost:5432/floneo_db

# Setup database
npm run prisma:generate
npm run prisma:migrate

# Start backend
npm run dev
```

✅ Backend running at `http://localhost:5000`

## 3️⃣ Frontend Setup (2 minutes)

```bash
# From project root
cd client
npm install

# Create .env.local
cat > .env.local << EOF
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
EOF

# Start frontend
npm run dev
```

✅ Frontend running at `http://localhost:3000`

## 4️⃣ Verify Everything Works

1. Open `http://localhost:3000` in browser
2. You should see the FloNeo login page
3. Check browser console (F12) - no errors?
4. Test API: `curl http://localhost:5000/api/health`

## 🎉 Done!

You're ready to start building with FloNeo!

---

## 🆘 Quick Troubleshooting

### Docker Issues

| Problem                    | Solution                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| Docker not installed       | [Download Docker Desktop](https://www.docker.com/products/docker-desktop) |
| Port already in use        | `docker-compose down` then `docker-compose up -d`                         |
| Container won't start      | `docker-compose logs` to see errors                                       |
| Database connection failed | `docker-compose restart db`                                               |
| Permission denied          | Run with `sudo` or add user to docker group                               |

### Manual Setup Issues

| Problem             | Solution                             |
| ------------------- | ------------------------------------ |
| Port 5000 in use    | `npm run dev -- --port 5001`         |
| Port 3000 in use    | `npm run dev -- -p 3001`             |
| DB connection error | Check DATABASE_URL in `.env`         |
| Module not found    | `rm -rf node_modules && npm install` |
| Prisma error        | `npm run prisma:generate`            |

---

## 📚 Full Documentation

- **Detailed Setup:** See [GETTING_STARTED.md](./GETTING_STARTED.md)
- **Advanced Setup:** See [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- **Project Info:** See [README.md](./README.md)

---

## 🚀 Next Steps

1. **Explore the UI** - Create your first app
2. **Read the code** - Check `server/routes/` and `client/app/`
3. **Run tests** - `cd server && npm test`
4. **Build something** - Start coding!

Happy coding! 🎨
