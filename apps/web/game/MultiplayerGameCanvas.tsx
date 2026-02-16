/**
 * Multiplayer Game Canvas
 * 
 * Renders the game world and handles local player movement
 * Uses global game store for player state
 */
import { useRef, useCallback } from "react";
import { useKeyboard } from "./useKeyboard";
import { useGameLoop } from "./useGameLoop";
import { useGameStore } from "@/stores/useGameStore";
import { useGameSocket } from "@/hooks/useGameSocket";
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

export default function MultiplayerGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeyboard();

  const { players, localPlayerId, updatePlayer } = useGameStore();
  const { emitPlayerMove } = useGameSocket();

  const localPlayer = useRef({
    size: 18,
    speed: 3,
  });

  // Get local player data from store
  const localPlayerData = localPlayerId ? players[localPlayerId] : null;

  // Update function - handles local player movement and rendering
  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // -------- LOCAL PLAYER MOVEMENT --------
    if (localPlayerData) {
      let nextX = localPlayerData.x;
      let nextY = localPlayerData.y;

      // Support WASD and Arrow keys
      if (keys.current["ArrowUp"] || keys.current["w"] || keys.current["W"]) {
        nextY -= localPlayer.current.speed;
      }
      if (keys.current["ArrowDown"] || keys.current["s"] || keys.current["S"]) {
        nextY += localPlayer.current.speed;
      }
      if (keys.current["ArrowLeft"] || keys.current["a"] || keys.current["A"]) {
        nextX -= localPlayer.current.speed;
      }
      if (keys.current["ArrowRight"] || keys.current["d"] || keys.current["D"]) {
        nextX += localPlayer.current.speed;
      }

      // Check if movement occurred
      const moved = nextX !== localPlayerData.x || nextY !== localPlayerData.y;

      if (moved) {
        // INVERSE COLLISION: Check if player is in a walkable area
        const isInWalkableArea =
          rooms.some((room) => circleRectCollision(nextX, nextY, localPlayer.current.size, room)) ||
          corridors.some((corridor) => circleRectCollision(nextX, nextY, localPlayer.current.size, corridor)) ||
          taskZones.some((zone) => circleRectCollision(nextX, nextY, localPlayer.current.size, zone));

        // Check explicit walls
        const hitExplicitWall = walls.some((wall) =>
          circleRectCollision(nextX, nextY, localPlayer.current.size, wall)
        );

        // Only update position if in walkable area AND not hitting explicit wall
        if (isInWalkableArea && !hitExplicitWall) {
          // Boundary clamping
          nextX = Math.max(
            localPlayer.current.size,
            Math.min(MAP_WIDTH - localPlayer.current.size, nextX)
          );
          nextY = Math.max(
            localPlayer.current.size,
            Math.min(MAP_HEIGHT - localPlayer.current.size, nextY)
          );

          // Update local store immediately for smooth movement
          updatePlayer(localPlayerId!, { x: nextX, y: nextY });

          // Emit to server (throttled in useGameSocket)
          emitPlayerMove(nextX, nextY);
        }
      }
    }

    // -------- CAMERA --------
    let cameraX = 0;
    let cameraY = 0;

    if (localPlayerData) {
      cameraX = Math.max(
        0,
        Math.min(
          MAP_WIDTH - CANVAS_WIDTH,
          localPlayerData.x - CANVAS_WIDTH / 2
        )
      );

      cameraY = Math.max(
        0,
        Math.min(
          MAP_HEIGHT - CANVAS_HEIGHT,
          localPlayerData.y - CANVAS_HEIGHT / 2
        )
      );
    }

    // -------- TASK PROXIMITY CHECK --------
    let canInteract = false;
    if (localPlayerData) {
      canInteract = taskZones.some((zone) =>
        circleRectCollision(
          localPlayerData.x,
          localPlayerData.y,
          localPlayer.current.size,
          zone
        )
      );

      if (canInteract && (keys.current["e"] || keys.current["E"])) {
        // Trigger task interaction
        // This would emit a socket event in real implementation
      }
    }

    // -------- RENDERING --------

    // 1. Clear canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 2. Draw background
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 3. Save context state
    ctx.save();

    // 4. Apply camera translation
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
    ctx.fillStyle = "#333c4cff";
    walls.forEach((w) => {
      ctx.fillRect(w.x, w.y, w.width, w.height);
    });

    // Task Zones
    ctx.fillStyle = "rgba(255, 255, 0, 0.3)";
    taskZones.forEach((t) => {
      ctx.fillRect(t.x, t.y, t.width, t.height);
    });

    // 6. Draw all players
    Object.values(players).forEach((player) => {
      const isLocal = player.id === localPlayerId;

      // Player circle
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(
        player.x,
        player.y,
        localPlayer.current.size,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Glow effect for local player
      if (isLocal) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = player.color;
        ctx.beginPath();
        ctx.arc(
          player.x,
          player.y,
          localPlayer.current.size,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Player border
      ctx.strokeStyle = isLocal ? "#fff" : "#000";
      ctx.lineWidth = isLocal ? 3 : 2;
      ctx.stroke();

      // Player name
      ctx.fillStyle = "#fff";
      ctx.font = isLocal ? "bold 12px 'IBM Plex Sans', sans-serif" : "11px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        isLocal ? `${player.name} (You)` : player.name,
        player.x,
        player.y - localPlayer.current.size - 8
      );

      // Host badge
      if (player.isHost) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px 'IBM Plex Sans', sans-serif";
        ctx.fillText("👑", player.x, player.y - localPlayer.current.size - 22);
      }
    });

    // 7. Interaction prompt
    if (canInteract && localPlayerData) {
      ctx.fillStyle = "yellow";
      ctx.font = "bold 14px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Press E to interact",
        localPlayerData.x,
        localPlayerData.y - localPlayer.current.size - 35
      );
    }

    // 8. Restore context state
    ctx.restore();

  }, [keys, players, localPlayerId, localPlayerData, updatePlayer, emitPlayerMove]);

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
        {localPlayerData && (
          <div className="text-xs mt-1">
            Position: ({Math.round(localPlayerData.x)}, {Math.round(localPlayerData.y)}) |
            Players: {Object.keys(players).length}
          </div>
        )}
      </div>
    </div>
  );
}
