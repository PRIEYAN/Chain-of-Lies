# Real-Time Multiplayer System Implementation

## Overview
Complete Socket.IO-based multiplayer system with room architecture for lobby and game synchronization.

## Architecture

### Frontend (apps/web)

#### 1. Shared Socket Instance
**File**: `src/shared/socket.ts`
- Single Socket.IO instance used throughout the app
- Auto-reconnection enabled
- Debug logging in development

#### 2. Global State Management
**File**: `src/stores/useGameStore.ts`
- Zustand store managing all multiplayer state
- Stores: party, players, localPlayerId, phase
- Actions: setParty, setPlayers, updatePlayer, setPhase, reset

#### 3. Socket Hooks

**Lobby Socket Hook** (`src/hooks/useLobbySocket.ts`):
- Handles lobby and party events
- Events: create_party, join_party, leave_party, start_game, get_parties
- Integrates with global store

**Game Socket Hook** (`src/hooks/useGameSocket.ts`):
- Handles in-game multiplayer events
- Events: player_move, players_update
- Throttled movement updates (20fps)

#### 4. Pages

**LobbyPage** (`src/pages/LobbyPage.tsx`):
- Entry point for multiplayer
- Create or join party
- Auto-navigates to PartyRoom when joined

**PartyRoom** (`src/pages/PartyRoom.tsx`):
- Waiting room before game starts
- Shows real-time player list
- Host can start game
- Auto-navigates to game when started

**MultiplayerGamePage** (`src/pages/MultiplayerGamePage.tsx`):
- Main game view
- Renders MultiplayerGameCanvas
- Shows live player list

**MultiplayerGameCanvas** (`game/MultiplayerGameCanvas.tsx`):
- Renders game world
- Handles local player movement
- Emits movement to server
- Renders all players from global store

### Backend (apps/api)

#### Socket.IO Server
**File**: `src/infrastructure/websocket/socketio-server.ts`

**Data Structures**:
```typescript
parties: Map<string, Party>  // All active parties
socketToParty: Map<string, string>  // Socket ID -> Party ID mapping
```

**Lobby Events**:
- `create_party`: Create new party, generate code, join room
- `join_party`: Join existing party by code, add to room
- `leave_party`: Remove player, reassign host if needed
- `get_parties`: Return list of available parties
- `start_game`: Host starts game, emit to all in room

**Game Events**:
- `player_move`: Update player position, broadcast to room
- `leave_game`: Remove player from game

**Room Management**:
- Uses Socket.IO rooms (socket.join(partyCode))
- Broadcasts only to specific party rooms
- Auto-cleanup on disconnect
- Host reassignment when host leaves

## Data Flow

### Creating a Party
1. User clicks "Create Party" → `createParty(name)`
2. Socket emits `create_party` with name
3. Server creates party, generates code, adds player
4. Server: `socket.join(partyCode)`
5. Server emits `party_joined` to socket
6. Client updates store → navigates to PartyRoom

### Joining a Party
1. User enters code → `joinParty(partyCode, name)`
2. Socket emits `join_party` with code and name
3. Server finds party, adds player
4. Server: `socket.join(partyCode)`
5. Server emits `party_joined` to joining socket
6. Server emits `party_player_update` to entire room
7. All clients update player list in real-time

### Starting Game
1. Host clicks "Start Game" → `startGame()`
2. Socket emits `start_game`
3. Server verifies host, sets phase to GAME
4. Server emits `game_started` to room
5. All clients navigate to game page

### Player Movement
1. Player presses WASD/arrows
2. Canvas updates local position immediately
3. `emitPlayerMove(x, y)` throttled to 20fps
4. Server updates player position in party.players
5. Server emits `players_update` to room
6. All clients render updated positions

## Installation

### Frontend
```bash
cd apps/web
pnpm add zustand
```

### Backend
```bash
cd apps/api
pnpm add socket.io
pnpm add -D @types/socket.io
```

## Environment Variables

### Frontend (.env)
```
VITE_SOCKET_URL=http://localhost:5000
```

### Backend (.env)
```
PORT=5000
CLIENT_URL=http://localhost:3000
```

## Key Features

✅ Single socket instance (no multiple connections)
✅ Room-based architecture (no global broadcasts)
✅ Real-time player synchronization
✅ Automatic host reassignment
✅ Party cleanup on disconnect
✅ Throttled movement updates
✅ Optimistic local updates
✅ Type-safe socket events

## Testing

1. Start backend: `pnpm --filter @tamper-hunt/api dev`
2. Start frontend: `pnpm --filter @tamper-hunt/web dev`
3. Open two browser windows
4. Create party in window 1
5. Join party in window 2 using code
6. Verify players sync in real-time
7. Start game as host
8. Move players and verify synchronization

## Notes

- Server is source of truth for all state
- Client only renders what server sends
- PartyId persists from lobby to game
- Socket rooms ensure isolated party communication
- No global io.emit() - always use io.to(partyCode).emit()
