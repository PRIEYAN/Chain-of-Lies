# 🚀 Quick Start Guide

## Run Everything with One Command

```bash
./run.sh
```

This script will:
1. ✅ Check if pnpm is installed
2. ✅ Install dependencies if needed
3. ✅ Build shared packages
4. ✅ Start backend server (port 5000)
5. ✅ Start frontend server (port 3000)
6. ✅ Display URLs

## URLs

After running `./run.sh`, you'll see:

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

## Prerequisites

1. **Node.js** 20+ installed
2. **pnpm** installed (`npm install -g pnpm`)
3. **MongoDB** connection string in `apps/api/.env`

## Environment Setup

The script will create `apps/api/.env` automatically, but you need to update it with your MongoDB Atlas connection string.

### Get MongoDB Atlas Connection String

1. Go to https://cloud.mongodb.com/
2. Create a free cluster (or use existing)
3. Click "Connect" → "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your database password
6. Replace `<database>` with `chain-of-lies`

### Update `.env` file:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chain-of-lies?retryWrites=true&w=majority

# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars

# Frontend URL
CLIENT_URL=http://localhost:3000

# Server Port
PORT=5000

# Environment
NODE_ENV=development
```

**Note**: This project uses **MongoDB Atlas only** - no PostgreSQL needed!

## Manual Start (Alternative)

If you prefer to start manually:

```bash
# Terminal 1 - Backend
cd apps/api
pnpm dev

# Terminal 2 - Frontend
cd apps/web
pnpm dev
```

## Troubleshooting

### Backend won't start
- Check `backend.log` for errors
- Verify MongoDB connection string in `.env`
- Ensure port 5000 is not in use

### Frontend won't start
- Check `frontend.log` for errors
- Ensure port 3000 is not in use
- Verify shared packages are built

### Dependencies issues
```bash
# Clean install
rm -rf node_modules packages/*/node_modules apps/*/node_modules
pnpm install
```

## Stopping Servers

Press `Ctrl+C` in the terminal running `./run.sh` to stop both servers.
