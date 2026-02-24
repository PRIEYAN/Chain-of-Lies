# Quick Start Implementation Guide

## 📦 Setup

### 1. Install Dependencies

```bash
cd apps/api
pnpm add mongoose ethers jsonwebtoken swagger-ui-express swagger-jsdoc
pnpm add -D @types/jsonwebtoken @types/swagger-ui-express @types/swagger-jsdoc
```

### 2. Environment Variables

Add to `.env`:
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chain-of-lies
JWT_SECRET=your-super-secret-jwt-key-change-in-production
NODE_ENV=development
```

### 3. Initialize MongoDB Connection

Update `apps/api/src/main.ts`:
```typescript
import { connectMongoDB } from "./infrastructure/database/mongodb";

async function bootstrap() {
  // Connect MongoDB
  await connectMongoDB();
  
  // ... rest of initialization
}
```

## 🚀 Implementation Order

### Step 1: Complete Backend Services

1. **Room Service** (`modules/room/services/room.service.ts`)
   - Create room
   - Join room
   - Start game (calls gameService.startGame)

2. **Task Service** (`modules/task/services/task.service.ts`)
   - Get player tasks
   - Complete task (calls gameService methods)
   - Verify task proximity

3. **Meeting Service** (`modules/meeting/services/meeting.service.ts`)
   - Send message
   - Generate reference sentences
   - Auto-end after 60 seconds

### Step 2: Create Controllers & Routes

Follow this pattern for each module:

```typescript
// modules/game/controllers/game.controller.ts
import { Request, Response } from "express";
import { gameService } from "../services/game.service";

export class GameController {
  async startGame(req: Request, res: Response) {
    try {
      const { roomId } = req.body;
      const game = await gameService.startGame(roomId);
      res.json(game);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

export const gameController = new GameController();
```

```typescript
// modules/game/routes/game.routes.ts
import { Router } from "express";
import { gameController } from "../controllers/game.controller";
import { authenticateJWT } from "../../auth/middlewares/jwt.middleware";

const router = Router();

router.post("/start", authenticateJWT, gameController.startGame.bind(gameController));

export { router as gameRoutes };
```

### Step 3: Register Routes

Update `apps/api/src/main.ts`:
```typescript
import { gameRoutes } from "./modules/game/routes/game.routes";
import { authRoutes } from "./modules/auth/routes/auth.routes";
// ... other routes

app.use("/api/game", gameRoutes);
app.use("/api/auth", authRoutes);
```

### Step 4: Extend Socket Handlers

Update `apps/api/src/infrastructure/websocket/socketio-server.ts`:

```typescript
import { gameService } from "../../modules/game/services/game.service";
import { roomService } from "../../modules/room/services/room.service";
import { taskService } from "../../modules/task/services/task.service";
import { meetingService } from "../../modules/meeting/services/meeting.service";
import { voteService } from "../../modules/vote/services/vote.service";

// Add to socket connection handler:

socket.on("start_game", async () => {
  const partyId = socketToParty.get(socket.id);
  if (!partyId) return;
  
  const party = parties.get(partyId);
  if (!party || party.hostId !== socket.id) return;
  
  try {
    // Convert party to room (or use existing room)
    const game = await gameService.startGame(roomId);
    
    // Emit role to each player
    Object.entries(party.players).forEach(([playerId, player]) => {
      const role = player.role || "CREWMATE";
      io.to(playerId).emit("role_assigned", { role });
      
      // Emit word to crewmates only
      if (role === "CREWMATE") {
        io.to(playerId).emit("word_update", {
          encryptedWord: game.encryptedWord,
        });
      }
    });
    
    io.to(party.partyCode).emit("game_started");
  } catch (error: any) {
    socket.emit("error", { message: error.message });
  }
});

socket.on("task_completed", async (data: { taskId: string }) => {
  // Verify phase, role, task ownership
  // Call appropriate service method
  // Emit updates
});

socket.on("meeting_message", async (data: { message: string }) => {
  // Verify phase = MEETING
  // Call meetingService.sendMessage()
  // Emit to all players
});

socket.on("vote", async (data: { votedFor?: string; isSkip: boolean }) => {
  // Verify phase = VOTING
  // Call voteService.castVote()
  // If all voted, tally and check win conditions
});
```

### Step 5: Update Frontend

1. **Socket Event Listeners** (`apps/web/src/hooks/useGameSocket.ts`):

```typescript
useEffect(() => {
  socket.on("role_assigned", (data) => {
    useGameStore.getState().setRole(data.role);
  });
  
  socket.on("word_update", (data) => {
    useGameStore.getState().setEncryptedWord(data.encryptedWord);
    if (data.decryptedPercentage !== undefined) {
      useGameStore.getState().setDecryptedPercentage(data.decryptedPercentage);
    }
  });
  
  socket.on("meeting_started", () => {
    useGameStore.getState().startMeeting();
    // Start 60-second timer
    let time = 60;
    const timer = setInterval(() => {
      time--;
      useGameStore.getState().updateMeetingTimer(time);
      if (time <= 0) {
        clearInterval(timer);
      }
    }, 1000);
  });
  
  socket.on("voting_started", (data) => {
    useGameStore.getState().startVoting(data.candidates);
  });
  
  socket.on("game_ended", (data) => {
    useGameStore.getState().endGame(data.winner);
  });
  
  return () => {
    socket.off("role_assigned");
    socket.off("word_update");
    // ... cleanup
  };
}, []);
```

2. **UI Components** - Create role-based rendering:
   - Role reveal screen
   - Word display (crewmates only)
   - Task list (filtered by role)
   - Meeting chat
   - Voting interface

## 🧪 Testing

### Manual Test Flow

1. **Create Room**
   ```bash
   # Use Postman or curl
   POST http://localhost:5000/api/room/create
   Body: { "name": "TestPlayer" }
   ```

2. **Join Room** (from another client)
   ```bash
   POST http://localhost:5000/api/room/join
   Body: { "roomCode": "ABC123", "name": "Player2" }
   ```

3. **Start Game** (as host)
   ```bash
   POST http://localhost:5000/api/game/start
   Body: { "roomId": "..." }
   ```

4. **Complete Task**
   ```bash
   POST http://localhost:5000/api/task/complete
   Body: { "taskId": "..." }
   ```

5. **Send Meeting Message**
   ```bash
   POST http://localhost:5000/api/meeting/message
   Body: { "message": "I saw red vent" }
   ```

6. **Cast Vote**
   ```bash
   POST http://localhost:5000/api/vote/cast
   Body: { "votedFor": "playerId", "isSkip": false }
   ```

## 📝 Next Steps

1. Implement remaining services (room, task, meeting)
2. Create all controllers and routes
3. Add JWT middleware
4. Extend socket handlers
5. Build frontend UI components
6. Add Swagger documentation
7. Test end-to-end
8. Add error handling
9. Performance optimization

## 🔗 Key Files Reference

- **Models**: `apps/api/src/modules/*/models/*.model.ts`
- **Services**: `apps/api/src/modules/*/services/*.service.ts`
- **Controllers**: `apps/api/src/modules/*/controllers/*.controller.ts`
- **Routes**: `apps/api/src/modules/*/routes/*.routes.ts`
- **Socket**: `apps/api/src/infrastructure/websocket/socketio-server.ts`
- **Frontend Store**: `apps/web/src/stores/useGameStore.ts`
- **Architecture**: `GAME_LOGIC_ARCHITECTURE.md`
- **Status**: `IMPLEMENTATION_STATUS.md`
