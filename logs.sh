#!/bin/bash

# Chain of Lies - Live Logs Viewer
# Shows real-time logs from both backend and frontend

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Chain of Lies - Live Logs Viewer    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Check if log files exist
BACKEND_LOG="backend.log"
FRONTEND_LOG="frontend.log"

if [ ! -f "$BACKEND_LOG" ] && [ ! -f "$FRONTEND_LOG" ]; then
    echo -e "${YELLOW}⚠️  No log files found.${NC}"
    echo "Make sure you've run ./run.sh first to start the servers."
    echo ""
    echo "Log files should be:"
    echo "  - $BACKEND_LOG"
    echo "  - $FRONTEND_LOG"
    exit 1
fi

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Stopping log viewer...${NC}"
    kill $TAIL_PID 2>/dev/null || true
    exit 0
}

trap cleanup SIGINT SIGTERM

# Show which logs are available
echo -e "${CYAN}📋 Available logs:${NC}"
if [ -f "$BACKEND_LOG" ]; then
    echo -e "  ${GREEN}✅${NC} Backend: $BACKEND_LOG"
else
    echo -e "  ${RED}❌${NC} Backend: $BACKEND_LOG (not found)"
fi

if [ -f "$FRONTEND_LOG" ]; then
    echo -e "  ${GREEN}✅${NC} Frontend: $FRONTEND_LOG"
else
    echo -e "  ${RED}❌${NC} Frontend: $FRONTEND_LOG (not found)"
fi
echo ""

# Ask user which logs to view
echo -e "${CYAN}Select logs to view:${NC}"
echo "  1) Backend only"
echo "  2) Frontend only"
echo "  3) Both (side by side)"
echo "  4) Both (merged)"
read -p "Enter choice [1-4] (default: 4): " choice
choice=${choice:-4}

case $choice in
    1)
        if [ ! -f "$BACKEND_LOG" ]; then
            echo -e "${RED}❌ Backend log file not found${NC}"
            exit 1
        fi
        echo -e "${GREEN}📊 Showing backend logs...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        echo ""
        tail -f "$BACKEND_LOG"
        ;;
    2)
        if [ ! -f "$FRONTEND_LOG" ]; then
            echo -e "${RED}❌ Frontend log file not found${NC}"
            exit 1
        fi
        echo -e "${GREEN}📊 Showing frontend logs...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        echo ""
        tail -f "$FRONTEND_LOG"
        ;;
    3)
        if [ ! -f "$BACKEND_LOG" ] || [ ! -f "$FRONTEND_LOG" ]; then
            echo -e "${RED}❌ Both log files are required for side-by-side view${NC}"
            exit 1
        fi
        echo -e "${GREEN}📊 Showing both logs side by side...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        echo ""
        # Use multitail if available, otherwise use a simple split
        if command -v multitail &> /dev/null; then
            multitail -s 2 "$BACKEND_LOG" "$FRONTEND_LOG"
        else
            # Fallback: use tail with colors
            tail -f "$BACKEND_LOG" "$FRONTEND_LOG" | while IFS= read -r line; do
                if [[ "$line" == *"backend.log"* ]]; then
                    echo -e "${BLUE}[BACKEND]${NC} $line"
                elif [[ "$line" == *"frontend.log"* ]]; then
                    echo -e "${CYAN}[FRONTEND]${NC} $line"
                else
                    echo "$line"
                fi
            done
        fi
        ;;
    4)
        echo -e "${GREEN}📊 Showing merged logs (colored by source)...${NC}"
        echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
        echo ""
        
        # Color code by source using named pipes
        if [ -f "$BACKEND_LOG" ] && [ -f "$FRONTEND_LOG" ]; then
            tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null | while IFS= read -r line; do
                if [[ "$line" == *"backend.log"* ]] || [[ "$line" == *"BACKEND"* ]] || [[ "$line" == *"MongoDB"* ]] || [[ "$line" == *"API server"* ]]; then
                    echo -e "${BLUE}[BACKEND]${NC} $line"
                elif [[ "$line" == *"frontend.log"* ]] || [[ "$line" == *"FRONTEND"* ]] || [[ "$line" == *"VITE"* ]]; then
                    echo -e "${CYAN}[FRONTEND]${NC} $line"
                else
                    echo "$line"
                fi
            done
        elif [ -f "$BACKEND_LOG" ]; then
            tail -f "$BACKEND_LOG" | while IFS= read -r line; do
                echo -e "${BLUE}[BACKEND]${NC} $line"
            done
        elif [ -f "$FRONTEND_LOG" ]; then
            tail -f "$FRONTEND_LOG" | while IFS= read -r line; do
                echo -e "${CYAN}[FRONTEND]${NC} $line"
            done
        fi
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac
