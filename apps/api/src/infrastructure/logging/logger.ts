/**
 * Logger utility for consistent logging across the API
 */
const formatTime = () => {
  return new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

export const logger = {
  info: (message: string, ...args: unknown[]) => {
    console.log(`${formatTime()} [INFO] ${message}`, ...args);
  },
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`${formatTime()} [WARN] ${message}`, ...args);
  },
  error: (message: string, ...args: unknown[]) => {
    console.error(`${formatTime()} [ERROR] ${message}`, ...args);
  },
  debug: (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV === "development") {
      console.debug(`${formatTime()} [DEBUG] ${message}`, ...args);
    }
  },
};
