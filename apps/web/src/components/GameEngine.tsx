import { useEffect, useRef, useCallback } from "react";
import { useGame } from "@/contexts/GameContext";
import { useKeyboard } from "@/hooks/use-keyboard";

const MAP_WIDTH = 900;
const MAP_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 4;

export default function GameEngine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { keys } = useKeyboard();
  const {
    players,
    localPlayerId,
    interactionZones,
    updateLocalPlayer,
    triggerInteraction,
    movementLocked,
  } = useGame();

  const localPlayerRef = useRef({ x: 450, y: 300 });
  const nearZoneRef = useRef<string | null>(null);

  // Check if player is near an interaction zone
  const checkInteractionZones = useCallback((x: number, y: number) => {
    for (const zone of interactionZones) {
      const inZone =
        x > zone.x &&
        x < zone.x + zone.width &&
        y > zone.y &&
        y < zone.y + zone.height;
      
      if (inZone) {
        nearZoneRef.current = zone.id;
        return zone.id;
      }
    }
    nearZoneRef.current = null;
    return null;
  }, [interactionZones]);

  // Handle keyboard input
  useEffect(() => {
    if (movementLocked) return;

    const interval = setInterval(() => {
      let vx = 0;
      let vy = 0;

      if (keys["ArrowUp"] || keys["w"] || keys["W"]) vy -= 1;
      if (keys["ArrowDown"] || keys["s"] || keys["S"]) vy += 1;
      if (keys["ArrowLeft"] || keys["a"] || keys["A"]) vx -= 1;
      if (keys["ArrowRight"] || keys["d"] || keys["D"]) vx += 1;

      // Normalize diagonal movement
      if (vx !== 0 && vy !== 0) {
        const mag = Math.sqrt(vx * vx + vy * vy);
        vx = (vx / mag) * PLAYER_SPEED;
        vy = (vy / mag) * PLAYER_SPEED;
      } else {
        vx *= PLAYER_SPEED;
        vy *= PLAYER_SPEED;
      }

      // Update position with boundary checks
      let newX = localPlayerRef.current.x + vx;
      let newY = localPlayerRef.current.y + vy;

      newX = Math.max(PLAYER_SIZE, Math.min(MAP_WIDTH - PLAYER_SIZE, newX));
      newY = Math.max(PLAYER_SIZE, Math.min(MAP_HEIGHT - PLAYER_SIZE, newY));

      localPlayerRef.current = { x: newX, y: newY };
      updateLocalPlayer(newX, newY, vx, vy);

      // Check for nearby zones
      checkInteractionZones(newX, newY);
    }, 1000 / 60); // 60 FPS

    return () => clearInterval(interval);
  }, [keys, movementLocked, updateLocalPlayer, checkInteractionZones]);

  // Handle interaction key (E)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "e" || e.key === "E") && nearZoneRef.current) {
        triggerInteraction(nearZoneRef.current);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [triggerInteraction]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = "hsl(232, 46%, 6%)";
      ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

      // Draw grid
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;
      for (let x = 0; x < MAP_WIDTH; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, MAP_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < MAP_HEIGHT; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(MAP_WIDTH, y);
        ctx.stroke();
      }

      // Draw interaction zones
      interactionZones.forEach(zone => {
        const isNear = nearZoneRef.current === zone.id;
        
        // Zone background
        ctx.fillStyle = zone.type === "emergency" 
          ? "rgba(239, 68, 68, 0.15)" 
          : "rgba(56, 189, 248, 0.1)";
        ctx.fillRect(zone.x, zone.y, zone.width, zone.height);

        // Zone border
        ctx.strokeStyle = isNear
          ? zone.type === "emergency" ? "rgba(239, 68, 68, 0.8)" : "rgba(56, 189, 248, 0.8)"
          : zone.type === "emergency" ? "rgba(239, 68, 68, 0.3)" : "rgba(56, 189, 248, 0.3)";
        ctx.lineWidth = isNear ? 3 : 2;
        ctx.strokeRect(zone.x, zone.y, zone.width, zone.height);

        // Zone label
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.font = "12px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(zone.label, zone.x + zone.width / 2, zone.y + zone.height / 2 + 4);

        // Show "Press E" hint when near
        if (isNear) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.font = "bold 10px 'IBM Plex Sans', sans-serif";
          ctx.fillText("Press E", zone.x + zone.width / 2, zone.y - 10);
        }
      });

      // Draw all players
      players.forEach(player => {
        const isLocal = player.id === localPlayerId;
        
        // Player circle
        ctx.fillStyle = isLocal 
          ? "hsl(188, 92%, 54%)" // Primary cyan for local player
          : "hsl(136, 92%, 56%)"; // Accent green for remote players
        
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();

        // Player glow
        ctx.shadowBlur = 15;
        ctx.shadowColor = isLocal ? "hsl(188, 92%, 54%)" : "hsl(136, 92%, 56%)";
        ctx.beginPath();
        ctx.arc(player.x, player.y, PLAYER_SIZE, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Player name
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.font = "bold 11px 'IBM Plex Sans', sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(player.username, player.x, player.y - PLAYER_SIZE - 8);
      });

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationId);
  }, [players, localPlayerId, interactionZones]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <canvas
        ref={canvasRef}
        width={MAP_WIDTH}
        height={MAP_HEIGHT}
        className="border border-white/20 rounded-lg shadow-2xl"
      />
    </div>
  );
}
