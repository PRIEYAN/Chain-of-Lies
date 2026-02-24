# 🔧 Troubleshooting Guide

## WebSocket Connection Issues

### Error: "Firefox can't establish a connection to ws://localhost:5000/socket.io/"

**Possible Causes:**

1. **Backend not running**
   ```bash
   # Check if backend is running
   curl http://localhost:5000/api/health
   
   # Should return: {"status":"healthy","timestamp":"..."}
   ```

2. **Port 5000 not accessible**
   ```bash
   # Check if port is in use
   lsof -i :5000
   # or
   netstat -tulpn | grep 5000
   ```

3. **MongoDB connection failing**
   - Check `backend.log` for MongoDB errors
   - Verify `MONGODB_URI` in `apps/api/.env`
   - Ensure MongoDB Atlas IP whitelist includes your IP

4. **CORS issues**
   - Verify `CLIENT_URL` in `apps/api/.env` matches frontend URL
   - Default should be `http://localhost:3000`

### Fix Steps

1. **Check backend logs:**
   ```bash
   tail -f backend.log
   ```
   
   Look for:
   - ✅ "MongoDB connected successfully"
   - ✅ "Socket.IO server initialized"
   - ✅ "API server running on port 5000"

2. **Verify backend is running:**
   ```bash
   curl http://localhost:5000/api/health
   ```

3. **Check frontend console:**
   - Open browser DevTools → Console
   - Look for socket connection messages
   - Check Network tab → WS filter for WebSocket connections

4. **Test Socket.IO directly:**
   ```bash
   # In browser console:
   const socket = io("http://localhost:5000");
   socket.on("connect", () => console.log("Connected!", socket.id));
   ```

## 500 Internal Server Error on `/api/game/state`

This is a **legacy route** that's not critical. It's been fixed to return empty state instead of 500.

**If you still see 500 errors:**

1. Check backend logs for the actual error
2. The route now returns empty state on error (for backward compatibility)
3. This route is from the old codebase and may not be used by your frontend

## Common Issues

### Backend won't start

**MongoDB connection error:**
```
❌ MongoDB connection error: ...
```

**Fix:**
1. Check `MONGODB_URI` in `apps/api/.env`
2. Verify MongoDB Atlas cluster is running
3. Check IP whitelist in MongoDB Atlas
4. Verify username/password are correct

### Frontend can't connect to backend

**Symptoms:**
- WebSocket timeout
- CORS errors
- 404 on API calls

**Fix:**
1. Ensure backend is running: `curl http://localhost:5000/api/health`
2. Check `CLIENT_URL` in backend `.env` matches frontend URL
3. Verify Vite proxy in `vite.config.ts` is correct
4. Check browser console for specific errors

### Socket connects but immediately disconnects

**Possible causes:**
1. Backend crashes on connection
2. Authentication middleware rejecting connection
3. CORS blocking the connection

**Fix:**
1. Check backend logs for errors when socket connects
2. Verify no authentication middleware blocking Socket.IO
3. Check CORS configuration

## Debug Commands

```bash
# Check if backend is running
curl http://localhost:5000/api/health

# Check backend logs
tail -f backend.log

# Check frontend logs  
tail -f frontend.log

# View all logs
./logs.sh

# Check what's using port 5000
lsof -i :5000

# Check what's using port 3000
lsof -i :3000
```

## Quick Fixes

### Restart everything
```bash
# Stop all processes
pkill -f "tsx watch"  # Backend
pkill -f "vite"       # Frontend

# Start again
./run.sh
```

### Clear and rebuild
```bash
# Clean install
rm -rf node_modules packages/*/node_modules apps/*/node_modules
pnpm install

# Rebuild shared packages
pnpm --filter @tamper-hunt/types build
pnpm --filter @tamper-hunt/shared build

# Start servers
./run.sh
```

## Still Having Issues?

1. Check `backend.log` for detailed error messages
2. Check browser console for frontend errors
3. Verify MongoDB connection string is correct
4. Ensure both servers are running (check ports 3000 and 5000)
5. Check firewall/antivirus isn't blocking connections
