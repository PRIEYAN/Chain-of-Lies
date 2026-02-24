# 📁 Where to Put Your .env File

## Location

**Put the `.env` file here:**

```
apps/api/.env
```

## Why Here?

The backend server (`apps/api`) reads environment variables from `apps/api/.env` when it starts.

## Quick Setup

### Option 1: Use the run.sh script (Recommended)

```bash
./run.sh
```

The script will automatically create `apps/api/.env` if it doesn't exist.

### Option 2: Manual Setup

1. Copy the example file:
```bash
cp apps/api/.env.example apps/api/.env
```

2. Edit `apps/api/.env` and update:
   - `MONGODB_URI` - Your MongoDB Atlas connection string
   - `JWT_SECRET` - A strong random string (32+ characters)

## File Structure

```
Chain-of-Lies/
├── apps/
│   ├── api/
│   │   ├── .env          ← PUT YOUR ENV FILE HERE
│   │   ├── .env.example  ← Template (already created)
│   │   └── src/
│   └── web/
│       └── (no .env needed for frontend)
```

## Environment Variables Needed

```env
# MongoDB Atlas (REQUIRED)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chain-of-lies

# JWT Secret (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Optional (has defaults)
CLIENT_URL=http://localhost:3000
PORT=5000
NODE_ENV=development
```

## Why No PostgreSQL?

The `.env.example` might mention PostgreSQL because:
1. **Legacy code** - The original codebase had PostgreSQL/Drizzle
2. **Not used** - All new game logic uses MongoDB Atlas only
3. **Ignore it** - You don't need `DATABASE_URL` or any PostgreSQL variables

## Verify It's Working

After creating `apps/api/.env` and starting the server, you should see:

```
✅ MongoDB connected successfully
```

If you see PostgreSQL errors, it means old legacy code is trying to run. Check that:
- `apps/api/src/main.ts` only imports MongoDB (not PostgreSQL)
- No code is importing from `infrastructure/database/connection.ts`

## Security Note

**Never commit `.env` to git!**

The `.env` file is already in `.gitignore`, so it won't be committed. Only commit `.env.example` as a template.
