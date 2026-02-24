# Implementation Status

## ✅ Completed

### 1. Database Models (MongoDB + Mongoose)
- ✅ User model (`modules/auth/models/user.model.ts`)
- ✅ Room model (`modules/room/models/room.model.ts`)
- ✅ Game model (`modules/game/models/game.model.ts`)
- ✅ WordBank model (`modules/game/models/wordbank.model.ts`)
- ✅ Task model (`modules/task/models/task.model.ts`)
- ✅ Meeting model (`modules/meeting/models/meeting.model.ts`)
- ✅ Vote model (`modules/vote/models/vote.model.ts`)
- ✅ GameLog model (`modules/shared/models/log.model.ts`)
- ✅ MongoDB connection setup (`infrastructure/database/mongodb.ts`)

### 2. Core Game Logic
- ✅ Encryption/Decryption utilities (`modules/game/utils/encryption.util.ts`)
- ✅ Game Service with:
  - Role assignment (random imposter selection)
  - Word management (random selection from WordBank)
  - Task creation (15 crew + 10 imposter tasks)
  - Crew task completion (encrypts word by 10%)
  - Imposter task completion (decrypts word by 10%)
  - Meeting phase management
  - Win condition checking
  - In-memory state management

### 3. Documentation
- ✅ Complete architecture document (`GAME_LOGIC_ARCHITECTURE.md`)
- ✅ Implementation status (this file)

## 🚧 To Be Implemented

### Backend Services

#### Auth Service (`modules/auth/services/auth.service.ts`)
```typescript
class AuthService {
  async generateNonce(walletAddress: string): Promise<string>
  async verifySignature(walletAddress: string, signature: string): Promise<{ token: string, user: IUser }>
  async verifyJWT(token: string): Promise<{ userId: string }>
}
```

#### Room Service (`modules/room/services/room.service.ts`)
```typescript
class RoomService {
  async createRoom(hostId: Types.ObjectId, hostName: string): Promise<IRoom>
  async joinRoom(roomCode: string, userId: Types.ObjectId, socketId: string): Promise<IRoom>
  async startGame(roomId: Types.ObjectId): Promise<IGame>
  async getRoom(roomId: Types.ObjectId): Promise<IRoom>
}
```

#### Task Service (`modules/task/services/task.service.ts`)
```typescript
class TaskService {
  async getPlayerTasks(gameId: Types.ObjectId, playerId: Types.ObjectId): Promise<ITask[]>
  async completeTask(taskId: Types.ObjectId, playerId: Types.ObjectId): Promise<void>
  async verifyTaskProximity(taskId: Types.ObjectId, playerX: number, playerY: number): Promise<boolean>
}
```

#### Meeting Service (`modules/meeting/services/meeting.service.ts`)
```typescript
class MeetingService {
  async sendMessage(gameId: Types.ObjectId, playerId: Types.ObjectId, message: string): Promise<void>
  async getMeetingMessages(gameId: Types.ObjectId): Promise<IMeetingMessage[]>
  async generateReferenceSentence(role: "CREWMATE" | "IMPOSTER"): Promise<string>
}
```

#### Vote Service (`modules/vote/services/vote.service.ts`)
```typescript
class VoteService {
  async castVote(gameId: Types.ObjectId, voterId: Types.ObjectId, votedFor?: Types.ObjectId, isSkip?: boolean): Promise<void>
  async tallyVotes(gameId: Types.ObjectId): Promise<{ eliminated?: Types.ObjectId, voteBreakdown: Record<string, number> }>
  async hasVoted(gameId: Types.ObjectId, voterId: Types.ObjectId): Promise<boolean>
}
```

### Controllers & Routes

Each module needs:
- Controller (handles HTTP requests)
- Routes (defines endpoints)
- DTOs (request/response validation with Zod)

Example pattern:
```typescript
// modules/game/controllers/game.controller.ts
export class GameController {
  async startGame(req: Request, res: Response) {
    const { roomId } = req.body;
    const game = await gameService.startGame(roomId);
    res.json(game);
  }
}

// modules/game/routes/game.routes.ts
router.post("/start", authenticateJWT, gameController.startGame);
```

### Socket Event Handlers

Extend `infrastructure/websocket/socketio-server.ts`:

```typescript
// Add to existing socket handlers:

socket.on("start_game", async (data) => {
  // Verify host
  // Call gameService.startGame()
  // Emit "role_assigned" to each player
  // Emit "word_update" to crewmates
});

socket.on("task_completed", async (data) => {
  // Verify phase = "TASKS"
  // Call gameService.completeCrewTask() or completeImposterTask()
  // Emit "task_update" to all
  // If meeting triggered, emit "meeting_started"
});

socket.on("meeting_message", async (data) => {
  // Verify phase = "MEETING"
  // Call meetingService.sendMessage()
  // Emit "meeting_message" to all
});

socket.on("vote", async (data) => {
  // Verify phase = "VOTING"
  // Call voteService.castVote()
  // When all voted, call voteService.tallyVotes()
  // Emit "voting_results"
  // Check win conditions
});
```

### Frontend Updates

#### Zustand Store Extension (`apps/web/src/stores/useGameStore.ts`)

Add to existing store:
```typescript
interface GameState {
  // ... existing fields ...
  
  // New fields:
  role: "CREWMATE" | "IMPOSTER" | null;
  encryptedWord: string | null;
  decryptedPercentage: number;
  meetingState: {
    active: boolean;
    messages: Array<{ playerId: string; message: string; timestamp: number }>;
    timeRemaining: number;
  };
  votingState: {
    active: boolean;
    hasVoted: boolean;
    candidates: Array<{ playerId: string; name: string }>;
  };
  gameEnded: boolean;
  winner: "CREWMATE" | "IMPOSTER" | null;
}
```

#### Socket Event Handlers (`apps/web/src/hooks/useGameSocket.ts`)

Add listeners:
```typescript
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
});

socket.on("voting_started", () => {
  useGameStore.getState().startVoting();
});

socket.on("game_ended", (data) => {
  useGameStore.getState().endGame(data.winner);
});
```

### UI Components

1. **Role Reveal Screen** - Shows "You are the Tamperer" or "You are an Inmate"
2. **Word Display** - Shows encrypted word (crewmates only)
3. **Task Panels** - Separate views for crew vs imposter tasks
4. **Meeting Chat** - 60-second timer, message input
5. **Voting UI** - Anonymous voting with skip option
6. **Victory Screens** - Different screens for crew/imposter win/loss

### Swagger Documentation

Add to `apps/api/src/main.ts`:
```typescript
import swaggerUi from "swagger-ui-express";
import swaggerDocument from "./swagger.json";

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

Create `swagger.json` with all API endpoints.

## 📦 Dependencies to Add

### Backend
```json
{
  "mongoose": "^8.0.0",
  "ethers": "^6.0.0",
  "jsonwebtoken": "^9.0.0",
  "swagger-ui-express": "^5.0.0",
  "swagger-jsdoc": "^6.2.0"
}
```

### Frontend
```json
{
  "ethers": "^6.0.0"
}
```

## 🔧 Configuration

### Environment Variables

Add to `.env`:
```env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/chain-of-lies
JWT_SECRET=your-secret-key-here
NODE_ENV=development
```

## 🧪 Testing Checklist

- [ ] Create room and join
- [ ] Start game (role assignment)
- [ ] Complete crew task (word encryption)
- [ ] Complete imposter task (word decryption)
- [ ] Meeting phase (60-second timer)
- [ ] Voting phase (anonymous voting)
- [ ] Player elimination
- [ ] Win conditions (crew/imposter)
- [ ] Reconnection handling
- [ ] Error cases (invalid phase, double vote, etc.)

## 📚 Next Steps

1. **Implement Auth Service** - MetaMask signature verification
2. **Extend Socket Handlers** - Add game logic events
3. **Create Controllers & Routes** - REST API endpoints
4. **Update Frontend Store** - Add new state fields
5. **Build UI Components** - Role reveal, meeting, voting
6. **Add Swagger Docs** - API documentation
7. **Test End-to-End** - Full game flow
8. **Error Handling** - Comprehensive error cases
9. **Performance** - Optimize database queries
10. **Security** - Add rate limiting, validation

## 🎯 Priority Order

1. **High Priority** (Core Game Flow)
   - Auth service (MetaMask)
   - Socket handlers for game events
   - Frontend store updates
   - Role reveal UI

2. **Medium Priority** (Gameplay Features)
   - Task completion logic
   - Meeting system
   - Voting system
   - Win conditions

3. **Low Priority** (Polish)
   - Swagger documentation
   - Error handling
   - Performance optimization
   - UI animations
