import { useEffect, useRef } from "react";

/**
 * useGameLoop - Stable game loop hook
 * 
 * Creates a single, continuous requestAnimationFrame loop that doesn't restart.
 * The callback is stored in a ref to prevent loop recreation on callback changes.
 */
export function useGameLoop(callback: () => void) {
  const callbackRef = useRef(callback);
  const animationRef = useRef<number>();

  // Update callback ref when callback changes (without restarting loop)
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Start loop once and keep it running
  useEffect(() => {
    const loop = () => {
      callbackRef.current();
      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []); // Empty deps - loop starts once and never restarts
}
