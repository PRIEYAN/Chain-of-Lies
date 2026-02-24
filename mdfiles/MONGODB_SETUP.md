# MongoDB Atlas Setup Guide

## ✅ This Project Uses MongoDB Atlas ONLY

**No PostgreSQL needed!** All game data is stored in MongoDB Atlas.

## Quick Setup

### 1. Get MongoDB Atlas Connection String

1. Go to https://cloud.mongodb.com/
2. Sign up for free (or log in)
3. Create a new cluster (Free tier M0 is fine)
4. Click "Connect" → "Connect your application"
5. Copy the connection string
6. It looks like: `mongodb+srv://username:password@cluster.mongodb.net/`

### 2. Update `.env` File

The `run.sh` script will create `apps/api/.env` automatically, but you need to update it:

```env
# Replace with your MongoDB Atlas connection string
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chain-of-lies?retryWrites=true&w=majority

# Generate a strong JWT secret (32+ characters)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars

# Frontend URL
CLIENT_URL=http://localhost:3000

# Server Port
PORT=5000

# Environment
NODE_ENV=development
```

### 3. Create Database User

In MongoDB Atlas:
1. Go to "Database Access"
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create username and password
5. Use these credentials in your connection string

### 4. Whitelist IP Address

1. Go to "Network Access"
2. Click "Add IP Address"
3. For development, click "Allow Access from Anywhere" (0.0.0.0/0)
4. For production, add specific IPs

## Database Collections

The following collections will be created automatically when you start the game:

- `users` - User accounts (wallet addresses)
- `rooms` - Game rooms/lobbies
- `games` - Active games
- `wordbanks` - Secret words (you need to seed this)
- `tasks` - Task assignments
- `meetings` - Meeting chat messages
- `votes` - Voting records
- `gamelogs` - Game event logs

## Seed WordBank

You need to manually add words to the `wordbanks` collection:

```javascript
// In MongoDB Compass or mongo shell
db.wordbanks.insertMany([
  { word: "BLOCKCHAIN", category: "tech" },
  { word: "CRYPTOGRAPHY", category: "tech" },
  { word: "DECENTRALIZED", category: "tech" },
  { word: "CONSENSUS", category: "tech" },
  { word: "VALIDATOR", category: "tech" },
  { word: "MERKLE", category: "tech" },
  { word: "HASH", category: "tech" },
  { word: "NONCE", category: "tech" },
  { word: "LEDGER", category: "tech" },
  { word: "NODE", category: "tech" },
  // Add more words...
]);
```

Or use MongoDB Compass to insert documents manually.

## Verify Connection

After starting the server, check the logs:

```
✅ MongoDB connected successfully
```

If you see connection errors, check:
- Connection string format
- Username/password are correct
- IP address is whitelisted
- Network connectivity

## Legacy PostgreSQL Code

The files `connection.ts` and `schema.ts` in `infrastructure/database/` are **legacy code** from the original codebase. They are **NOT used** and are kept only for backward compatibility.

**Active database code:**
- `infrastructure/database/mongodb.ts` - MongoDB connection
- `modules/*/models/*.model.ts` - Mongoose models
