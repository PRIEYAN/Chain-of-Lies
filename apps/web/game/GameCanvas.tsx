import { useEffect, useRef } from "react";
import { useKeyboard } from "./useKeyboard";

const WIDTH = 800;
const HEIGHT = 500;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { keys } = useKeyboard();

  const player = useRef({
    x: 100,
    y: 100,
    size: 30,
    speed: 3,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;

    const loop = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Movement
      if (keys["ArrowUp"]) player.current.y -= player.current.speed;
      if (keys["ArrowDown"]) player.current.y += player.current.speed;
      if (keys["ArrowLeft"]) player.current.x -= player.current.speed;
      if (keys["ArrowRight"]) player.current.x += player.current.speed;

      // Draw player (simple circle for now)
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

      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationId);
  }, [keys]);

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      className="border border-white rounded-lg"
    />
  );
}
