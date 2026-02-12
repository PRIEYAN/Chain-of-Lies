# Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      React App                            │ │
│  │                                                           │ │
│  │  ┌─────────────────────────────────────────────────────┐ │ │
│  │  │              GameProvider (Context)                 │ │ │
│  │  │  • Player positions (Map<id, PlayerPosition>)       │ │ │
│  │  │  • Interaction zones                                │ │ │
│  │  │  • Active overlay state                             │ │ │
│  │  │  • Movement lock                                    │ │ │
│  │  └─────────────────────────────────────────────────────┘ │ │
│  │                           │                               │ │
│  │           ┌───────────────┼───────────────┐               │ │
│  │           │               │               │               │ │
│  │  ┌────────▼────────┐ ┌───▼────┐ ┌────────▼────────┐     │ │
│  │  │  GameEngine     │ │  HUD   │ │   Overlays      │     │ │
│  │  │  (Canvas)       │ │        │ │  • Task         │     │ │
│  │  │  • Render loop  │ │        │ │  • Voting       │     │ │
│  │  │  • Draw players │ │        │ │  • Emergency    │     │ │
│  │  │  • Draw zones   │ │        │ │  • Reveal       │     │ │
│  │  │  • Handle input │ │        │ │                 │     │ │
│  │  └────────┬────────┘ └────────┘ └─────────────────┘     │ │
│  │           │                                               │ │
│  └───────────┼───────────────────────────────────────────────┘ │
│              │                                                 │
│  ┌───────────▼───────────────────────────────────────────────┐ │
│  │                  WebSocket Client                         │ │
│  │  • emit("playerMove", { x, y })                           │ │
│  │  • on("playersUpdate", handler)                           │ │
│  └───────────┬───────────────────────────────────────────────┘ │
│              │                                                 │
└──────────────┼─────────────────────────────────────────────────┘
               │
               │ WebSocket Connection
               │
┌──────────────▼─────────────────────────────────────────────────┐
│                      Backend Server                            │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                  WebSocket Server                         │ │
│  │  • on("player_move", handler)                             │ │
│  │  • emit("players_update", data)                           │ │
│  └───────────┬───────────────────────────────────────────────┘ │
│              │                                                 │
│  ┌───────────▼───────────────────────────────────────────────┐ │
│  │              Position Storage                             │ │
│  │  Map<playerId, { x, y, timestamp }>                       │ │
│  │  (In-memory or Redis)                                     │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Hierarchy

```
App
└── QueryClientProvider
    └── TooltipProvider
        └── GameProvider ◄─────────── Global State Context
            └── Router
                ├── LandingPage (/)
                ├── LobbyPage (/lobby)
                ├── RoleRevealPage (/role)
                └── GameView (/game, /task, /audit, /voting, /reveal)
                    │
                    ├── GameEngine ◄────── Canvas Renderer (60 FPS)
                    │   ├── Grid rendering
                    │   ├── Zone rendering
                    │   ├── Player rendering
                    │   └── Input handling
                    │
                    ├── HUD ◄────────────── Always Visible Overlay
                    │   ├── Phase badge
                    │   ├── Timer
                    │   ├── Role badge
                    │   └── Player count
                    │
                    └── Overlays ◄────────── Conditional Overlays
                        ├── TaskOverlay (when activeOverlay === "task")
                        ├── VotingOverlay (when activeOverlay === "voting")
                        ├── EmergencyOverlay (when activeOverlay === "emergency")
                        └── RevealOverlay (when activeOverlay === "reveal")
```

## Data Flow

### Local Player Movement

```
┌─────────────┐
│ User Input  │ WASD / Arrow Keys
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ useKeyboard()   │ Track key state
└──────┬──────────┘
       │
       ▼
┌─────────────────────────┐
│ GameEngine (60 FPS)     │ Calculate new position
│ • Read key state        │
│ • Update local position │
│ • Check boundaries      │
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────┐
│ updateLocalPlayer()      │ Update context state
│ • setPlayers(new Map)    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ emit("playerMove")       │ Send to server
│ { x, y }                 │
└──────────────────────────┘
```

### Remote Player Updates

```
┌──────────────────────────┐
│ Server                   │
│ emit("players_update")   │
│ { players: [...] }       │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ WebSocket Client         │
│ on("playersUpdate")      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ GameContext              │
│ Update players Map       │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ GameEngine               │
│ Re-render with new       │
│ player positions         │
└──────────────────────────┘
```

### Overlay Management

```
┌──────────────────────────┐
│ Phase Change             │
│ (e.g., TASK → VOTING)    │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ GameContext useEffect    │
│ Detect phase change      │
└──────┬───────────────────┘
       │
       ▼
┌──────────────────────────┐
│ setActiveOverlay()       │
│ "voting"                 │
└──────┬───────────────────┘
       │
       ├─────────────────────┐
       │                     │
       ▼                     ▼
┌──────────────┐    ┌────────────────┐
│ VotingOverlay│    │ movementLocked │
│ renders      │    │ = true         │
└──────────────┘    └────────┬───────┘
                             │
                             ▼
                    ┌────────────────┐
                    │ GameEngine     │
                    │ ignores input  │
                    └────────────────┘
```

## State Management

### GameContext State

```typescript
{
  // Core state
  phase: "LOBBY" | "ROLE" | "TASK" | "AUDIT" | "VOTING" | "REVEAL",
  
  // Player positions
  players: Map<string, {
    id: string,
    username: string,
    x: number,
    y: number,
    vx: number,
    vy: number,
    isLocal: boolean
  }>,
  
  // Local player
  localPlayerId: string,
  
  // Interaction zones
  interactionZones: [
    { id: "task-A1", x: 150, y: 150, type: "task", ... },
    { id: "emergency", x: 400, y: 250, type: "emergency", ... }
  ],
  
  // Overlay management
  activeOverlay: "task" | "voting" | "emergency" | "reveal" | null,
  activeTaskId: string | null,
  
  // Movement control
  movementLocked: boolean
}
```

### Server State (TanStack Query)

```typescript
{
  // Game state (polled every 1.5s)
  gameState: {
    phase: GamePhase,
    players: Player[],
    role: Role,
    isTamperer: boolean,
    round: number,
    timer: number,
    submissions: TaskSubmission[],
    votes: Vote[]
  },
  
  // Lobby players
  lobbyPlayers: Player[],
  
  // Ledger entries
  ledger: LedgerEntry[]
}
```

## Rendering Pipeline

### GameEngine Render Loop (60 FPS)

```
┌─────────────────────────────────────────────────────────────┐
│                    requestAnimationFrame                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Clear Canvas                                             │
│    ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT)                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Draw Grid                                                │
│    for (x = 0; x < MAP_WIDTH; x += 50) { ... }             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Draw Interaction Zones                                   │
│    interactionZones.forEach(zone => {                       │
│      ctx.fillRect(zone.x, zone.y, ...)                      │
│      ctx.strokeRect(...)                                    │
│      ctx.fillText(zone.label, ...)                          │
│    })                                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Draw Players                                             │
│    players.forEach(player => {                              │
│      ctx.arc(player.x, player.y, PLAYER_SIZE, ...)         │
│      ctx.fillText(player.username, ...)                     │
│    })                                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Request Next Frame                                       │
│    requestAnimationFrame(render)                            │
└─────────────────────────────────────────────────────────────┘
```

## WebSocket Events

### Client → Server

```
┌──────────────────────────────────────────────────────────────┐
│ Event Name      │ Payload                │ Purpose           │
├─────────────────┼────────────────────────┼───────────────────┤
│ join_room       │ { roomId, username }   │ Join game room    │
│ player_move     │ { x, y }               │ Update position   │
│ submit_task     │ { round, role, ... }   │ Complete task     │
│ cast_vote       │ { round, targetId }    │ Vote for player   │
│ call_emergency  │ { reason }             │ Trigger meeting   │
└──────────────────────────────────────────────────────────────┘
```

### Server → Client

```
┌──────────────────────────────────────────────────────────────┐
│ Event Name      │ Payload                │ Purpose           │
├─────────────────┼────────────────────────┼───────────────────┤
│ player_joined   │ { id, username, ... }  │ New player        │
│ player_left     │ { playerId }           │ Player disconnect │
│ players_update  │ { players: [...] }     │ Position sync     │
│ state_updated   │ { timer, phase }       │ Game state change │
│ phase_changed   │ { phase }              │ Phase transition  │
└──────────────────────────────────────────────────────────────┘
```

## Interaction Flow

### Task Completion

```
Player moves near zone
        │
        ▼
Zone highlights (border glow)
        │
        ▼
"Press E" hint appears
        │
        ▼
Player presses E
        │
        ▼
triggerInteraction(zoneId)
        │
        ▼
setActiveTaskId(taskId)
setActiveOverlay("task")
        │
        ▼
TaskOverlay renders
movementLocked = true
        │
        ▼
Player fills form
        │
        ▼
Click "Submit Task"
        │
        ▼
emit("submitTask", payload)
        │
        ▼
setActiveOverlay(null)
movementLocked = false
```

## Performance Considerations

### Rendering
- 60 FPS target
- Canvas size: 900x600
- ~10-20 draw calls per frame
- Minimal state updates

### Network
- Position updates: 60/sec (can throttle to 20/sec)
- State polling: 1.5s interval
- WebSocket events: real-time

### Memory
- Player positions: ~100 bytes per player
- Canvas buffer: ~2MB
- React state: minimal

## Scaling Strategy

### Single Server
```
[Client] ←WebSocket→ [Server] ←→ [In-Memory Map]
```

### Multiple Servers
```
[Client A] ←→ [Server 1] ←→ [Redis Pub/Sub] ←→ [Server 2] ←→ [Client B]
```

### Production
```
[Clients] ←→ [Load Balancer] ←→ [Server Pool] ←→ [Redis Cluster]
                                      ↓
                                [PostgreSQL]
```
