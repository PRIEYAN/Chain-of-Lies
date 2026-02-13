import { useEffect, useRef } from "react";

export function useKeyboard() {
  const keys = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      console.log("KEY DOWN:", e.key);
      keys.current[e.key] = true;
    };

    const up = (e: KeyboardEvent) => {
      keys.current[e.key] = false;
    };

    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);

    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener("keyup", up);
    };
  }, []);

  return keys;
}
