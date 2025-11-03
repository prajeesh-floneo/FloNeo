# 🚀 FloNeo - Low-Code No-Code Platform

FloNeo is a comprehensive low-code/no-code platform that enables developers to create applications through an intuitive drag-and-drop canvas interface with real-time collaboration features.

## ✨ Features

- **🎨 Visual Canvas Editor**: Drag-and-drop interface for building applications
- **🔄 Real-time Collaboration**: Multi-user editing with Socket.io
- **📱 Responsive Design**: Mobile-first approach with Tailwind CSS
- **🔐 JWT Authentication**: Secure user authentication system
- **📊 PostgreSQL Database**: Robust data persistence with Prisma ORM
- **📋 Template System**: Pre-built templates including Insurance Premium Calculator
- **📁 File Management**: Upload and manage media files
- **🧪 Comprehensive Testing**: Jest test suite with 90%+ coverage

## 🏗️ Architecture

```
FloNeo/
├── client/          # Next.js 14 Frontend (TypeScript)
│   ├── app/         # App Router pages
│   ├── components/  # Reusable React components
│   └── lib/         # Utilities and configurations
└── server/          # Express.js Backend (Node.js)
    ├── routes/      # API endpoints
    ├── middleware/  # Authentication & validation
    ├── prisma/      # Database schema & migrations
    └── utils/       # Helper functions
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/yourusername/floneo.git
cd floneo
```

### 2. Backend Setup

```bash
cd server
npm install

# Copy environment template
cp .env.example .env
# Edit .env with your database credentials and JWT secrets

# Setup database
npm run prisma:generate
npm run prisma:migrate

# Create demo user (optional)
node create-demo-user.js

# Start backend server
npm start
```

### 3. Frontend Setup

```bash
cd ../client
npm install

# Copy environment template
cp .env.example .env.local
# Edit .env.local with your API URLs

# Start frontend development server
npm run dev
```

### 4. Access Application

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Documentation: http://localhost:5000/api-docs

## 🐳 Docker Setup

### Prerequisites

- Docker Desktop installed and running
- Docker Compose installed

### Quick Start with Docker

1. **Clone and navigate to project:**

   ```bash
   git clone https://github.com/yourusername/floneo.git
   cd floneo
   ```

2. **Create client environment file:**

   ```bash
   cd client
   cp .env.example .env.local
   cd ..
   ```

3. **Build and start services:**

   ```bash
   docker-compose build --no-cache
   docker-compose up
   ```

4. **Wait for services to initialize:**

   - Watch logs for "FloNeo LCNC Platform API running"
   - Database migrations run automatically
   - Takes 30-60 seconds on first run

5. **Access application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - API Health: http://localhost:5000/health

### Docker Troubleshooting

**Check service status:**

```bash
docker-compose ps
```

**View logs:**

```bash
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

**Reset everything:**

```bash
docker-compose down -v
docker-compose up --build
```

**Run database migrations manually:**

```bash
docker-compose exec backend npx prisma migrate deploy
```

## 🔧 Environment Variables

### Backend (.env)

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/floneo_db"
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
NODE_ENV="development"
PORT="5000"
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000
```

## 📚 API Documentation

The API is documented using Swagger/OpenAPI. Access the interactive documentation at:

- Development: http://localhost:5000/api-docs
- View `server/swagger.yaml` for the complete API specification

## 🧪 Testing

```bash
# Backend tests
cd server
npm test
npm run test:coverage

# Frontend tests (if configured)
cd client
npm test
```

## 🚀 Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Deploy backend with PostgreSQL addon
3. Deploy frontend with environment variables
4. Configure custom domains

### Vercel + Railway

1. Deploy backend to Railway with PostgreSQL
2. Deploy frontend to Vercel
3. Configure environment variables

See detailed deployment instructions below.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation in `/server/docs/`
- Review the API documentation

---

**Built with ❤️ using Next.js, Express.js, PostgreSQL, and modern web technologies.**
