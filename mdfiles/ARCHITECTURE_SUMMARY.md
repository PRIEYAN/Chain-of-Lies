# Chain of Lies - Complete Architecture Summary

## 📋 What Has Been Implemented

### ✅ Core Infrastructure

1. **MongoDB Setup**
   - Connection handler (`infrastructure/database/mongodb.ts`)
   - All 8 database models with proper schemas
   - Indexes for performance

2. **Database Models** (Mongoose)
   - ✅ User (wallet authentication)
   - ✅ Room (lobby management)
   - ✅ Game (game state, word encryption)
   - ✅ WordBank (secret words)
   - ✅ Task (crew & imposter tasks)
   - ✅ Meeting (chat messages)
   - ✅ Vote (voting records)
   - ✅ GameLog (audit trail)

3. **Core Services**
   - ✅ **GameService** - Complete game logic:
     - Role assignment (random imposter)
     - Word management (random selection, encryption/decryption)
     - Task creation (15 crew + 10 imposter)
     - Crew task completion (encrypts word 10%)
     - Imposter task completion (decrypts word 10%)
     - Meeting phase management
     - Win condition checking
     - In-memory state for performance
   
   - ✅ **AuthService** - MetaMask authentication:
     - Nonce generation
     - Signature verification (ethers.js)
     - JWT token generation
     - JWT verification
   
   - ✅ **VoteService** - Voting & elimination:
     - Vote casting (with validation)
     - Vote tallying
     - Player elimination
     - Win condition checking after elimination

4. **Utilities**
   - ✅ Encryption/Decryption utilities:
     - `encryptWord()` - Randomly hides letters
     - `decryptWord()` - Reveals hidden letters
     - `initializeEncryption()` - Sets up initial state

5. **Frontend Store**
   - ✅ Extended Zustand store with:
     - Role state (CREWMATE/IMPOSTER)
     - Encrypted word state
     - Meeting state (messages, timer)
     - Voting state (candidates, hasVoted)
     - Game end state (winner)

## 🚧 What Needs Implementation

### Backend Services (3 remaining)

1. **RoomService** (`modules/room/services/room.service.ts`)
   ```typescript
   - createRoom(hostId, hostName)
   - joinRoom(roomCode, userId, socketId)
   - getRoom(roomId)
   - updateRoomStatus(roomId, status)
   ```

2. **TaskService** (`modules/task/services/task.service.ts`)
   ```typescript
   - getPlayerTasks(gameId, playerId)
   - verifyTaskProximity(taskId, playerX, playerY)
   - completeTask(taskId, playerId) // delegates to GameService
   ```

3. **MeetingService** (`modules/meeting/services/meeting.service.ts`)
   ```typescript
   - sendMessage(gameId, playerId, message)
   - getMeetingMessages(gameId)
   - generateReferenceSentence(role)
   - autoEndMeeting(gameId) // 60-second timer
   ```

### Controllers & Routes (All modules)

Each module needs:
- Controller class with request handlers
- Routes file with endpoint definitions
- DTOs for request/response validation

**Pattern to follow:**
```typescript
// Controller
export class XController {
  async method(req: Request, res: Response) {
    try {
      const result = await xService.method(req.body);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
}

// Routes
router.post("/endpoint", authenticateJWT, controller.method);
```

### Socket Event Handlers

Extend `infrastructure/websocket/socketio-server.ts`:

**Required handlers:**
- `start_game` - Calls gameService.startGame(), emits roles
- `task_completed` - Calls gameService.completeCrewTask/completeImposterTask
- `meeting_message` - Calls meetingService.sendMessage()
- `vote` - Calls voteService.castVote()
- `disconnect` - Cleanup, check if game should end

### Frontend Components

1. **Role Reveal Screen**
   - Shows "You are the Tamperer" or "You are an Inmate"
   - Triggered on `role_assigned` event

2. **Word Display** (Crewmates only)
   - Shows encrypted word
   - Updates on `word_update` event
   - Animation for encryption changes

3. **Task Panels**
   - Crew tasks list (visible to all)
   - Imposter tasks list (visible to imposter only)
   - Filter by role in Zustand store

4. **Meeting Chat**
   - 60-second timer (countdown)
   - Message input (one message per player)
   - Message list (all players see all messages)
   - Auto-disable after 60 seconds

5. **Voting UI**
   - List of alive players
   - SKIP button
   - Anonymous voting (no one sees who voted)
   - Imposter sees vote breakdown after voting ends

6. **Victory Screens**
   - Crew win: "Winner" + all crewmates
   - Crew loss: "You have lost"
   - Imposter win: "Your Tamper Was Great"
   - Imposter loss: "You have been pwned"

### Swagger Documentation

Create `swagger.json` with:
- All REST endpoints
- Request/response schemas
- Error responses
- Authentication requirements

## 🎯 Game Flow Implementation

### Phase 1: LOBBY → PARTY
```
1. Player creates/joins room
2. RoomService.createRoom() or joinRoom()
3. Socket: "party_joined" event
4. Frontend: Navigate to waiting room
```

### Phase 2: PARTY → TASKS
```
1. Host clicks "Start Game"
2. Socket: "start_game" event
3. Backend: gameService.startGame()
   - Assign roles
   - Select word
   - Create tasks
4. Socket: "role_assigned" to each player
5. Socket: "word_update" to crewmates only
6. Frontend: Show role reveal screen
7. Frontend: Navigate to game canvas
```

### Phase 3: TASKS Phase
```
1. Player moves to task zone
2. Player presses E
3. Socket: "task_completed" { taskId }
4. Backend: gameService.completeCrewTask() or completeImposterTask()
   - If crew: encrypt word 10%
   - If imposter: decrypt word 10%
5. Socket: "word_update" (crewmates) or "task_update" (all)
6. If all crew completed round:
   - Trigger meeting
   - Socket: "meeting_started"
```

### Phase 4: MEETING Phase
```
1. Server: gameService.startMeeting()
2. Socket: "meeting_started" { duration: 60 }
3. Frontend: Show meeting chat UI
4. Player sends message
5. Socket: "meeting_message" { message }
6. Backend: meetingService.sendMessage()
   - Generate reference sentence (crewmates)
   - Store message
7. Socket: "meeting_message" to all
8. After 60 seconds:
   - Server: gameService.endMeeting()
   - Socket: "meeting_ended"
   - Socket: "voting_started"
```

### Phase 5: VOTING Phase
```
1. Socket: "voting_started"
2. Frontend: Show voting UI
3. Player votes
4. Socket: "vote" { votedFor?, isSkip }
5. Backend: voteService.castVote()
6. When all voted:
   - voteService.tallyVotes()
   - Eliminate player (if applicable)
   - Socket: "player_eliminated" { playerId }
   - Socket: "voting_results" { voteBreakdown } (imposter only)
7. Check win conditions
8. If game continues: phase = "TASKS", round++
9. If game ends: phase = "ENDED", emit "game_ended"
```

### Phase 6: ENDED Phase
```
1. Socket: "game_ended" { winner }
2. Frontend: Show victory screen (role-based)
3. Game over
```

## 🔐 Security Checklist

- ✅ Roles never sent to other players
- ✅ Word only sent to crewmates
- ✅ JWT authentication required
- ✅ Phase validation (can't vote in TASKS phase)
- ✅ Task ownership validation
- ✅ One vote per player
- ✅ One message per meeting
- ✅ Server-authoritative game state
- ⚠️ Task proximity validation (needs implementation)
- ⚠️ Rate limiting (needs implementation)
- ⚠️ Input sanitization (needs implementation)

## 📊 File Structure Created

```
apps/api/src/
├── infrastructure/
│   └── database/
│       └── mongodb.ts ✅
│
└── modules/
    ├── auth/
    │   ├── models/user.model.ts ✅
    │   └── services/auth.service.ts ✅
    │
    ├── room/
    │   └── models/room.model.ts ✅
    │
    ├── game/
    │   ├── models/
    │   │   ├── game.model.ts ✅
    │   │   └── wordbank.model.ts ✅
    │   ├── services/game.service.ts ✅
    │   └── utils/encryption.util.ts ✅
    │
    ├── task/
    │   └── models/task.model.ts ✅
    │
    ├── meeting/
    │   └── models/meeting.model.ts ✅
    │
    ├── vote/
    │   ├── models/vote.model.ts ✅
    │   └── services/vote.service.ts ✅
    │
    └── shared/
        └── models/log.model.ts ✅

apps/web/src/
└── stores/
    └── useGameStore.ts ✅ (extended)

Documentation:
├── GAME_LOGIC_ARCHITECTURE.md ✅
├── IMPLEMENTATION_STATUS.md ✅
├── QUICK_START_IMPLEMENTATION.md ✅
└── ARCHITECTURE_SUMMARY.md ✅ (this file)
```

## 🚀 Next Steps

1. **Complete Backend Services** (Room, Task, Meeting)
2. **Create Controllers & Routes** (all modules)
3. **Extend Socket Handlers** (game events)
4. **Add JWT Middleware** (authentication)
5. **Update Frontend Socket Listeners** (event handlers)
6. **Build UI Components** (role reveal, meeting, voting)
7. **Add Swagger Docs** (API documentation)
8. **Test End-to-End** (full game flow)
9. **Add Error Handling** (comprehensive)
10. **Performance Optimization** (database queries, caching)

## 📚 Documentation Reference

- **Architecture**: `GAME_LOGIC_ARCHITECTURE.md` - Complete system design
- **Status**: `IMPLEMENTATION_STATUS.md` - What's done, what's left
- **Quick Start**: `QUICK_START_IMPLEMENTATION.md` - Step-by-step guide
- **This File**: `ARCHITECTURE_SUMMARY.md` - High-level overview

## 💡 Key Design Decisions

1. **In-Memory + MongoDB**: Fast lookups in memory, persistence in DB
2. **Server Authoritative**: All game logic on server, client just displays
3. **Role-Based Events**: Different data sent to different players
4. **Progressive Encryption**: Word gradually encrypted/decrypted
5. **Anonymous Voting**: No one knows who voted (except imposter sees breakdown)
6. **Reference Sentences**: Crewmates get hints, imposter doesn't
7. **Phase State Machine**: Clear transitions, validated at each step

## 🎮 Game Balance

- **Crew Advantage**: Can encrypt word by completing tasks
- **Imposter Advantage**: Can decrypt word, sees vote breakdown
- **Win Conditions**: Balanced (elimination vs word decryption)
- **Meeting System**: Gives crew chance to discuss
- **Voting**: Anonymous prevents retaliation

---

**Status**: Core architecture complete, ready for implementation of remaining services and UI.
