import GameCanvas from "../../game/GameCanvas";

/**
 * GameEngine Component
 * 
 * This component serves as a wrapper for the GameCanvas renderer.
 * It provides the layout structure and integrates the existing
 * GameCanvas component from the game/ directory.
 * 
 * The actual game rendering, player movement, collision detection,
 * and map rendering are handled by GameCanvas.
 */
export default function GameEngine() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <GameCanvas />
    </div>
  );
}
