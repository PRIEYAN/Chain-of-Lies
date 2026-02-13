import { useRef, useCallback } from "react";
import { useKeyboard } from "./useKeyboard";
import { useGameLoop } from "./useGameLoop";
import {
  rooms,
  corridors,
  walls,
  taskZones,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "./map";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;

const circleRectCollision = (
  cx: number,
  cy: number,
  radius: number,
  rect: { x: number; y: number; width: number; height: number }
) => {
  const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));

  const dx = cx - closestX;
  const dy = cy - closestY;

  return dx * dx + dy * dy < radius * radius;
};

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeyboard();

  const player = useRef({
    x: 700, // Start in visible area
    y: 400,
    size: 18,
    speed: 3,
  });

  // Stable update function using useCallback
  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -------- MOVEMENT --------
let nextX = player.current.x;
let nextY = player.current.y;

// Support WASD and Arrow keys
if (keys.current["ArrowUp"] || keys.current["w"] || keys.current["W"]) {
  nextY -= player.current.speed;
}
if (keys.current["ArrowDown"] || keys.current["s"] || keys.current["S"]) {
  nextY += player.current.speed;
}
if (keys.current["ArrowLeft"] || keys.current["a"] || keys.current["A"]) {
  nextX -= player.current.speed;
}
if (keys.current["ArrowRight"] || keys.current["d"] || keys.current["D"]) {
  nextX += player.current.speed;
}

// Check collision with walls
const hitWall = walls.some((wall) =>
  circleRectCollision(
    nextX,
    nextY,
    player.current.size,
    wall
  )
);


// Only update position if not hitting wall
if (!hitWall) {
  player.current.x = nextX;
  player.current.y = nextY;
}

// Simple boundary clamping
player.current.x = Math.max(
  player.current.size,
  Math.min(MAP_WIDTH - player.current.size, player.current.x)
);
player.current.y = Math.max(
  player.current.size,
  Math.min(MAP_HEIGHT - player.current.size, player.current.y)
);
    // -------- CAMERA (temporarily disabled for testing) --------
    const cameraX = Math.max(
  0,
  Math.min(
    MAP_WIDTH - CANVAS_WIDTH,
    player.current.x - CANVAS_WIDTH / 2
  )
);

const cameraY = Math.max(
  0,
  Math.min(
    MAP_HEIGHT - CANVAS_HEIGHT,
    player.current.y - CANVAS_HEIGHT / 2
  )
);

    // -------- DRAW (proper order) --------
    
    // 1. Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 3. Save context state
    ctx.save();

    // 4. Apply camera translation (disabled for now)
    ctx.translate(-cameraX, -cameraY);

    // 5. Draw world elements
    
    // Rooms
    ctx.fillStyle = "#1f2937";
    rooms.forEach((r) => {
      ctx.fillRect(r.x, r.y, r.width, r.height);
    });

    // Corridors
    ctx.fillStyle = "#1f2937";
    corridors.forEach((c) => {
      ctx.fillRect(c.x, c.y, c.width, c.height);
    });

    // Walls
    ctx.fillStyle = "#374151";
    walls.forEach((w) => {
      ctx.fillRect(w.x, w.y, w.width, w.height);
    });

    // Task Zones
    ctx.fillStyle = "yellow";
    taskZones.forEach((t) => {
      ctx.fillRect(t.x, t.y, t.width, t.height);
    });

    // 6. Draw player
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(
      player.current.x,
      player.current.y,
      player.current.size,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Player glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = "cyan";
    ctx.beginPath();
    ctx.arc(
      player.current.x,
      player.current.y,
      player.current.size,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    // Player border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Player name
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("You", player.current.x, player.current.y - player.current.size - 8);

    // 7. Restore context state
    ctx.restore();

  }, [keys]); // Only depends on keys ref (stable)

  // Start game loop
  useGameLoop(update);

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        tabIndex={0}
        className="border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">WASD</span> or{" "}
        <span className="font-semibold text-foreground">Arrow Keys</span> to move
        <div className="text-xs mt-1">
          Position: ({Math.round(player.current.x)}, {Math.round(player.current.y)})
        </div>
      </div>
    </div>
  );
}
