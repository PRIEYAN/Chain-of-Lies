
#!/bin/bash

# Chain of Lies - Startup Script
# Starts backend and frontend servers

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Chain of Lies - Starting Servers   ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo -e "${RED}❌ pnpm is not installed${NC}"
    echo "Install it with: npm install -g pnpm"
    exit 1
fi

# Check if .env file exists
if [ ! -f "apps/api/.env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found in apps/api/${NC}"
    echo "Creating .env.example template..."
    cat > apps/api/.env << EOF
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/chain-of-lies?retryWrites=true&w=majority

# JWT Secret for authentication
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars

# Frontend URL
CLIENT_URL=http://localhost:3000

# Server Port
PORT=5000

# Environment
NODE_ENV=development
EOF
    echo -e "${YELLOW}⚠️  Created apps/api/.env - Please update with your MongoDB Atlas URI and JWT secret${NC}"
    echo ""
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    pnpm install
    echo ""
fi

# Build shared packages if needed
if [ ! -d "packages/types/dist" ] || [ ! -d "packages/shared/dist" ]; then
    echo -e "${YELLOW}🔨 Building shared packages...${NC}"
    pnpm --filter @tamper-hunt/types build
    pnpm --filter @tamper-hunt/shared build
    echo ""
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down servers...${NC}"
    kill $API_PID $WEB_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Start backend server
echo -e "${GREEN}🚀 Starting backend server (port 5000)...${NC}"
cd apps/api
pnpm dev > ../backend.log 2>&1 &
API_PID=$!
cd ../..

# Wait for backend to start
sleep 3

# Check if backend started successfully
if ! kill -0 $API_PID 2>/dev/null; then
    echo -e "${RED}❌ Backend failed to start. Check backend.log for errors${NC}"
    exit 1
fi

# Start frontend server
echo -e "${GREEN}🚀 Starting frontend server (port 3000)...${NC}"
cd apps/web
pnpm dev > ../frontend.log 2>&1 &
WEB_PID=$!
cd ../..

# Wait for frontend to start
sleep 3

# Check if frontend started successfully
if ! kill -0 $WEB_PID 2>/dev/null; then
    echo -e "${RED}❌ Frontend failed to start. Check frontend.log for errors${NC}"
    kill $API_PID 2>/dev/null || true
    exit 1
fi

# Display URLs
echo ""
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║        ✅ Servers Started!             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}🌐 Frontend:${NC} ${GREEN}http://localhost:3000${NC}"
echo -e "${BLUE}🔌 Backend API:${NC} ${GREEN}http://localhost:5000${NC}"
echo -e "${BLUE}❤️  Health Check:${NC} ${GREEN}http://localhost:5000/api/health${NC}"
echo ""
echo -e "${YELLOW}📝 View Logs:${NC}"
echo "   Quick:    ./logs.sh"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all servers${NC}"
echo ""

# Wait for processes
wait $API_PID $WEB_PID
