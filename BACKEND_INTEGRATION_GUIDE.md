# Backend Integration Guide

This guide shows how to integrate the new game engine with the backend WebSocket server.

## Required Backend Changes

### 1. Add Player Movement Handler

```typescript
// apps/api/src/infrastructure/websocket/handlers.ts

import { wsClientMessages } from "@tamper-hunt/types";

// Store player positions in memory (or Redis for production)
const playerPositions = new Map<string, { x: number; y: number; timestamp: number }>();

export function registerPlayerMoveHandler(io: Server) {
  io.on("connection", (socket) => {
    
    // Handle player movement
    socket.on("player_move", (data) => {
      try {
        // Validate incoming data
        const validated = wsClientMessages.playerMove.parse(data);
        
        // Get player info from session
        const playerId = socket.data.playerId;
        const username = socket.data.username;
        
        if (!playerId) {
          socket.emit("error", { message: "Not authenticated" });
          return;
        }
        
        // Update position in memory
        playerPositions.set(playerId, {
          x: validated.x,
          y: validated.y,
          timestamp: Date.now(),
        });
        
        // Broadcast to all players in the same room
        const roomId = socket.data.roomId;
        if (roomId) {
          broadcastPlayerPositions(io, roomId);
        }
        
      } catch (error) {
        console.error("Invalid player_move data:", error);
        socket.emit("error", { message: "Invalid movement data" });
      }
    });
    
    // Clean up on disconnect
    socket.on("disconnect", () => {
      const playerId = socket.data.playerId;
      if (playerId) {
        playerPositions.delete(playerId);
        
        // Broadcast updated positions
        const roomId = socket.data.roomId;
        if (roomId) {
          broadcastPlayerPositions(io, roomId);
        }
      }
    });
  });
}

// Broadcast player positions to all clients in a room
function broadcastPlayerPositions(io: Server, roomId: string) {
  // Get all players in the room
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) return;
  
  const players: Array<{
    id: string;
    username: string;
    x: number;
    y: number;
  }> = [];
  
  room.forEach((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) return;
    
    const playerId = socket.data.playerId;
    const username = socket.data.username;
    const position = playerPositions.get(playerId);
    
    if (position) {
      players.push({
        id: playerId,
        username,
        x: position.x,
        y: position.y,
      });
    }
  });
  
  // Broadcast to all clients in the room
  io.to(roomId).emit("players_update", { players });
}
```

### 2. Add Position Broadcast Interval (Optional)

For smoother synchronization, broadcast positions at regular intervals:

```typescript
// apps/api/src/infrastructure/websocket/positionSync.ts

export function startPositionSync(io: Server) {
  // Broadcast positions every 100ms (10 times per second)
  setInterval(() => {
    // Get all active rooms
    const rooms = io.sockets.adapter.rooms;
    
    rooms.forEach((sockets, roomId) => {
      // Skip default rooms (socket IDs)
      if (sockets.size === 1) return;
      
      broadcastPlayerPositions(io, roomId);
    });
  }, 100);
}
```

### 3. Update Main Server File

```typescript
// apps/api/src/main.ts

import { registerPlayerMoveHandler } from "./infrastructure/websocket/handlers";
import { startPositionSync } from "./infrastructure/websocket/positionSync";

// ... existing setup

// Register WebSocket handlers
registerPlayerMoveHandler(io);

// Start position sync (optional, for smoother updates)
startPositionSync(io);

// ... rest of server setup
```

### 4. Add Session Data on Join

```typescript
// apps/api/src/infrastructure/websocket/handlers.ts

socket.on("join_room", (data) => {
  const validated = wsClientMessages.joinRoom.parse(data);
  
  // Store player info in socket session
  socket.data.playerId = generatePlayerId(); // or get from auth
  socket.data.username = validated.username;
  socket.data.roomId = validated.roomId;
  
  // Join the room
  socket.join(validated.roomId);
  
  // Initialize position (spawn point)
  playerPositions.set(socket.data.playerId, {
    x: 450, // center of map
    y: 300,
    timestamp: Date.now(),
  });
  
  // Broadcast to room
  io.to(validated.roomId).emit("player_joined", {
    id: socket.data.playerId,
    username: validated.username,
    isHost: false, // determine based on logic
    isConnected: true,
  });
  
  // Send current positions to new player
  broadcastPlayerPositions(io, validated.roomId);
});
```

## Performance Optimizations

### 1. Throttle Position Updates

```typescript
// Throttle to max 20 updates per second per player
const THROTTLE_MS = 50;
const lastUpdate = new Map<string, number>();

socket.on("player_move", (data) => {
  const playerId = socket.data.playerId;
  const now = Date.now();
  const last = lastUpdate.get(playerId) || 0;
  
  if (now - last < THROTTLE_MS) {
    return; // Skip this update
  }
  
  lastUpdate.set(playerId, now);
  
  // Process update...
});
```

### 2. Delta Compression

Only send position changes, not full state:

```typescript
const lastSentPositions = new Map<string, { x: number; y: number }>();

function broadcastPlayerPositions(io: Server, roomId: string) {
  const updates: Array<{
    id: string;
    x: number;
    y: number;
  }> = [];
  
  room.forEach((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    const playerId = socket.data.playerId;
    const position = playerPositions.get(playerId);
    const lastSent = lastSentPositions.get(playerId);
    
    // Only send if position changed significantly
    if (!lastSent || 
        Math.abs(position.x - lastSent.x) > 1 || 
        Math.abs(position.y - lastSent.y) > 1) {
      updates.push({
        id: playerId,
        x: position.x,
        y: position.y,
      });
      lastSentPositions.set(playerId, position);
    }
  });
  
  if (updates.length > 0) {
    io.to(roomId).emit("players_update", { players: updates });
  }
}
```

### 3. Use Redis for Scaling

For multiple server instances:

```typescript
import { createClient } from "redis";

const redis = createClient();
await redis.connect();

// Store positions in Redis
socket.on("player_move", async (data) => {
  const validated = wsClientMessages.playerMove.parse(data);
  const playerId = socket.data.playerId;
  const roomId = socket.data.roomId;
  
  // Store in Redis with TTL
  await redis.setEx(
    `player:${playerId}:position`,
    60, // expire after 60 seconds
    JSON.stringify({ x: validated.x, y: validated.y })
  );
  
  // Publish to Redis pub/sub
  await redis.publish(
    `room:${roomId}:positions`,
    JSON.stringify({ playerId, x: validated.x, y: validated.y })
  );
});

// Subscribe to position updates
redis.subscribe(`room:*:positions`, (message) => {
  const data = JSON.parse(message);
  // Broadcast to local WebSocket clients
  io.to(data.roomId).emit("players_update", { players: [data] });
});
```

## Collision Detection (Optional)

### Server-Side Validation

```typescript
const MAP_WIDTH = 900;
const MAP_HEIGHT = 600;
const PLAYER_SIZE = 20;

socket.on("player_move", (data) => {
  const validated = wsClientMessages.playerMove.parse(data);
  
  // Validate boundaries
  const x = Math.max(PLAYER_SIZE, Math.min(MAP_WIDTH - PLAYER_SIZE, validated.x));
  const y = Math.max(PLAYER_SIZE, Math.min(MAP_HEIGHT - PLAYER_SIZE, validated.y));
  
  // Check collision with obstacles (if any)
  if (isCollidingWithObstacle(x, y)) {
    socket.emit("error", { message: "Invalid position" });
    return;
  }
  
  // Update position
  playerPositions.set(socket.data.playerId, { x, y, timestamp: Date.now() });
  
  // Broadcast
  broadcastPlayerPositions(io, socket.data.roomId);
});

function isCollidingWithObstacle(x: number, y: number): boolean {
  // Define obstacles
  const obstacles = [
    { x: 300, y: 200, width: 100, height: 100 },
    // ... more obstacles
  ];
  
  return obstacles.some(obs => 
    x > obs.x && 
    x < obs.x + obs.width && 
    y > obs.y && 
    y < obs.y + obs.height
  );
}
```

## Testing

### 1. Test Position Updates

```typescript
// Test client
import { io } from "socket.io-client";

const socket = io("http://localhost:5000");

socket.on("connect", () => {
  console.log("Connected");
  
  // Join room
  socket.emit("join_room", { roomId: "test", username: "TestPlayer" });
  
  // Send position updates
  let x = 100;
  setInterval(() => {
    x += 5;
    socket.emit("player_move", { x, y: 100 });
  }, 100);
});

socket.on("players_update", (data) => {
  console.log("Received positions:", data.players);
});
```

### 2. Load Testing

```bash
# Install artillery
npm install -g artillery

# Create test config
cat > load-test.yml << EOF
config:
  target: "ws://localhost:5000"
  phases:
    - duration: 60
      arrivalRate: 10
  engines:
    socketio:
      transports: ["websocket"]

scenarios:
  - name: "Player Movement"
    engine: socketio
    flow:
      - emit:
          channel: "join_room"
          data:
            roomId: "test"
            username: "Player{{ \$randomNumber() }}"
      - think: 1
      - loop:
          - emit:
              channel: "player_move"
              data:
                x: "{{ \$randomNumber(0, 900) }}"
                y: "{{ \$randomNumber(0, 600) }}"
          - think: 0.1
        count: 100
EOF

# Run test
artillery run load-test.yml
```

## Monitoring

### 1. Add Metrics

```typescript
import { Counter, Histogram } from "prom-client";

const positionUpdates = new Counter({
  name: "game_position_updates_total",
  help: "Total number of position updates",
});

const positionLatency = new Histogram({
  name: "game_position_latency_ms",
  help: "Position update latency",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
});

socket.on("player_move", (data) => {
  const start = Date.now();
  
  // Process update...
  
  positionUpdates.inc();
  positionLatency.observe(Date.now() - start);
});
```

### 2. Add Logging

```typescript
import { logger } from "./infrastructure/logging";

socket.on("player_move", (data) => {
  logger.debug("Position update", {
    playerId: socket.data.playerId,
    x: data.x,
    y: data.y,
    roomId: socket.data.roomId,
  });
  
  // Process update...
});
```

## Deployment Checklist

- [ ] Backend handlers implemented
- [ ] Position sync tested locally
- [ ] Load testing completed
- [ ] Metrics and monitoring added
- [ ] Redis integration (if scaling)
- [ ] Error handling added
- [ ] Rate limiting configured
- [ ] WebSocket reconnection tested
- [ ] Cross-origin settings verified
- [ ] SSL/TLS configured for production

## Troubleshooting

### Players not syncing
1. Check WebSocket connection in browser dev tools
2. Verify `player_move` events are being emitted
3. Check server logs for errors
4. Verify room joining logic

### High latency
1. Check network tab for slow responses
2. Reduce broadcast frequency
3. Implement throttling
4. Use Redis for caching

### Memory leaks
1. Clean up on disconnect
2. Set TTL on stored positions
3. Monitor memory usage
4. Implement position cleanup job

### Scaling issues
1. Use Redis for shared state
2. Implement sticky sessions
3. Use pub/sub for cross-server communication
4. Monitor server resources
