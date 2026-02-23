# Chain of Lies - Multiplayer Social Deduction Game

A real-time multiplayer social deduction game built with WebSocket-based networking, client-side prediction, and smooth interpolation.

## 🎮 Game Overview

Chain of Lies is a multiplayer game where players spawn in a spaceship-like map (inspired by Among Us), complete tasks, and try to identify the impostor among them. The game features:

- **Real-time multiplayer** with WebSocket communication
- **Smooth movement** with client-side prediction and interpolation
- **Task system** with 8 interactive mini-games
- **Party/lobby system** for creating and joining games
- **Spaceship map** with 13 rooms connected by corridors

## 🏗️ Architecture

### Tech Stack

#### Frontend (`apps/web`)
- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **TailwindCSS** - Utility-first CSS
- **shadcn/ui** - Accessible component library
- **Wouter** - Lightweight routing
- **TanStack Query** - Server state management
- **Zustand** - Client state management
- **Socket.IO Client** - Real-time communication

#### Backend (`apps/api`)
- **Express 5** - HTTP server
- **Socket.IO** - WebSocket server
- **Domain-Driven Design** - Architecture pattern
- **TypeScript** - Type safety

#### Shared Infrastructure
- **Turborepo** - Monorepo build system
- **pnpm Workspaces** - Package management
- **TypeScript 5** - Type safety
- **tsup** - Package bundler

### Project Structure

```
Chain-of-Lies/
├── apps/
│   ├── web/                    # React frontend
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   │   ├── useGameSocket.ts    # Socket event handlers
│   │   │   │   └── useLobbySocket.ts   # Lobby/party events
│   │   │   ├── pages/          # Page components
│   │   │   │   ├── LobbyPage.tsx       # Main lobby
│   │   │   │   ├── PartyRoom.tsx       # Waiting room
│   │   │   │   └── MultiplayerGame.tsx # Game canvas
│   │   │   ├── stores/         # Zustand stores
│   │   │   │   └── useGameStore.ts     # Global game state
│   │   │   └── lib/            # Utilities
│   │   └── game/               # Game engine
│   │       ├── MultiplayerGameCanvas.tsx  # Main game renderer
│   │       ├── map.ts          # Map data (rooms, walls, spawn points)
│   │       ├── useKeyboard.ts  # Input handling
│   │       ├── useGameLoop.ts  # 60fps game loop
│   │       └── tasks/          # 8 interactive mini-games
│   │
│   └── api/                    # Express backend
│       └── src/
│           └── infrastructure/
│               └── websocket/
│                   └── socketio-server.ts  # Socket.IO handlers
│
└── packages/
    ├── types/                  # Shared TypeScript types
    └── shared/                 # Shared utilities
```

## 🎯 Core Features Implemented

### 1. Multiplayer System

#### Party/Lobby Management
- **Create Party**: Host creates a party with a unique 6-character code
- **Join Party**: Players join using the party code
- **Waiting Room**: Pre-game lobby where players gather
- **Host Controls**: Only the host can start the game
- **Dynamic Join**: Players who rejoin after disconnect automatically enter active games

#### Player Management
- Players are assigned:
  - Unique Socket ID
  - Random color from a predefined palette
  - Host status (first player becomes host)
  - Spawn position at `(278, 264)` in the cafeteria

### 2. Real-Time Movement System

#### Client-Side Architecture
```
Local Input → Movement Calculation → Collision Check → Update State → Emit to Server
                                                             ↓
                                                    Interpolate Remote Players
                                                             ↓
                                                          Render
```

#### Movement Features
- **Client-Side Prediction**: Local player moves instantly (no lag)
- **Position Interpolation**: Remote players smoothly interpolate between updates
- **Throttled Network Updates**: 
  - Client emits at max 20fps (50ms throttle)
  - Server broadcasts at max 30fps (33ms throttle)
- **Smooth Speed**: Player speed set to 0.7 pixels/frame for controlled movement
- **Collision Detection**: Inverse collision system (can only walk on walkable areas)

#### Network Optimization
```typescript
// Client: Throttle emissions
if (now - lastEmitTime < 50ms) return; // 20fps

// Server: Throttle broadcasts
if (now - lastBroadcast < 33ms) return; // 30fps

// Client: Interpolate remote players
renderX += (targetX - currentX) * 0.15; // Smooth interpolation
```

### 3. Game Map

#### Map Layout
- **Dimensions**: 2800x1800 pixels
- **13 Rooms**:
  - Cafeteria (spawn area)
  - Weapons, Navigation, Shields, O2
  - Admin, Storage, Electrical
  - Lower Engine, Security, Reactor
  - Upper Engine, Medbay
- **Corridors**: Connect rooms
- **Walls**: Interior obstacles for tactical gameplay
- **Task Zones**: 13 interactive zones (60x60px yellow squares)

#### Spawn System
- All players spawn in the **Cafeteria center** at `(278, 264)`
- Additional spawn points distributed around `(278, 264)` for variety
- Prevents spawn camping and ensures fair starts

### 4. Camera System
- **Follow Mode**: Camera follows local player
- **Canvas Size**: 800x500 viewport
- **Smooth Tracking**: Camera stays centered on player
- **Boundary Clamping**: Camera never shows out-of-bounds areas

### 5. Task System

8 interactive mini-games built as React components with canvas rendering:

1. **Broken Sequence** (Cafeteria) - Memory puzzle
2. **Block Bounce** (Weapons) - Pong-like game
3. **Gas Fee Runner** (Navigation) - Endless runner
4. **Memory Miner** (Shields) - Mining clicker
5. **Block Catcher** (O2) - Catching game
6. **Smart Contract Quick Fix** (Admin) - Code puzzle
7. **Colour Prediction Spinner** (Storage) - Reaction game
8. **Color Spin** (Electrical) - Color matching

Tasks are triggered by:
- Standing in a task zone
- Pressing `E` key
- Tasks overlay the game canvas
- `Escape` closes any task

### 6. Input System

#### Keyboard Controls
```typescript
Movement:
- W/↑ - Move up
- A/← - Move left
- S/↓ - Move down
- D/→ - Move right

Interaction:
- E - Interact with task zone
- Escape - Close task overlay
```

#### Collision Detection
```typescript
// Inverse collision: player can ONLY walk on defined areas
isWalkable = isInRoom || isInCorridor || isInTaskZone
canMove = isWalkable && !hitExplicitWall
```

## 🚀 Getting Started

### Prerequisites
- **Node.js** 20+
- **pnpm** 9+

### Quick Start

1. **Install dependencies**
```bash
pnpm install
```

2. **Build shared packages**
```bash
pnpm --filter @tamper-hunt/types build
pnpm --filter @tamper-hunt/shared build
```

3. **Start development servers**
```bash
# Start both frontend and backend
pnpm dev

# Or start individually:
pnpm --filter @tamper-hunt/api dev     # Backend on :5000
pnpm --filter @tamper-hunt/web dev     # Frontend on :3000
```

4. **Play the game**
   - Open http://localhost:3000
   - Create a party or join with a code
   - Wait for host to start game
   - Use WASD/Arrow keys to move
   - Press E at yellow task zones

## 📊 State Management

### Global State (Zustand)
```typescript
useGameStore {
  connected: boolean           // Socket connection status
  party: Party | null          // Current party info
  partyCode: string | null     // Party join code
  players: Record<string, Player>  // All players in game
  localPlayerId: string | null // Current player's ID
  phase: GamePhase             // LOBBY | PARTY | GAME | ENDED
}
```

### Player State
```typescript
Player {
  id: string              // Socket ID
  name: string            // Player name
  x, y: number            // Current position
  targetX, targetY?: number   // Interpolation target
  color: string           // Visual identifier
  isHost: boolean         // Can start game
  timestamp?: number      // Last update time
}
```

### Party State
```typescript
Party {
  id: string              // Unique party ID
  partyCode: string       // 6-char join code
  hostId: string          // Host socket ID
  hostName: string        // Host display name
  maxPlayers: number      // Player limit (8)
  players: Record<string, Player>  // Party members
  phase: "LOBBY" | "GAME" // Current state
}
```

## 🔧 Technical Implementation Details

### Socket.IO Events

#### Client → Server
```typescript
"create_party" { name: string }
"join_party" { partyCode: string, name: string }
"start_game" {}
"player_move" { x: number, y: number }
"leave_game" {}
```

#### Server → Client
```typescript
"party_joined" { party, players, localPlayerId }
"party_player_update" { players }
"game_started" {}
"players_update" { players }
"error" { message: string }
```

### Movement Interpolation

#### Problem Solved
Without interpolation, remote players appear to teleport between positions due to network latency and update throttling.

#### Solution
```typescript
// Server sends updates at 30fps
// Client renders at 60fps
// Client smoothly interpolates between server updates

// When server update arrives:
player.targetX = newX
player.targetY = newY

// Each frame:
renderX = currentX + (targetX - currentX) * 0.15
renderY = currentY + (targetY - currentY) * 0.15
```

This creates smooth 60fps movement even with 30fps network updates.

### Collision System

#### Inverse Collision
Instead of defining what you CAN'T walk through, we define what you CAN walk on:

```typescript
walkableAreas = rooms + corridors + taskZones
blockedAreas = walls (explicit obstacles)

canMove = isInWalkableArea && !hitWall
```

Benefits:
- Everything outside rooms is automatically impassable
- Easy to add new walkable areas
- No need to define every wall in empty space

### Performance Optimizations

1. **Network Throttling**
   - Client: 50ms between emits (20fps)
   - Server: 33ms between broadcasts (30fps)
   - Reduces bandwidth by 50% vs 60fps updates

2. **State Diffing**
   - Only remote players interpolate
   - Local player updates instantly
   - Server only broadcasts changes

3. **Canvas Rendering**
   - 60fps game loop via requestAnimationFrame
   - Camera culling (only render visible area)
   - Minimal re-renders (React state separation)

## 🎮 Game Flow

```
1. LOBBY Phase
   ├─ Player opens game
   ├─ Creates party (becomes host) OR joins party with code
   └─ Enters waiting room

2. PARTY Phase (Waiting Room)
   ├─ Players see party code
   ├─ Players see who's in the lobby
   ├─ Host clicks "Start Game"
   └─ All players transition to GAME phase

3. GAME Phase
   ├─ All players spawn at (278, 264) in cafeteria
   ├─ Players move around map using WASD/Arrows
   ├─ Players complete tasks by pressing E at zones
   └─ (Future: voting, impostor mechanics)

4. ENDED Phase (Future)
   └─ Game over, show results
```

## 🐛 Known Issues & Limitations

### Current Limitations
1. **No Reconnection Handling**: If a player disconnects, they lose their state
2. **No Role Assignment**: All players are equal (no impostor yet)
3. **No Voting System**: No elimination mechanics
4. **Task Completion**: Tasks don't track completion state
5. **No Round System**: Game runs indefinitely
6. **Memory Storage**: All data lost on server restart (no database)

### Future Improvements
- [ ] Add role assignment (Validator, Tamperer, etc.)
- [ ] Implement voting system
- [ ] Add task progress tracking
- [ ] Implement round system with win conditions
- [ ] Add chat system
- [ ] Persistent storage (Redis/PostgreSQL)
- [ ] Reconnection with state restoration
- [ ] Mobile support (touch controls)
- [ ] Audio and visual effects

## 🔐 Security Considerations

### Current Security
- ✅ Input validation with Zod schemas
- ✅ Party code collision prevention
- ✅ Host verification for game start

### Needed Security
- ⚠️ Rate limiting on socket events
- ⚠️ Authentication system
- ⚠️ Anti-cheat measures (movement validation)
- ⚠️ Party password protection option

## 📈 Scalability

### Current Architecture (MVP)
```
[Frontend] ←─ WebSocket ─→ [Backend]
                            (In-memory)
```

**Limitations**:
- Single server
- In-memory storage (lost on restart)
- No horizontal scaling
- Max ~100 concurrent players

### Phase 2: Database
```
[Frontend] ←─ WebSocket ─→ [Backend] ←─→ [PostgreSQL]
                            (Stateful)
```

### Phase 3: Horizontal Scaling
```
[Load Balancer]
      ↓
[API-1] [API-2] [API-3]
      ↓
[Redis Pub/Sub]
      ↓
[PostgreSQL]
```

## 🧪 Testing

### Manual Testing Checklist
- [ ] Create party and get party code
- [ ] Join party from different browser/incognito
- [ ] Host starts game - both players see game canvas
- [ ] Both players can move independently
- [ ] Movement appears smooth on both screens
- [ ] Player leaves and rejoins - automatically enters active game
- [ ] Press E at task zone - overlay appears
- [ ] Complete task - overlay closes
- [ ] Multiple players move simultaneously

### Testing Tips
```bash
# Test with multiple browsers
1. Chrome: http://localhost:3000
2. Firefox: http://localhost:3000
3. Incognito: http://localhost:3000

# Check network traffic
- Open DevTools → Network → WS tab
- Watch Socket.IO messages

# Check server logs
- Backend terminal shows all socket events
- Look for "Player joined party", "player_move", etc.
```

## 🤝 Contributing

### Development Workflow
1. Create feature branch
2. Make changes
3. Test locally with multiple clients
4. Check for linter errors: `pnpm lint`
5. Check types: `pnpm typecheck`
6. Submit PR

### Code Style
- Use TypeScript for type safety
- Follow existing patterns (DDD in backend)
- Add JSDoc comments for complex logic
- Keep functions small and focused
- Use meaningful variable names

## 📝 Architecture Decisions

### Why Socket.IO over native WebSocket?
- Built-in reconnection logic
- Room/namespace support
- Event-based API (cleaner than message strings)
- Fallback transports (long-polling)

### Why Zustand over Redux?
- Simpler API (less boilerplate)
- Better TypeScript support
- No Provider wrapper needed
- Hooks-first design

### Why Domain-Driven Design?
- Each feature is self-contained
- Easy to find related code
- Scales to large teams
- Clear boundaries

### Why Monorepo?
- Share types between frontend/backend
- Atomic changes across packages
- Single install/build process
- Easier refactoring

## 📚 Additional Documentation

- `ARCHITECTURE_DIAGRAM.md` - Visual system diagrams
- `MULTIPLAYER_GAME_SYSTEM.md` - Multiplayer implementation details
- `MULTIPLAYER_SYSTEM.md` - Socket architecture
- `BACKEND_INTEGRATION_GUIDE.md` - API integration guide
- `VISUAL_GUIDE.md` - Map layout and coordinates

## 📄 License

MIT

---

**Status**: MVP Complete - Core multiplayer movement and tasks working
**Next Steps**: Role assignment, voting system, win conditions

Built with ❤️ for fun and learning
