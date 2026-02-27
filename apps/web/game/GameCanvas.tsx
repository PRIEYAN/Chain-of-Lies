import { useRef, useCallback, useState, useEffect } from "react";
import { useKeyboard } from "./useKeyboard";
import { useGameLoop } from "./useGameLoop";
import { useGameStore } from "@/stores/useGameStore";
import {
  rooms,
  corridors,
  walls,
  taskZones,
  MAP_WIDTH,
  MAP_HEIGHT,
} from "./map";


import bottomCornerLeftSrc from "../assests/ground/bottomCornerLeft.png";
import bottomCornerRightSrc from "../assests/ground/bottomCornerRight.png";
import bottomMidSrc from "../assests/ground/bottomMid.png";
import centertilesSrc from "../assests/ground/centertiles.png";
import centertiles1Src from "../assests/ground/centertiles11.png";
import centertilesNormalSrc from "../assests/ground/centertilesNormal.png";
import centertilesSpecialSrc from "../assests/ground/centertilesSpecial.png";
import centertilesSpecial1Src from "../assests/ground/centertilesSpecial1.png";
import leftsideSrc from "../assests/ground/leftside.png";
import rightTileSrc from "../assests/ground/rightTile.png";
import topCornerLeftSrc from "../assests/ground/topCornerLeft.png";
import topCornerRightSrc from "../assests/ground/topCornerRight.png";
import topMidSrc from "../assests/ground/TopMid.png";


import taskCompletedSrc from "../assests/obj/taskCompleted.png";
import taskNotCompletedSrc from "../assests/obj/taskNotCompleted.png";

import fenceLeftSrc from "../assests/collisionObj/left.png";
import fenceMidSrc from "../assests/collisionObj/mid.png";
import fenceRightSrc from "../assests/collisionObj/right.png";

import BrokenSequencePopup from "./tasks/task1";
import BlockBouncePopup from "./tasks/task2";
import GasFeeRunnerPopup from "./tasks/task3";
import MemoryMinerPopup from "./tasks/task4";
import BlockCatcherPopup from "./tasks/task5";
import SmartContractQuickFixPopup from "./tasks/task6";
import ColourPredictionSpinnerPopup from "./tasks/task7";
import ColorSpinPopup from "./tasks/task8";
import ElevatorLeverPopup from "./tasks/task9";
import NonceFinderPopup from "./tasks/task10";
import MempoolCleanupPopup from "./tasks/task11";
import ConsensusAlignmentPopup from "./tasks/task12";
import BridgeGuardianPopup from "./tasks/task13";

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
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeyboard();
  const { completedTasks } = useGameStore();

  // Task 1 (Cafeteria zone, index 0) popup state
  const [showPuzzle, setShowPuzzle] = useState(false);
  // Task 2 (Weapons zone, index 1) popup state
  const [showBounce, setShowBounce] = useState(false);
  // Task 3 (Navigation zone, index 2) popup state
  const [showGasFee, setShowGasFee] = useState(false);
  // Task 4 (Shields zone, index 3) popup state
  const [showMiner, setShowMiner] = useState(false);
  // Task 5 (O2 zone, index 4) popup state
  const [showCatcher, setShowCatcher] = useState(false);
  // Task 6 (Admin zone, index 5) popup state
  const [showFix, setShowFix] = useState(false);
  // Task 7 (Storage zone, index 6) popup state
  const [showSpinner, setShowSpinner] = useState(false);
  // Task 8 (Electrical zone, index 7) popup state
  const [showColorSpin, setShowColorSpin] = useState(false);
  // Task 9 (Lower Engine zone, index 8) popup state
  const [showElevatorLever, setShowElevatorLever] = useState(false);
  // Task 10 (Security zone, index 9) popup state
  const [showNonceFinder, setShowNonceFinder] = useState(false);
  // Task 11 (Reactor zone, index 10) popup state
  const [showMempoolCleanup, setShowMempoolCleanup] = useState(false);
  // Task 12 (Upper Engine zone, index 11) popup state
  const [showConsensusAlignment, setShowConsensusAlignment] = useState(false);
  // Task 13 (Medbay zone, index 12) popup state
  const [showBridgeGuardian, setShowBridgeGuardian] = useState(false);

  // Track which task zone the player is near (for E-key trigger)
  const nearTaskIndexRef = useRef<number | null>(null);
  const eWasPressed = useRef(false);

  const player = useRef({
    x: 278,
    y: 264,
    size: 15,
    speed: 0.7,
  });

  const loadedImagesRef = useRef<Record<string, HTMLImageElement>>({});

  // Background init
  useEffect(() => {
    const images = [
      { key: "bottomCornerLeft", src: bottomCornerLeftSrc },
      { key: "bottomCornerRight", src: bottomCornerRightSrc },
      { key: "bottomMid", src: bottomMidSrc },
      { key: "centertiles", src: centertilesSrc },
      { key: "centertiles1", src: centertiles1Src },
      { key: "centertilesNormal", src: centertilesNormalSrc },
      { key: "centertilesSpecial", src: centertilesSpecialSrc },
      { key: "centertilesSpecial1", src: centertilesSpecial1Src },
      { key: "leftside", src: leftsideSrc },
      { key: "rightTile", src: rightTileSrc },
      { key: "topCornerLeft", src: topCornerLeftSrc },
      { key: "topCornerRight", src: topCornerRightSrc },
      { key: "topMid", src: topMidSrc },
      { key: "taskCompleted", src: taskCompletedSrc },
      { key: "taskNotCompleted", src: taskNotCompletedSrc },
      { key: "fenceLeft", src: fenceLeftSrc },
      { key: "fenceMid", src: fenceMidSrc },
      { key: "fenceRight", src: fenceRightSrc },
    ];

    const loadedImages: Record<string, HTMLImageElement> = {};
    let loadedCount = 0;
    const totalImages = images.length;

    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        renderBackgroundCanvas();
      }
    };

    for (const { key, src } of images) {
      const img = new Image();
      img.onload = onImageLoad;
      img.onerror = onImageLoad;
      img.src = typeof src === 'string' ? src : (src as any).src || (src as any).default || src;
      loadedImagesRef.current[key] = img;
    }

    const isWalkable = (x: number, y: number) => {
      return (
        rooms.some((r) => x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height) ||
        corridors.some((c) => x >= c.x && x < c.x + c.width && y >= c.y && y < c.y + c.height) ||
        taskZones.some((z) => x >= z.x && x < z.x + z.width && y >= z.y && y < z.y + z.height)
      );
    };

    const renderBackgroundCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = MAP_WIDTH;
      canvas.height = MAP_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const TILE_SIZE = 50;
      const cols = Math.ceil(MAP_WIDTH / TILE_SIZE);
      const rows = Math.ceil(MAP_HEIGHT / TILE_SIZE);

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const cx = x * TILE_SIZE + TILE_SIZE / 2;
          const cy = y * TILE_SIZE + TILE_SIZE / 2;

          let imgKey = "centertiles";
          const rand = Math.random();
          if (rand < 0.85) imgKey = "centertiles";
          else if (rand < 0.93) imgKey = "centertiles1";
          else if (rand < 0.97) imgKey = "centertilesSpecial";
          else imgKey = "centertilesSpecial1";

          if (isWalkable(cx, cy)) {
            const topW = isWalkable(cx, cy - TILE_SIZE);
            const bottomW = isWalkable(cx, cy + TILE_SIZE);
            const leftW = isWalkable(cx - TILE_SIZE, cy);
            const rightW = isWalkable(cx + TILE_SIZE, cy);

            if (!topW && !leftW) imgKey = "topCornerLeft";
            else if (!topW && !rightW) imgKey = "topCornerRight";
            else if (!bottomW && !leftW) imgKey = "bottomCornerLeft";
            else if (!bottomW && !rightW) imgKey = "bottomCornerRight";
            else if (!topW) imgKey = "topMid";
            else if (!bottomW) imgKey = "bottomMid";
            else if (!leftW) imgKey = "leftside";
            else if (!rightW) imgKey = "rightTile";
            else {
              imgKey = "centertilesNormal"; // Inside walkable center
            }
          }

          const img = loadedImagesRef.current[imgKey];
          if (img && img.naturalWidth > 0) {
            ctx.drawImage(img, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          } else {
            ctx.fillStyle = "#111827";
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
      backgroundCanvasRef.current = canvas;
    };
  }, []);

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
        setShowNonceFinder(false);
        setShowMempoolCleanup(false);
        setShowConsensusAlignment(false);
        setShowBridgeGuardian(false);
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

    const isAnyTaskOpen = showPuzzle || showBounce || showGasFee || showMiner || showCatcher || showFix || showSpinner || showColorSpin || showElevatorLever || showNonceFinder || showMempoolCleanup || showConsensusAlignment || showBridgeGuardian;

    // -------- MOVEMENT (blocked while a task is open) --------
    if (!isAnyTaskOpen) {
      let nextX = player.current.x;
      let nextY = player.current.y;

      if (keys.current["ArrowUp"] || keys.current["w"] || keys.current["W"]) nextY -= player.current.speed;
      if (keys.current["ArrowDown"] || keys.current["s"] || keys.current["S"]) nextY += player.current.speed;
      if (keys.current["ArrowLeft"] || keys.current["a"] || keys.current["A"]) nextX -= player.current.speed;
      if (keys.current["ArrowRight"] || keys.current["d"] || keys.current["D"]) nextX += player.current.speed;

      const isPointWalkable = (px: number, py: number) => {
        return rooms.some((r) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) ||
          corridors.some((c) => px >= c.x && px <= c.x + c.width && py >= c.y && py <= c.y + c.height) ||
          taskZones.some((z) => px >= z.x && px <= z.x + z.width && py >= z.y && py <= z.y + z.height);
      };

      const offset = player.current.size * 0.7;
      const isInWalkableArea =
        isPointWalkable(nextX - offset, nextY - offset) &&
        isPointWalkable(nextX + offset, nextY - offset) &&
        isPointWalkable(nextX - offset, nextY + offset) &&
        isPointWalkable(nextX + offset, nextY + offset);

      const hitWall = walls.some((w) => {
        const isOuterWall = w.x === 0 || w.y === 0 || w.x === MAP_WIDTH - w.width || w.y === MAP_HEIGHT - w.height;
        if (isOuterWall) return circleRectCollision(nextX, nextY, player.current.size, w);

        // Thinner collision box for inner fences
        const isHorizontal = w.width >= w.height;
        let hitBox = w;
        if (isHorizontal) {
          hitBox = { x: w.x, y: w.y + w.height / 2 - 10, width: w.width, height: 20 };
        } else {
          hitBox = { x: w.x + w.width / 2 - 10, y: w.y, width: 20, height: w.height };
        }
        return circleRectCollision(nextX, nextY, player.current.size, hitBox);
      });

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
    const currentIndex = nearTaskIndex;
    const ePressed = !!(keys.current["e"] || keys.current["E"]);
    if (currentIndex !== null && ePressed && !eWasPressed.current && !isAnyTaskOpen) {
      const isTaskCompleted = completedTasks["task" + (currentIndex + 1)];

      if (!isTaskCompleted) {
        // Task zone 0 = Cafeteria → Task 1
        if (currentIndex === 0) {
          setShowPuzzle(true);
        }
        // Task zone 1 = Weapons → Task 2
        else if (currentIndex === 1) {
          setShowBounce(true);
        }
        // Task zone 2 = Navigation → Task 3
        else if (currentIndex === 2) {
          setShowGasFee(true);
        }
        // Task zone 3 = Shields → Task 4
        else if (currentIndex === 3) {
          setShowMiner(true);
        }
        // Task zone 4 = O2 → Task 5
        else if (currentIndex === 4) {
          setShowCatcher(true);
        }
        // Task zone 5 = Admin → Task 6
        else if (currentIndex === 5) {
          setShowFix(true);
        }
        // Task zone 6 = Storage → Task 7
        else if (currentIndex === 6) {
          setShowSpinner(true);
        }
        // Task zone 7 = Electrical → Task 8
        else if (currentIndex === 7) {
          setShowColorSpin(true);
        }
        // Task zone 8 = Lower Engine → Task 9
        else if (currentIndex === 8) {
          setShowElevatorLever(true);
        }
        // Task zone 9 = Security → Task 10
        else if (currentIndex === 9) {
          setShowNonceFinder(true);
        }
        // Task zone 10 = Reactor → Task 11
        else if (currentIndex === 10) {
          setShowMempoolCleanup(true);
        }
        // Task zone 11 = Upper Engine → Task 12
        else if (currentIndex === 11) {
          setShowConsensusAlignment(true);
        }
        // Task zone 12 = Medbay → Task 13
        else if (currentIndex === 12) {
          setShowBridgeGuardian(true);
        }
      }
    }
    eWasPressed.current = ePressed;

    // -------- DRAW --------
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#111827";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    if (backgroundCanvasRef.current) {
      ctx.drawImage(backgroundCanvasRef.current, 0, 0);
    }

    // Fences / Walls
    walls.forEach((w) => {
      const isOuterWall = w.x === 0 || w.y === 0 || w.x === MAP_WIDTH - w.width || w.y === MAP_HEIGHT - w.height;
      if (isOuterWall) return; // Outer walls don't need visual rendering inside the map as they are bounds

      const isHorizontal = w.width >= w.height;
      const leftImg = loadedImagesRef.current["fenceLeft"];
      const midImg = loadedImagesRef.current["fenceMid"];
      const rightImg = loadedImagesRef.current["fenceRight"];
      const fenceSize = 30; // visually scale the 16x16 to 30px thick

      if (isHorizontal) {
        const drawY = w.y + w.height / 2 - fenceSize / 2;
        if (leftImg) ctx.drawImage(leftImg, w.x, drawY, fenceSize, fenceSize);
        if (rightImg) ctx.drawImage(rightImg, w.x + w.width - fenceSize, drawY, fenceSize, fenceSize);
        if (midImg) {
          for (let px = w.x + fenceSize; px < w.x + w.width - fenceSize; px += fenceSize) {
            const fw = Math.min(fenceSize, (w.x + w.width - fenceSize) - px);
            ctx.drawImage(midImg, px, drawY, fw, fenceSize);
          }
        }
      } else {
        ctx.save();
        const drawX = w.x + w.width / 2 - fenceSize / 2;
        ctx.translate(drawX + fenceSize / 2, w.y);
        ctx.rotate(Math.PI / 2); // 90 degrees

        if (leftImg) ctx.drawImage(leftImg, 0, -fenceSize / 2, fenceSize, fenceSize);
        if (midImg) {
          for (let px = fenceSize; px < w.height - fenceSize; px += fenceSize) {
            const fw = Math.min(fenceSize, (w.height - fenceSize) - px);
            ctx.drawImage(midImg, px, -fenceSize / 2, fw, fenceSize);
          }
        }
        if (rightImg) ctx.drawImage(rightImg, w.height - fenceSize, -fenceSize / 2, fenceSize, fenceSize);
        ctx.restore();
      }
    });

    // Task Zones
    const blinkAmount = Math.abs(Math.sin(Date.now() / 300));

    taskZones.forEach((t, index) => {
      const isCompleted = completedTasks["task" + (index + 1)];
      const isNear = nearTaskIndex === index;

      const imgKey = isCompleted ? "taskCompleted" : "taskNotCompleted";
      const img = loadedImagesRef.current[imgKey];

      if (img && img.naturalWidth > 0) {
        ctx.globalAlpha = isNear ? 0.6 + (0.4 * blinkAmount) : 1.0;
        // Drawing the image perfectly fitted inside the task zone rect
        ctx.drawImage(img, t.x, t.y, t.width, t.height);
        ctx.globalAlpha = 1.0;
      } else {
        // Fallback drawing if images unavailable
        ctx.fillStyle = isNear ? `rgba(234, 179, 8, ${0.4 + 0.3 * blinkAmount})` : "rgba(234, 179, 8, 0.4)";
        ctx.fillRect(t.x, t.y, t.width, t.height);
      }

      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.fillText(`Task ${index}`, t.x + t.width / 2, t.y + t.height / 2);
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
    if (nearTaskIndex !== null && !isAnyTaskOpen) {
      const isTaskCompleted = completedTasks["task" + (nearTaskIndex + 1)];

      if (!isTaskCompleted) {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 14px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Press E to interact",
          player.current.x,
          player.current.y - player.current.size - 25
        );
      }
    }

    ctx.restore();
  }, [keys, showPuzzle, showBounce, showGasFee, showMiner, showCatcher, showFix, showSpinner, showColorSpin, showElevatorLever, showNonceFinder, showMempoolCleanup, showConsensusAlignment, showBridgeGuardian]);

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

      <NonceFinderPopup
        isOpen={showNonceFinder}
        onClose={() => setShowNonceFinder(false)}
      />

      <MempoolCleanupPopup
        isOpen={showMempoolCleanup}
        onClose={() => setShowMempoolCleanup(false)}
      />

      <ConsensusAlignmentPopup
        isOpen={showConsensusAlignment}
        onClose={() => setShowConsensusAlignment(false)}
      />

      <BridgeGuardianPopup
        isOpen={showBridgeGuardian}
        onClose={() => setShowBridgeGuardian(false)}
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
