import { useEffect, useState } from "react";

export function useKeyboard() {
  const [keys, setKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const down = (e: KeyboardEvent) =>
      setKeys((prev) => ({ ...prev, [e.key]: true }));

    const up = (e: KeyboardEvent) =>
      setKeys((prev) => ({ ...prev, [e.key]: false }));

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return { keys };
}
