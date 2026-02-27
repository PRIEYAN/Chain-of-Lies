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

import playerVideoSrc from "../assests/player/player.webm";

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

export default function MultiplayerGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const keys = useKeyboard();

  const { players, localPlayerId, updatePlayer, phase, isAlive, completedTasks } = useGameStore();
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
  const [showNonceFinder, setShowNonceFinder] = useState(false);
  const [showMempoolCleanup, setShowMempoolCleanup] = useState(false);
  const [showConsensusAlignment, setShowConsensusAlignment] = useState(false);
  const [showBridgeGuardian, setShowBridgeGuardian] = useState(false);

  const eWasPressed = useRef(false);

  const localPlayer = useRef({
    size: 15,
    speed: 10.7,
  });

  // Get local player data from store
  const localPlayerData = localPlayerId ? players[localPlayerId] : null;

  const loadedImagesRef = useRef<Record<string, HTMLImageElement>>({});
  const playerVideosRef = useRef<Record<string, { video: HTMLVideoElement; facingLeft: boolean; lastX: number; lastY: number }>>({});

  // Background init
  useEffect(() => {
    const imagesToLoad = [
      { key: "topMid", src: topMidSrc },
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
      { key: "taskCompleted", src: taskCompletedSrc },
      { key: "taskNotCompleted", src: taskNotCompletedSrc },
      { key: "fenceLeft", src: fenceLeftSrc },
      { key: "fenceMid", src: fenceMidSrc },
      { key: "fenceRight", src: fenceRightSrc },
    ];

    const loadedImages: Record<string, HTMLImageElement> = {};
    let loadedCount = 0;
    const totalImages = imagesToLoad.length;

    const onImageLoad = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        renderBackgroundCanvas();
      }
    };

    for (const { key, src } of imagesToLoad) {
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

  // Update function - handles local player movement and rendering
  const update = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isAnyTaskOpen = showPuzzle || showBounce || showGasFee || showMiner || showCatcher || showFix || showSpinner || showColorSpin || showElevatorLever || showNonceFinder || showMempoolCleanup || showConsensusAlignment || showBridgeGuardian;

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
        const isPointWalkable = (px: number, py: number) => {
          return rooms.some((r) => px >= r.x && px <= r.x + r.width && py >= r.y && py <= r.y + r.height) ||
            corridors.some((c) => px >= c.x && px <= c.x + c.width && py >= c.y && py <= c.y + c.height) ||
            taskZones.some((z) => px >= z.x && px <= z.x + z.width && py >= z.y && py <= z.y + z.height);
        };

        const offset = localPlayer.current.size * 0.7;
        const isInWalkableArea =
          isPointWalkable(nextX - offset, nextY - offset) &&
          isPointWalkable(nextX + offset, nextY - offset) &&
          isPointWalkable(nextX - offset, nextY + offset) &&
          isPointWalkable(nextX + offset, nextY + offset);

        // Check explicit walls
        const hitExplicitWall = walls.some((wall) => {
          const isOuterWall = wall.x === 0 || wall.y === 0 || wall.x === MAP_WIDTH - wall.width || wall.y === MAP_HEIGHT - wall.height;
          if (isOuterWall) return circleRectCollision(nextX, nextY, localPlayer.current.size, wall);

          // Thinner collision box for inner fences
          const isHorizontal = wall.width >= wall.height;
          let hitBox = wall;
          if (isHorizontal) {
            hitBox = { x: wall.x, y: wall.y + wall.height / 2 - 10, width: wall.width, height: 20 };
          } else {
            hitBox = { x: wall.x + wall.width / 2 - 10, y: wall.y, width: 20, height: wall.height };
          }
          return circleRectCollision(nextX, nextY, localPlayer.current.size, hitBox);
        });

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

      const currentIndex = nearTaskIndex;
      const ePressed = !!(keys.current["e"] || keys.current["E"]);
      if (currentIndex !== null && ePressed && !eWasPressed.current && !isAnyTaskOpen) {
        const isTaskCompleted = completedTasks["task" + (currentIndex + 1)];

        if (!isTaskCompleted) {
          if (currentIndex === 0) {
            setShowPuzzle(true);
          } else if (currentIndex === 1) {
            setShowBounce(true);
          } else if (currentIndex === 2) {
            setShowGasFee(true);
          } else if (currentIndex === 3) {
            setShowMiner(true);
          } else if (currentIndex === 4) {
            setShowCatcher(true);
          } else if (currentIndex === 5) {
            setShowFix(true);
          } else if (currentIndex === 6) {
            setShowSpinner(true);
          } else if (currentIndex === 7) {
            setShowColorSpin(true);
          } else if (currentIndex === 8) {
            setShowElevatorLever(true);
          } else if (currentIndex === 9) {
            setShowNonceFinder(true);
          } else if (currentIndex === 10) {
            setShowMempoolCleanup(true);
          } else if (currentIndex === 11) {
            setShowConsensusAlignment(true);
          } else if (currentIndex === 12) {
            setShowBridgeGuardian(true);
          }
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

    if (backgroundCanvasRef.current) {
      ctx.drawImage(backgroundCanvasRef.current, 0, 0);
    }

    // 5. Draw world elements

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
      const isTaskCompleted = completedTasks["task" + (index + 1)];
      const isNear = nearTaskIndex === index;

      const imgKey = isTaskCompleted ? "taskCompleted" : "taskNotCompleted";

      const img = loadedImagesRef.current[imgKey];

      if (img && img.naturalWidth > 0) {
        ctx.globalAlpha = isNear ? 0.6 + (0.4 * blinkAmount) : 1.0;
        ctx.drawImage(img, t.x, t.y, t.width, t.height);
        ctx.globalAlpha = 1.0;
      } else {
        ctx.fillStyle = isTaskCompleted ? "#6b7280" : (isNear ? `rgba(234, 179, 8, ${0.4 + 0.3 * blinkAmount})` : "#eab308");
        ctx.fillRect(t.x, t.y, t.width, t.height);
      }

      ctx.fillStyle = "#fff";
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

      // Player video avatar
      let pVideoData = playerVideosRef.current[player.id];
      if (!pVideoData) {
        const video = document.createElement("video");
        video.src = typeof playerVideoSrc === 'string' ? playerVideoSrc : (playerVideoSrc as any).default || playerVideoSrc;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.load();
        pVideoData = { video, facingLeft: false, lastX: renderX, lastY: renderY };
        playerVideosRef.current[player.id] = pVideoData;
      }

      const isMoving = Math.abs(renderX - pVideoData.lastX) > 0.1 || Math.abs(renderY - pVideoData.lastY) > 0.1;

      if (renderX < pVideoData.lastX - 0.1) pVideoData.facingLeft = true;
      if (renderX > pVideoData.lastX + 0.1) pVideoData.facingLeft = false;

      pVideoData.lastX = renderX;
      pVideoData.lastY = renderY;

      if (isMoving) {
        if (pVideoData.video.paused) {
          pVideoData.video.play().catch(e => console.error("Video play error", e));
        }
      } else {
        if (!pVideoData.video.paused) {
          pVideoData.video.pause();
          pVideoData.video.currentTime = 0;
        }
      }

      const videoSize = localPlayer.current.size * 2.8;

      ctx.save();
      ctx.translate(renderX, renderY);

      if (pVideoData.facingLeft) {
        ctx.scale(-1, 1);
      }

      if (pVideoData.video.readyState >= 2) {
        // Glow effect for local player
        if (isLocal) {
          ctx.shadowBlur = 15;
          ctx.shadowColor = player.color;
        }

        ctx.drawImage(
          pVideoData.video,
          -videoSize / 2,
          -videoSize / 2,
          videoSize,
          videoSize
        );
      } else {
        // Fallback to circle
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(0, 0, localPlayer.current.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = isLocal ? "#fff" : "#000";
        ctx.lineWidth = isLocal ? 3 : 2;
        ctx.stroke();
      }
      ctx.restore();

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
      const isTaskCompleted = completedTasks["task" + (nearTaskIndex + 1)];

      if (!isTaskCompleted) {
        ctx.fillStyle = "#facc15";
        ctx.font = "bold 14px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Press E to interact",
          localPlayerData.x,
          localPlayerData.y - localPlayer.current.size - 35
        );
      }
    }

    // 8. Restore context state
    ctx.restore();

  }, [keys, players, localPlayerId, localPlayerData, updatePlayer, emitPlayerMove, showPuzzle, showBounce, showGasFee, showMiner, showCatcher, showFix, showSpinner, showColorSpin, showElevatorLever, showNonceFinder, showMempoolCleanup, showConsensusAlignment, showBridgeGuardian]);

  // Start game loop
  useGameLoop(update);

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full md:w-auto h-full max-h-screen relative p-0 m-0">
      <div style={{ position: "relative", display: "inline-block" }} className="w-full h-full max-w-[800px] max-h-[500px] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          tabIndex={0}
          className="w-full h-full object-contain aspect-[8/5] border border-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
