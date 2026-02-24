# Chain of Lies - Game Logic Architecture

## 📋 Overview

This document describes the complete architecture for the social deduction game system, extending the existing multiplayer movement system.

## 🗂️ Module Structure

```
apps/api/src/modules/
├── auth/
│   ├── models/user.model.ts
│   ├── services/auth.service.ts
│   ├── controllers/auth.controller.ts
│   ├── routes/auth.routes.ts
│   ├── middlewares/jwt.middleware.ts
│   └── utils/signature.util.ts
│
├── room/
│   ├── models/room.model.ts
│   ├── services/room.service.ts
│   ├── controllers/room.controller.ts
│   └── routes/room.routes.ts
│
├── game/
│   ├── models/
│   │   ├── game.model.ts
│   │   └── wordbank.model.ts
│   ├── services/game.service.ts
│   ├── controllers/game.controller.ts
│   ├── routes/game.routes.ts
│   └── utils/encryption.util.ts
│
├── task/
│   ├── models/task.model.ts
│   ├── services/task.service.ts
│   ├── controllers/task.controller.ts
│   └── routes/task.routes.ts
│
├── meeting/
│   ├── models/meeting.model.ts
│   ├── services/meeting.service.ts
│   ├── controllers/meeting.controller.ts
│   └── routes/meeting.routes.ts
│
├── vote/
│   ├── models/vote.model.ts
│   ├── services/vote.service.ts
│   ├── controllers/vote.controller.ts
│   └── routes/vote.routes.ts
│
└── shared/
    └── models/log.model.ts
```

## 🔄 Game State Machine

```
LOBBY → PARTY → TASKS → MEETING → VOTING → (TASKS | ENDED)
                                    ↓
                                 ENDED
```

### Phase Transitions

1. **LOBBY**: Players join, host creates room
2. **PARTY**: Waiting room, host starts game
3. **TASKS**: 
   - Crew completes tasks → encrypts word
   - Imposter completes tasks → decrypts word
   - When all crew complete one round → MEETING
4. **MEETING**: 60-second chat phase
5. **VOTING**: Anonymous voting, eliminate player
6. **ENDED**: Game over, show results

## 🎮 Core Game Flow

### 1. Game Start

```typescript
// Host clicks "Start Game"
POST /api/game/start
→ GameService.startGame()
  → Randomly select 1 imposter
  → Assign roles (stored in Room.players[].role)
  → Get random word from WordBank
  → Initialize encryption (word fully visible)
  → Create tasks (15 crew + 10 imposter)
  → Set phase = "TASKS"
  → Emit "role_assigned" to each player
  → Emit "word_update" to crewmates only
```

### 2. Task Completion

#### Crew Task
```typescript
POST /api/task/complete
→ TaskService.completeCrewTask()
  → Verify task exists and not completed
  → Mark task.completed = true
  → Increment crewTasksCompleted counter
  → If all alive crew completed one round:
    → Encrypt word by 10%
    → Update game.encryptedWord
    → Emit "word_update" to crewmates
    → Trigger meeting: GameService.startMeeting()
    → Emit "meeting_started"
```

#### Imposter Task
```typescript
POST /api/task/complete
→ TaskService.completeImposterTask()
  → Verify player is imposter
  → Verify task is imposter type
  → Mark task.completed = true
  → Decrypt word by 10%
  → Update game.decryptedPercentage
  → Emit "word_update" to imposter (shows decryption progress)
  → Check win condition (if 100% → imposter wins)
```

### 3. Meeting Phase

```typescript
// Automatic after crew task round
GameService.startMeeting()
  → Set phase = "MEETING"
  → Set meetingStartTime = now
  → Emit "meeting_started" (60 second timer starts)

// Players send messages
POST /api/meeting/message
→ MeetingService.sendMessage()
  → Generate reference sentence for crewmates
  → Store message in Meeting.messages[]
  → Emit "meeting_message" to all players

// After 60 seconds (server-side timer)
GameService.endMeeting()
  → Set phase = "VOTING"
  → Emit "meeting_ended"
  → Emit "voting_started"
```

### 4. Voting Phase

```typescript
// Players vote
POST /api/vote/cast
→ VoteService.castVote()
  → Verify player hasn't voted
  → Verify phase = "VOTING"
  → Store vote in Vote collection
  → Emit "vote_cast" (anonymous, no player info)

// When all alive players voted
VoteService.tallyVotes()
  → Count votes per player
  → Find highest vote count
  → If tie or SKIP highest → no elimination
  → Else → eliminate player
  → Update Room.players[].isAlive = false
  → Emit "player_eliminated" (show who was eliminated)
  → Check win conditions
  → If game continues → phase = "TASKS", round++
  → If game ends → phase = "ENDED", emit "game_ended"
```

## 🔐 Authentication Flow

```typescript
// 1. Request nonce
GET /api/auth/nonce?walletAddress=0x...
→ AuthService.generateNonce()
  → Create/update User with random nonce
  → Return nonce

// 2. Sign and verify
POST /api/auth/verify
Body: { walletAddress, signature }
→ AuthService.verifySignature()
  → Get user nonce
  → Verify signature using ethers.js
  → Generate JWT token
  → Return { token, user }

// 3. Socket connection
Socket.IO connection
→ Middleware: verifyJWT()
  → Extract token from handshake
  → Verify JWT
  → Attach userId to socket.data
```

## 📡 Socket Events

### Client → Server

```typescript
"create_room" { name: string }
"join_room" { roomCode: string }
"start_game" {}
"task_completed" { taskId: string }
"meeting_message" { message: string }
"vote" { votedFor?: string, isSkip: boolean }
"disconnect" {}
```

### Server → Client

```typescript
"role_assigned" { role: "CREWMATE" | "IMPOSTER" }
"word_update" { encryptedWord: string, decryptedPercentage?: number }
"task_update" { taskId: string, completed: boolean }
"meeting_started" { duration: 60 }
"meeting_ended" {}
"voting_started" {}
"voting_results" { eliminated?: string, voteBreakdown: object }
"player_eliminated" { playerId: string }
"game_ended" { winner: "CREWMATE" | "IMPOSTER" }
```

## 🗄️ Database Collections

### users
- `walletAddress` (unique, indexed)
- `username`
- `nonce` (for signature verification)

### rooms
- `roomCode` (unique, indexed)
- `host` (User ref)
- `players[]` (userId, socketId, isAlive, role)
- `status` (WAITING | IN_GAME | ENDED)

### games
- `roomId` (Room ref, indexed)
- `imposterId` (User ref)
- `secretWord` (original word)
- `encryptedWord` (current state)
- `decryptedPercentage` (0-100)
- `phase` (TASKS | MEETING | VOTING | ENDED)
- `round` (number)
- `winner` (CREWMATE | IMPOSTER)

### tasks
- `gameId` (Game ref, indexed)
- `playerId` (User ref)
- `type` (CREW | IMPOSTER)
- `name` (task name)
- `location` (x, y coordinates)
- `completed` (boolean)
- `completedAt` (Date)

### meetings
- `gameId` (Game ref, indexed)
- `round` (number)
- `messages[]` (playerId, message, createdAt)
- `startedAt` (Date)
- `endedAt` (Date)

### votes
- `gameId` (Game ref, indexed)
- `voterId` (User ref)
- `votedFor` (User ref, optional)
- `isSkip` (boolean)
- Unique index: (gameId, voterId)

### wordbanks
- `word` (unique, uppercase)
- `category` (optional)
- `difficulty` (optional)

### gamelogs
- `gameId` (Game ref, indexed)
- `type` (event type)
- `metadata` (any)

## 🧠 In-Memory State

For performance, critical game state is kept in memory:

```typescript
interface InMemoryGameState {
  gameId: Types.ObjectId;
  roomId: Types.ObjectId;
  phase: GamePhase;
  encryptionState: EncryptionState;
  crewTasksCompleted: number;
  imposterTasksCompleted: number;
  alivePlayers: Set<Types.ObjectId>;
}
```

**Why in-memory?**
- Fast lookups for socket events
- Real-time phase checks
- Reduced database queries

**Sync to MongoDB:**
- On phase transitions
- On task completion
- On vote completion
- On game end

## 🔒 Security Rules

### Server-Side Validation

1. **Role Verification**
   - Only imposter can complete imposter tasks
   - Only crewmates see word
   - Roles never sent to other players

2. **Phase Validation**
   - Tasks only in TASKS phase
   - Voting only in VOTING phase
   - Meeting messages only in MEETING phase

3. **Task Validation**
   - Verify task belongs to player
   - Verify task not already completed
   - Verify player proximity (future: check x,y coordinates)

4. **Vote Validation**
   - One vote per player per round
   - Can only vote for alive players
   - Can vote SKIP

5. **Meeting Validation**
   - One message per player per meeting
   - 60-second timeout enforced server-side
   - Auto-transition to voting

## 📊 Frontend State (Zustand)

```typescript
interface GameState {
  // Connection
  connected: boolean;
  
  // Room
  room: Room | null;
  roomCode: string | null;
  
  // Players
  players: Record<string, Player>;
  localPlayerId: string | null;
  
  // Game
  role: "CREWMATE" | "IMPOSTER" | null;
  encryptedWord: string | null;
  decryptedPercentage: number;
  phase: GamePhase;
  round: number;
  
  // Meeting
  meetingState: {
    active: boolean;
    messages: Array<{ playerId: string; message: string; timestamp: number }>;
    timeRemaining: number;
  };
  
  // Voting
  votingState: {
    active: boolean;
    hasVoted: boolean;
    candidates: Array<{ playerId: string; name: string }>;
  };
  
  // Game End
  gameEnded: boolean;
  winner: "CREWMATE" | "IMPOSTER" | null;
}
```

## 🎯 Win Conditions

### Crew Wins
1. Imposter is eliminated (voted out)
2. Game phase transitions to ENDED
3. `game.winner = "CREWMATE"`

### Imposter Wins
1. Word fully decrypted (`decryptedPercentage >= 100`)
2. OR: Alive players ≤ 3 AND imposter still alive
3. Game phase transitions to ENDED
4. `game.winner = "IMPOSTER"`

## 📝 Implementation Checklist

### Backend
- [x] MongoDB schemas
- [x] Encryption utilities
- [x] Game service (role assignment, word management)
- [ ] Auth service (MetaMask signature verification)
- [ ] Room service (create, join, start)
- [ ] Task service (completion logic)
- [ ] Meeting service (message handling, timer)
- [ ] Vote service (tally, elimination)
- [ ] Socket event handlers
- [ ] Controllers & routes
- [ ] Swagger documentation
- [ ] JWT middleware

### Frontend
- [ ] Update Zustand store
- [ ] Role-based UI rendering
- [ ] Word display (crewmates only)
- [ ] Encryption animation
- [ ] Task panels (crew vs imposter)
- [ ] Meeting chat UI
- [ ] Voting UI
- [ ] Victory screens

## 🚀 Next Steps

1. Implement remaining services
2. Create socket event handlers
3. Add Swagger documentation
4. Update frontend Zustand store
5. Build UI components
6. Test end-to-end flow
7. Add error handling
8. Performance optimization
