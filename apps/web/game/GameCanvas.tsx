import { useRef, useCallback, useState, useEffect } from "react";
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
import BrokenSequencePopup from "./tasks/task1";
import BlockBouncePopup from "./tasks/task2";
import GasFeeRunnerPopup from "./tasks/task3";
import MemoryMinerPopup from "./tasks/task4";

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

const TASK_ZONE_LABELS = [
  "Cafeteria",
  "Weapons",
  "Navigation",
  "Shields",
  "O2",
  "Admin",
  "Storage",
  "Electrical",
  "Lower Engine",
  "Security",
  "Reactor",
  "Upper Engine",
  "Medbay",
];

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeyboard();

  // Task 1 (Cafeteria zone, index 0) popup state
  const [showPuzzle, setShowPuzzle] = useState(false);
  // Task 2 (Weapons zone, index 1) popup state
  const [showBounce, setShowBounce] = useState(false);
  // Task 3 (Navigation zone, index 2) popup state
  const [showGasFee, setShowGasFee] = useState(false);
  // Task 4 (Shields zone, index 2) popup state
  const [showMiner, setShowMiner] = useState(false);

  // Track which task zone the player is near (for E-key trigger)
  const nearTaskIndexRef = useRef<number | null>(null);
  const eWasPressed = useRef(false);

  const player = useRef({
    x: 700,
    y: 400,
    size: 18,
    speed: 3,
  });

  // ESC closes any open task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPuzzle(false);
        setShowBounce(false);
        setShowGasFee(false);
        setShowMiner(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isAnyTaskOpen = showPuzzle || showBounce || showGasFee || showMiner;

    // -------- MOVEMENT (blocked while a task is open) --------
    if (!isAnyTaskOpen) {
      let nextX = player.current.x;
      let nextY = player.current.y;

      if (keys.current["ArrowUp"] || keys.current["w"] || keys.current["W"]) nextY -= player.current.speed;
      if (keys.current["ArrowDown"] || keys.current["s"] || keys.current["S"]) nextY += player.current.speed;
      if (keys.current["ArrowLeft"] || keys.current["a"] || keys.current["A"]) nextX -= player.current.speed;
      if (keys.current["ArrowRight"] || keys.current["d"] || keys.current["D"]) nextX += player.current.speed;

      const isInWalkableArea =
        rooms.some((r) => circleRectCollision(nextX, nextY, player.current.size, r)) ||
        corridors.some((c) => circleRectCollision(nextX, nextY, player.current.size, c)) ||
        taskZones.some((z) => circleRectCollision(nextX, nextY, player.current.size, z));

      const hitWall = walls.some((w) => circleRectCollision(nextX, nextY, player.current.size, w));

      if (isInWalkableArea && !hitWall) {
        player.current.x = nextX;
        player.current.y = nextY;
      }

      player.current.x = Math.max(player.current.size, Math.min(MAP_WIDTH - player.current.size, player.current.x));
      player.current.y = Math.max(player.current.size, Math.min(MAP_HEIGHT - player.current.size, player.current.y));
    }

    // -------- CAMERA --------
    const cameraX = Math.max(0, Math.min(MAP_WIDTH - CANVAS_WIDTH, player.current.x - CANVAS_WIDTH / 2));
    const cameraY = Math.max(0, Math.min(MAP_HEIGHT - CANVAS_HEIGHT, player.current.y - CANVAS_HEIGHT / 2));

    // -------- TASK PROXIMITY CHECK --------
    let nearTaskIndex: number | null = null;
    taskZones.forEach((zone, index) => {
      if (circleRectCollision(player.current.x, player.current.y, player.current.size, zone)) {
        nearTaskIndex = index;
      }
    });
    nearTaskIndexRef.current = nearTaskIndex;

    const canInteract = nearTaskIndex !== null;

    // E key: open task on press (edge-trigger, not hold)
    const ePressed = !!(keys.current["e"] || keys.current["E"]);
    if (canInteract && ePressed && !eWasPressed.current && !isAnyTaskOpen) {
      // Task zone 0 = Cafeteria → Task 1
      if (nearTaskIndex === 0) {
        setShowPuzzle(true);
      }
      // Task zone 1 = Weapons → Task 2
      else if (nearTaskIndex === 1) {
        setShowBounce(true);
      }
      // Task zone 2 = Navigation → Task 3
      else if (nearTaskIndex === 2) {
        setShowGasFee(true);
      }
      // Task zone 3 = Navigation → Task 3
      else if (nearTaskIndex === 3) {
        setShowMiner(true);
      }
    }
    eWasPressed.current = ePressed;

    // -------- DRAW --------
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // Rooms
    ctx.fillStyle = "#1f2937";
    rooms.forEach((r) => ctx.fillRect(r.x, r.y, r.width, r.height));

    // Corridors
    ctx.fillStyle = "#1f2937";
    corridors.forEach((c) => ctx.fillRect(c.x, c.y, c.width, c.height));

    // Walls
    ctx.fillStyle = "#333c4cff";
    walls.forEach((w) => ctx.fillRect(w.x, w.y, w.width, w.height));

    // Task Zones
    taskZones.forEach((t, index) => {
      ctx.fillStyle = index === nearTaskIndex ? "#facc15" : "#eab308";
      ctx.fillRect(t.x, t.y, t.width, t.height);

      ctx.fillStyle = "#000";
      ctx.font = "bold 9px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        TASK_ZONE_LABELS[index] ?? `Task ${index + 1}`,
        t.x + t.width / 2,
        t.y + t.height / 2 + 4
      );
    });

    // Player
    ctx.fillStyle = "cyan";
    ctx.beginPath();
    ctx.arc(player.current.x, player.current.y, player.current.size, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 15;
    ctx.shadowColor = "cyan";
    ctx.beginPath();
    ctx.arc(player.current.x, player.current.y, player.current.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'IBM Plex Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("You", player.current.x, player.current.y - player.current.size - 8);

    // Interaction prompt
    if (canInteract && !isAnyTaskOpen) {
      ctx.fillStyle = "#facc15";
      ctx.font = "bold 14px 'IBM Plex Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        "Press E to interact",
        player.current.x,
        player.current.y - player.current.size - 25
      );
    }

    ctx.restore();
  }, [keys, showPuzzle, showBounce, showGasFee, showMiner]);

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

      {/* Task 1 — renders its own fixed overlay */}
      <BrokenSequencePopup
        isOpen={showPuzzle}
        onClose={() => setShowPuzzle(false)}
      />

      {/* Task 2 — renders its own fixed overlay */}
      <BlockBouncePopup
        isOpen={showBounce}
        onClose={() => setShowBounce(false)}
      />

      <GasFeeRunnerPopup
        isOpen={showGasFee}
        onClose={() => setShowGasFee(false)}
      />

      <MemoryMinerPopup
        isOpen={showMiner}
        onClose={() => setShowMiner(false)}
      />

      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">WASD</span> or{" "}
        <span className="font-semibold text-foreground">Arrow Keys</span> to move ·{" "}
        <span className="font-semibold text-foreground">E</span> to interact
        <div className="text-xs mt-1">
          Position: ({Math.round(player.current.x)}, {Math.round(player.current.y)})
        </div>
      </div>
    </div>
  );
}
