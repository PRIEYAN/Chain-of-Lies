# Quick Start Guide - 2D Game Engine

## Overview

Your application now uses a 2D canvas-based game engine as the primary interface. Players move around a map, interact with task zones, and overlays appear for voting and other game phases.

## Running the Application

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Build Shared Packages

```bash
pnpm --filter @tamper-hunt/types build
pnpm --filter @tamper-hunt/shared build
```

### 3. Start Development Servers

```bash
# Start both frontend and backend
pnpm dev

# Or start individually:
pnpm --filter @tamper-hunt/api dev     # Backend on :5000
pnpm --filter @tamper-hunt/web dev     # Frontend on :3000
```

### 4. Open Browser

Navigate to http://localhost:3000

## Game Flow

### 1. Landing Page (/)
- Click "Join Game" or "Create Room"

### 2. Lobby (/lobby)
- Wait for players to join
- Host clicks "Start Game"

### 3. Role Reveal (/role)
- View your assigned role
- Click "Continue to Game"

### 4. Game View (/game)
- **2D canvas with your player**
- Move using WASD or Arrow Keys
- Approach blue zones (tasks)
- Press E to interact

### 5. Task Completion
- Modal opens with task details
- Enter your response
- Click "Submit Task"
- Repeat for other tasks

### 6. Emergency Meeting
- Move to red zone (center)
- Press E to call emergency
- Discuss with other players
- Proceed to voting

### 7. Voting (/voting)
- Full-screen overlay appears
- Select player to eliminate
- Click "Cast Vote"

### 8. Reveal (/reveal)
- See voting results
- Roles are revealed
- Winner announced
- Start next round

## Controls

### Movement
- **W** or **↑** - Move up
- **S** or **↓** - Move down
- **A** or **←** - Move left
- **D** or **→** - Move right

### Interaction
- **E** - Interact with zone (when near)

## UI Elements

### HUD (Always Visible)
- **Top Left**: Phase badge, Round counter
- **Top Center**: Timer
- **Top Right**: Role badge, Player count
- **Bottom Center**: Control hints

### Overlays (Conditional)
- **Task Modal**: Opens when interacting with task zone
- **Voting Screen**: Full-screen during voting phase
- **Emergency Dialog**: When emergency is called
- **Reveal Screen**: Shows round results

## Interaction Zones

### Task Zones (Blue)
- **Block Header** (top-left)
- **State Root** (top-right)
- **Tx Set** (bottom-left)
- **Gas & Fees** (bottom-right)

### Emergency Zone (Red)
- **Emergency Button** (center)

## Testing Locally

### Single Player
1. Start the app
2. Navigate to /game directly
3. Move around and interact with zones
4. Test overlays by changing phase

### Multiplayer (Requires Backend)
1. Open multiple browser tabs
2. Join same room in each tab
3. Move in one tab
4. See position update in other tabs

## Troubleshooting

### Canvas not rendering
- Check browser console for errors
- Verify canvas element exists
- Check if GameEngine component is mounted

### Movement not working
- Check keyboard focus (click on canvas)
- Verify useKeyboard hook is working
- Check browser console for errors

### Overlays not appearing
- Check activeOverlay state in React DevTools
- Verify phase transitions
- Check z-index values in CSS

### Players not syncing
- Verify WebSocket connection (Network tab)
- Check backend is running
- Verify socket events are being emitted

## Development Tips

### Hot Reload
- Frontend changes reload automatically
- Backend changes require restart
- Type changes require rebuild

### Debugging
- Use React DevTools to inspect state
- Use Network tab to monitor WebSocket
- Use Console to see socket events
- Use Performance tab to check FPS

### Adding New Features

#### Add New Task Zone
```typescript
// In GameContext.tsx
const interactionZones: InteractionZone[] = [
  // ... existing zones
  { 
    id: "task-C1", 
    x: 400, y: 450, 
    width: 80, height: 80, 
    type: "task", 
    label: "New Task", 
    taskId: "C1" 
  },
];
```

#### Add New Overlay
```typescript
// 1. Create component in src/components/overlays/
// 2. Add to GameView in App.tsx
// 3. Add state to GameContext
// 4. Trigger via setActiveOverlay()
```

#### Customize Map
```typescript
// In GameEngine.tsx
const MAP_WIDTH = 1200;  // Change dimensions
const MAP_HEIGHT = 800;

// Add custom rendering in render loop
ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
ctx.fillRect(100, 100, 200, 200); // Custom element
```

## Next Steps

### Immediate
1. Test all game phases
2. Verify task submission
3. Test voting flow
4. Check multiplayer sync

### Backend Integration
1. Implement `player_move` handler
2. Implement `players_update` broadcast
3. Test position synchronization
4. Add error handling

### Enhancements
1. Add player animations
2. Implement smooth interpolation
3. Add sound effects
4. Create multiple maps
5. Add minimap to HUD

## Resources

- **Architecture**: See `GAME_ENGINE_ARCHITECTURE.md`
- **Implementation**: See `IMPLEMENTATION_SUMMARY.md`
- **Backend**: See `BACKEND_INTEGRATION_GUIDE.md`
- **Original README**: See `README.md`

## Support

If you encounter issues:
1. Check browser console for errors
2. Verify all dependencies are installed
3. Ensure backend is running
4. Check WebSocket connection
5. Review documentation files

## Performance

### Target Metrics
- 60 FPS rendering
- < 50ms input latency
- < 100ms network latency
- Smooth movement

### If Performance Issues
1. Reduce canvas size
2. Throttle position updates
3. Disable glow effects
4. Simplify rendering

## Production Deployment

### Build
```bash
pnpm build
```

### Environment Variables
```bash
# Frontend (.env)
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com

# Backend (.env)
PORT=5000
NODE_ENV=production
DATABASE_URL=postgresql://...
```

### Deploy
1. Build all packages
2. Deploy backend to server
3. Deploy frontend to CDN/hosting
4. Configure WebSocket proxy
5. Test in production

## License

See LICENSE file in repository root.
