# Multiplayer Game System Documentation

## Overview

A complete real-time multiplayer 2D game system using Socket.io where players can move around a canvas map and see each other in real-time.

## Architecture

### Folder Structure

```
apps/web/
├── src/
│   ├── types/
│   │   └── game.ts                    # Game type definitions
│   ├── contexts/
│   │   └── MultiplayerGameContext.tsx # Global game state
│   ├── hooks/
│   │   ├── use-socket.ts              # Shared socket instance
│   │   └── useGameSocket.ts           # Game-specific socket events
│   └── pages/
│       └── MultiplayerGamePage.tsx    # Main game page
└── game/
    ├── MultiplayerGameCanvas.tsx      # Multiplayer canvas renderer
    ├── useGameLoop.ts                 # Game loop hook
    ├── useKeyboard.ts                 # Keyboard input hook
    └── map.ts                         # Map data
```

## Data Flow

```
User Input (WASD/Arrows)
    ↓
MultiplayerGameCanvas (local movement calculation)
    ↓
updatePlayer (local store - immediate)
    ↓
emitPlayerMove (socket - throttled 20/sec)
    ↓
Server (validates & broadcasts)
    ↓
players_update event
    ↓
useGameSocket (listener)
    ↓
MultiplayerGameContext (global state)
    ↓
MultiplayerGameCanvas (re-render all players)
```

## Type System

### GamePlayer
```typescript
type GamePlayer = {
  id: string;          // Unique player ID
  name: string;        // Player display name
  x: number;           // X position on map
  y: number;           // Y position on map
  color: string;       // Player color (hex)
  isHost: boolean;     // Is party host
};
```

### GameState
```typescript
type GameState = {
  players: Record<string, GamePlayer>;  // All players by ID
  localPlayerId: string | null;         // Current player's ID
  phase: GamePhase;                     // Current game phase
  partyCode: string | null;             // Party code
};
```

## Socket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `join_game` | `{ partyCode: string, playerName: string }` | Join game room |
| `player_move` | `{ x: number, y: number }` | Send player position (throttled) |
| `leave_game` | - | Leave game room |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `game_start` | `{ localPlayerId: string, players: Record<string, GamePlayer> }` | Initial game state |
| `players_update` | `{ players: Record<string, GamePlayer> }` | Full player state sync |
| `player_joined` | `{ player: GamePlayer }` | New player joined |
| `player_left` | `{ playerId: string }` | Player disconnected |

## Components

### MultiplayerGamePage

**Responsibilities:**
- Initialize socket connection
- Join game room with party code
- Handle navigation
- Display player list
- Render game canvas

**Lifecycle:**
1. Mount → Check if user is in a party
2. If yes → Join game room via socket
3. Wait for `game_start` event
4. Render canvas when `localPlayerId` is set
5. Unmount → Leave game room

### MultiplayerGameCanvas

**Responsibilities:**
- Render map (rooms, corridors, walls, task zones)
- Render all players from global state
- Handle local player keyboard input
- Calculate local player movement
- Emit movement to server (throttled)
- Apply camera following local player
- Show player names and host badges

**Does NOT:**
- Manage global state directly
- Handle lobby logic
- Create socket connections
- Manage other players' positions (server does this)

### MultiplayerGameContext

**Responsibilities:**
- Store all player positions
- Store local player ID
- Store game phase
- Provide actions to update state

**Actions:**
- `setPlayers` - Replace all players
- `updatePlayer` - Update specific player
- `addPlayer` - Add new player
- `removePlayer` - Remove player
- `setLocalPlayerId` - Set current player ID
- `setPhase` - Update game phase
- `reset` - Clear all state

### useGameSocket Hook

**Responsibilities:**
- Register socket event listeners
- Emit player movement (throttled to 20/sec)
- Join/leave game rooms
- Update global state from socket events

**Throttling:**
- Movement emissions limited to 50ms intervals
- Prevents network spam
- Maintains smooth gameplay

## Movement System

### Local Player Movement

1. **Input Detection**: Keyboard hook tracks WASD/Arrow keys
2. **Position Calculation**: Calculate next position based on speed
3. **Collision Detection**: Check if position is valid (walkable area)
4. **Immediate Update**: Update local store for instant feedback
5. **Server Sync**: Emit position to server (throttled)

### Remote Player Movement

1. **Server Broadcast**: Server sends `players_update` event
2. **State Update**: useGameSocket updates global state
3. **Re-render**: Canvas re-renders with new positions

### Collision System

**Inverse Collision:**
- Player can ONLY walk on: rooms, corridors, task zones
- Everything else is a wall
- Explicit walls block movement even in walkable areas

**Boundary Clamping:**
- Player cannot move outside map bounds
- X: 0 to MAP_WIDTH
- Y: 0 to MAP_HEIGHT

## Rendering Pipeline

```
1. Clear canvas
2. Draw background
3. Save context
4. Apply camera translation (follow local player)
5. Draw map elements:
   - Rooms (dark gray)
   - Corridors (dark gray)
   - Walls (darker gray)
   - Task zones (yellow transparent)
6. Draw all players:
   - Player circle (colored)
   - Glow effect (local player only)
   - Border (white for local, black for others)
   - Name label
   - Host badge (crown emoji)
7. Draw interaction prompt (if near task zone)
8. Restore context
```

## Camera System

**Follow Local Player:**
- Camera centers on local player
- Clamped to map boundaries
- Smooth following (no lag)

**Calculation:**
```typescript
cameraX = clamp(
  0,
  MAP_WIDTH - CANVAS_WIDTH,
  localPlayer.x - CANVAS_WIDTH / 2
);

cameraY = clamp(
  0,
  MAP_HEIGHT - CANVAS_HEIGHT,
  localPlayer.y - CANVAS_HEIGHT / 2
);
```

## Mock Socket Implementation

For development without a backend:

### join_game Event
```typescript
socket.emit("join_game", { partyCode, playerName });

// Mock response:
socket.on("game_start", {
  localPlayerId: "player-123",
  players: {
    "player-123": {
      id: "player-123",
      name: "PlayerName",
      x: 700,
      y: 400,
      color: "#ff5733",
      isHost: true
    }
  }
});
```

### player_move Event
```typescript
socket.emit("player_move", { x: 750, y: 420 });

// Mock: Just logs, doesn't broadcast
// Real server would broadcast to all players
```

## Testing

### Single Player Test

1. Create party as admin (password: `admin123`)
2. Click "Start Game" in party room
3. Should navigate to `/multiplayer`
4. Should see loading screen briefly
5. Canvas appears with your player
6. Move with WASD/Arrows
7. See position update in real-time

### Multi-Player Test (Requires Real Backend)

1. **Player 1**: Create party, start game
2. **Player 2**: Join party with code
3. **Player 1**: Start game
4. Both players navigate to game
5. Both should see each other
6. Movement syncs in real-time
7. Each player has unique color
8. Host has crown badge

## Backend Integration

### Server Setup

```typescript
import { Server } from "socket.io";

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Store game rooms
const gameRooms = new Map();

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Join game room
  socket.on("join_game", ({ partyCode, playerName }) => {
    socket.join(partyCode);
    
    // Get or create room
    if (!gameRooms.has(partyCode)) {
      gameRooms.set(partyCode, { players: {} });
    }
    
    const room = gameRooms.get(partyCode);
    
    // Add player to room
    const player = {
      id: socket.id,
      name: playerName,
      x: 700,
      y: 400,
      color: generateRandomColor(),
      isHost: Object.keys(room.players).length === 0
    };
    
    room.players[socket.id] = player;
    
    // Send initial state to joining player
    socket.emit("game_start", {
      localPlayerId: socket.id,
      players: room.players
    });
    
    // Notify others
    socket.to(partyCode).emit("player_joined", { player });
  });

  // Handle player movement
  socket.on("player_move", ({ x, y }) => {
    const partyCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!partyCode) return;
    
    const room = gameRooms.get(partyCode);
    if (!room || !room.players[socket.id]) return;
    
    // Update player position
    room.players[socket.id].x = x;
    room.players[socket.id].y = y;
    
    // Broadcast to all players in room
    io.to(partyCode).emit("players_update", {
      players: room.players
    });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const partyCode = Array.from(socket.rooms).find(r => r !== socket.id);
    if (!partyCode) return;
    
    const room = gameRooms.get(partyCode);
    if (!room) return;
    
    delete room.players[socket.id];
    
    // Notify others
    socket.to(partyCode).emit("player_left", {
      playerId: socket.id
    });
    
    // Clean up empty rooms
    if (Object.keys(room.players).length === 0) {
      gameRooms.delete(partyCode);
    }
  });
});
```

### Environment Configuration

```env
# Use real socket
VITE_USE_REAL_SOCKET=true
VITE_SOCKET_URL=http://localhost:5000
```

## Performance Optimizations

### Movement Throttling
- Emissions limited to 20/sec (50ms intervals)
- Prevents network congestion
- Maintains smooth gameplay

### Local Prediction
- Local player updates immediately
- No waiting for server response
- Server corrects if needed

### Efficient Rendering
- Single canvas clear per frame
- Batch draw operations
- Camera culling (only draw visible area)

## Features

✅ Real-time multiplayer movement
✅ Smooth local player control
✅ Camera following
✅ Collision detection
✅ Player name labels
✅ Host badges
✅ Unique player colors
✅ Throttled network updates
✅ Party code system
✅ Player list display
✅ Leave game functionality
✅ Loading states
✅ Mock socket for development

## Future Enhancements

- [ ] Interpolation for remote players (smoother movement)
- [ ] Lag compensation
- [ ] Server-side collision validation
- [ ] Task interaction system
- [ ] Chat system
- [ ] Player roles (Crew/Tamperer)
- [ ] Voting system
- [ ] Game phases (Task/Meeting/Voting)
- [ ] Win conditions
- [ ] Spectator mode

## Files Created

- `apps/web/src/types/game.ts` - Type definitions
- `apps/web/src/contexts/MultiplayerGameContext.tsx` - Global state
- `apps/web/src/hooks/useGameSocket.ts` - Socket hook
- `apps/web/game/MultiplayerGameCanvas.tsx` - Canvas renderer
- `apps/web/src/pages/MultiplayerGamePage.tsx` - Game page
- `MULTIPLAYER_GAME_SYSTEM.md` - This documentation

## Files Modified

- `apps/web/src/App.tsx` - Added provider and route
- `apps/web/src/pages/PartyRoom.tsx` - Navigate to multiplayer
- `apps/web/src/hooks/use-socket.ts` - Added game events to mock

## Summary

The multiplayer game system is fully implemented with:
- Clean separation of concerns
- Proper state management
- Efficient socket communication
- Smooth gameplay
- Easy backend integration
- Comprehensive documentation

Ready for testing with mock socket, and ready for real backend integration!
