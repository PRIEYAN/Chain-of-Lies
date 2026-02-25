/**
 * Multiplayer Game Canvas
 * 
 * Renders the game world and handles local player movement
 * Uses global game store for player state
 */
import { useRef, useCallback, useState, useEffect } from "react";
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
import BrokenSequencePopup from "./tasks/task1";
import BlockBouncePopup from "./tasks/task2";
import GasFeeRunnerPopup from "./tasks/task3";
import MemoryMinerPopup from "./tasks/task4";
import BlockCatcherPopup from "./tasks/task5";
import SmartContractQuickFixPopup from "./tasks/task6";
import ColourPredictionSpinnerPopup from "./tasks/task7";
import ColorSpinPopup from "./tasks/task8";
import ElevatorLeverPopup from "./tasks/task9";

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

export default function MultiplayerGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeyboard();

  const { players, localPlayerId, updatePlayer, phase, isAlive } = useGameStore();
  const { emitPlayerMove } = useGameSocket();

  // Task states
  const [showPuzzle, setShowPuzzle] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const [showGasFee, setShowGasFee] = useState(false);
  const [showMiner, setShowMiner] = useState(false);
  const [showCatcher, setShowCatcher] = useState(false);
  const [showFix, setShowFix] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [showColorSpin, setShowColorSpin] = useState(false);
  const [showElevatorLever, setShowElevatorLever] = useState(false);

  const eWasPressed = useRef(false);

  const localPlayer = useRef({
    size: 15,
    speed: 0.7,
  });

  // Get local player data from store
  const localPlayerData = localPlayerId ? players[localPlayerId] : null;

  // ESC closes any open task
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPuzzle(false);
        setShowBounce(false);
        setShowGasFee(false);
        setShowMiner(false);
        setShowCatcher(false);
        setShowFix(false);
        setShowSpinner(false);
        setShowColorSpin(false);
        setShowElevatorLever(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Update function - handles local player movement and rendering
  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isAnyTaskOpen = showPuzzle || showBounce || showGasFee || showMiner || showCatcher || showFix || showSpinner || showColorSpin || showElevatorLever;

    // -------- LOCAL PLAYER MOVEMENT --------
    // Allow movement only during TASKS phase and if player is alive
    if (localPlayerData && !isAnyTaskOpen && phase === "TASKS" && isAlive) {
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
    let nearTaskIndex: number | null = null;
    if (localPlayerData) {
      taskZones.forEach((zone, index) => {
        if (circleRectCollision(localPlayerData.x, localPlayerData.y, localPlayer.current.size, zone)) {
          nearTaskIndex = index;
        }
      });

      const canInteract = nearTaskIndex !== null;

      const ePressed = !!(keys.current["e"] || keys.current["E"]);
      if (canInteract && ePressed && !eWasPressed.current && !isAnyTaskOpen) {
        if (nearTaskIndex === 0) {
          setShowPuzzle(true);
        } else if (nearTaskIndex === 1) {
          setShowBounce(true);
        } else if (nearTaskIndex === 2) {
          setShowGasFee(true);
        } else if (nearTaskIndex === 3) {
          setShowMiner(true);
        } else if (nearTaskIndex === 4) {
          setShowCatcher(true);
        } else if (nearTaskIndex === 5) {
          setShowFix(true);
        } else if (nearTaskIndex === 6) {
          setShowSpinner(true);
        } else if (nearTaskIndex === 7) {
          setShowColorSpin(true);
        } else if (nearTaskIndex === 8) {
          setShowElevatorLever(true);
        }
      }
      eWasPressed.current = ePressed;
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

    // 6. Draw all players
    Object.values(players).forEach((player) => {
      const isLocal = player.id === localPlayerId;

      let renderX = player.x;
      let renderY = player.y;

      // Interpolate remote players for smooth movement
      if (!isLocal && player.targetX !== undefined && player.targetY !== undefined) {
        const interpSpeed = 0.15;
        renderX += (player.targetX - player.x) * interpSpeed;
        renderY += (player.targetY - player.y) * interpSpeed;

        // Update player position gradually
        if (Math.abs(player.targetX - player.x) > 0.5 || Math.abs(player.targetY - player.y) > 0.5) {
          updatePlayer(player.id, { x: renderX, y: renderY });
        }
      }

      // Player circle
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(
        renderX,
        renderY,
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
          renderX,
          renderY,
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
        renderX,
        renderY - localPlayer.current.size - 8
      );

      // Host badge
      if (player.isHost) {
        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px 'IBM Plex Sans', sans-serif";
        ctx.fillText("👑", renderX, renderY - localPlayer.current.size - 22);
      }
    });

    // 7. Interaction prompt
    if (nearTaskIndex !== null && localPlayerData && !isAnyTaskOpen) {
      ctx.fillStyle = "#facc15";
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

  }, [keys, players, localPlayerId, localPlayerData, updatePlayer, emitPlayerMove, showPuzzle, showBounce, showGasFee, showMiner, showCatcher, showFix, showSpinner, showColorSpin, showElevatorLever]);

  // Start game loop
  useGameLoop(update);

  return (
    <div className="flex flex-col items-center gap-4">
      <div style={{ position: "relative", display: "inline-block" }}>
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

        <BlockCatcherPopup
          isOpen={showCatcher}
          onClose={() => setShowCatcher(false)}
        />

        <SmartContractQuickFixPopup
          isOpen={showFix}
          onClose={() => setShowFix(false)}
        />

        <ColourPredictionSpinnerPopup
          isOpen={showSpinner}
          onClose={() => setShowSpinner(false)}
        />

        <ColorSpinPopup
          isOpen={showColorSpin}
          onClose={() => setShowColorSpin(false)}
        />

        <ElevatorLeverPopup
          isOpen={showElevatorLever}
          onClose={() => setShowElevatorLever(false)}
        />
      </div>

      <div className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">WASD</span> or{" "}
        <span className="font-semibold text-foreground">Arrow Keys</span> to move ·{" "}
        <span className="font-semibold text-foreground">E</span> to interact
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
