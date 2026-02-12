# Game Engine Architecture

## Overview

The application has been refactored to use a 2D canvas-based game engine as the primary interface. Players move around a map, interact with task zones, and overlays appear for voting, emergencies, and reveals.

## Architecture Layers

### 1. React State (Source of Truth)
- **GameContext** (`src/contexts/GameContext.tsx`) - Global game state
  - Player positions (local + remote)
  - Interaction zones
  - Active overlays
  - Phase management
  - Movement lock state

### 2. GameEngine (Visual Renderer)
- **GameEngine** (`src/components/GameEngine.tsx`) - Canvas renderer
  - Renders 2D map with grid
  - Renders all players (local + remote)
  - Renders interaction zones
  - Handles keyboard input (WASD/Arrow keys)
  - Emits movement events via socket
  - Checks for zone proximity
  - Pure visual layer - no business logic

### 3. UI Overlays (Absolute Positioned)
- **HUD** - Always visible game info (phase, timer, role, player count)
- **TaskOverlay** - Modal for task completion
- **VotingOverlay** - Full-screen voting interface
- **EmergencyOverlay** - Emergency meeting dialog
- **RevealOverlay** - End-of-round results

### 4. Socket Events
- **Client → Server**
  - `playerMove` - Position updates
  - `submitTask` - Task completion
  - `castVote` - Vote submission
  - `callEmergency` - Emergency trigger

- **Server → Client**
  - `playersUpdate` - Remote player positions
  - `stateUpdated` - Game state changes
  - `phaseChanged` - Phase transitions

## Component Hierarchy

```
<App>
  <GameProvider>                    // Global state context
    <Router>
      <GameView>                    // Active during game phases
        <GameEngine />              // Canvas renderer
        <HUD />                     // Always visible overlay
        <TaskOverlay />             // Conditional overlay
        <VotingOverlay />           // Conditional overlay
        <EmergencyOverlay />        // Conditional overlay
        <RevealOverlay />           // Conditional overlay
      </GameView>
    </Router>
  </GameProvider>
</App>
```

## Game Flow

### Phase: TASK
1. Player moves around map using WASD/Arrow keys
2. Player approaches task zone (highlighted border)
3. "Press E" hint appears
4. Player presses E → TaskOverlay opens
5. Player completes task → Overlay closes
6. Repeat for other tasks
7. Player can trigger emergency meeting at any time

### Phase: VOTING
1. Movement is locked (`movementLocked = true`)
2. VotingOverlay appears (full-screen, dark background)
3. Canvas continues rendering in background
4. Player selects target and casts vote
5. Transitions to REVEAL phase

### Phase: REVEAL
1. Movement remains locked
2. RevealOverlay shows results
3. Roles are revealed
4. Winner is announced
5. Option to start next round

## Interaction Zones

Defined in `GameContext.tsx`:

```typescript
const interactionZones: InteractionZone[] = [
  { 
    id: "task-A1", 
    x: 150, y: 150, 
    width: 80, height: 80, 
    type: "task", 
    label: "Block Header", 
    taskId: "A1" 
  },
  // ... more zones
  { 
    id: "emergency", 
    x: 400, y: 250, 
    width: 100, height: 60, 
    type: "emergency", 
    label: "Emergency" 
  },
];
```

## Movement System

### Keyboard Input
- WASD or Arrow Keys for movement
- E key for interaction
- Movement is normalized for diagonal movement
- Boundary collision detection

### Position Sync
1. Local player position updates at 60 FPS
2. Position emitted to server via `playerMove` event
3. Server broadcasts to all clients via `playersUpdate`
4. Remote players rendered based on received positions

### Movement Lock
- Locked during VOTING and EMERGENCY phases
- Prevents movement while overlays are active
- Canvas continues rendering background

## State Management

### Local State (React)
```typescript
const [players, setPlayers] = useState<Map<string, PlayerPosition>>(new Map());
const [activeOverlay, setActiveOverlay] = useState<"task" | "voting" | null>(null);
const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
```

### Server State (TanStack Query)
```typescript
const { data: gameState } = useGameState(); // Phase, timer, role, etc.
const { data: players } = useLobbyPlayers(); // Player list
```

### WebSocket State
```typescript
const { emit, on } = useGameSocket();

// Emit events
emit("playerMove", { x, y });
emit("submitTask", { round, role, payload });

// Listen for events
on("playersUpdate", (data) => { /* update remote players */ });
on("stateUpdated", (data) => { /* update game state */ });
```

## Rendering Pipeline

### GameEngine Render Loop
```typescript
const render = () => {
  // 1. Clear canvas
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  
  // 2. Draw grid
  // ... grid rendering
  
  // 3. Draw interaction zones
  interactionZones.forEach(zone => {
    // Zone background, border, label
    // Highlight if player is near
  });
  
  // 4. Draw all players
  players.forEach(player => {
    // Player circle with glow
    // Player name above
  });
  
  // 5. Request next frame
  requestAnimationFrame(render);
};
```

## Overlay System

### Overlay Activation
- Overlays are controlled by `activeOverlay` state
- Phase changes can trigger overlays automatically
- User interactions can trigger overlays (E key, emergency button)

### Overlay Styling
```css
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
}
```

### Overlay Behavior
- Dark translucent background
- Centered content
- Locks movement when active
- Canvas continues rendering behind

## Multiplayer Synchronization

### Position Updates
```typescript
// Client A moves
updateLocalPlayer(newX, newY, vx, vy);
  ↓
emit("playerMove", { x: newX, y: newY });
  ↓
// Server receives and broadcasts
  ↓
on("playersUpdate", ({ players }) => {
  // Client B receives
  setPlayers(/* update remote players */);
});
```

### State Synchronization
- Game state polled every 1.5s via TanStack Query
- WebSocket events provide real-time updates
- Optimistic updates for local player movement

## File Structure

```
apps/web/src/
├── contexts/
│   └── GameContext.tsx           # Global game state
├── components/
│   ├── GameEngine.tsx            # Canvas renderer
│   ├── HUD.tsx                   # Game info overlay
│   └── overlays/
│       ├── TaskOverlay.tsx       # Task completion modal
│       ├── VotingOverlay.tsx     # Voting interface
│       ├── EmergencyOverlay.tsx  # Emergency meeting
│       └── RevealOverlay.tsx     # Round results
├── hooks/
│   ├── use-keyboard.ts           # Keyboard input hook
│   ├── use-websocket.ts          # WebSocket hook
│   └── use-game.ts               # Game state hooks
└── App.tsx                       # Root component
```

## Key Design Decisions

### Why Canvas?
- Smooth 60 FPS rendering
- Full control over rendering pipeline
- Easy to add animations and effects
- Better performance than DOM manipulation

### Why Separate Overlays?
- Clear separation of concerns
- Easy to add/remove features
- Overlays can be tested independently
- Canvas continues rendering behind

### Why Global Context?
- Single source of truth
- Easy to access from any component
- Prevents prop drilling
- Simplifies state management

### Why Movement Lock?
- Prevents accidental movement during voting
- Ensures players focus on overlay content
- Maintains game balance

## Future Enhancements

### Planned Features
- [ ] Smooth player interpolation for remote players
- [ ] Player animations (walking, idle)
- [ ] Map obstacles and collision detection
- [ ] Minimap in HUD
- [ ] Chat overlay
- [ ] Task completion indicators on map
- [ ] Visual effects for emergency meetings
- [ ] Sound effects and music
- [ ] Multiple map layouts
- [ ] Spectator mode

### Performance Optimizations
- [ ] Canvas offscreen rendering
- [ ] Spatial partitioning for collision detection
- [ ] Throttle position updates to server
- [ ] Delta compression for position updates
- [ ] WebGL renderer for advanced effects

## Testing Strategy

### Unit Tests
- GameContext state management
- Keyboard input handling
- Zone collision detection
- Position normalization

### Integration Tests
- WebSocket event flow
- Overlay transitions
- Phase management
- Movement lock behavior

### E2E Tests
- Complete game flow
- Multiplayer synchronization
- Task completion
- Voting and reveal

## Troubleshooting

### Players not syncing
- Check WebSocket connection
- Verify `playersUpdate` event is received
- Check server is broadcasting positions

### Movement feels laggy
- Reduce position update frequency
- Add client-side prediction
- Implement interpolation for remote players

### Overlays not appearing
- Check `activeOverlay` state
- Verify phase transitions
- Check z-index values

### Canvas not rendering
- Check canvas ref is set
- Verify requestAnimationFrame loop
- Check canvas dimensions

## Migration Guide

### From Old Architecture
1. Remove old page components (GamePage, AuditPage, etc.)
2. Update routes to use GameView
3. Wrap app in GameProvider
4. Update socket events to include playerMove
5. Test all game phases

### Rollback Plan
1. Keep old components in `pages/` directory
2. Add feature flag for new engine
3. Gradual rollout to users
4. Monitor performance metrics
